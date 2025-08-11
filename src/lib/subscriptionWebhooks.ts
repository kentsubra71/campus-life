import { db, Subscription, MonthlySpend } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query, 
  where,
  runTransaction,
  Timestamp 
} from 'firebase/firestore';

// Subscription tier configurations
const TIER_CAPS = {
  basic: 2500,    // $25
  semi: 5000,     // $50  
  premium: 10000  // $100
};

// App Store receipt verification (simplified - use real verification in production)
export const verifyAppStoreReceipt = async (receiptData: string): Promise<{
  valid: boolean;
  transactionId?: string;
  productId?: string;
  expiresDate?: Date;
  error?: string;
}> => {
  // In production, verify with App Store Connect API
  // This is a simplified mock implementation
  try {
    // Mock verification logic
    const decoded = JSON.parse(atob(receiptData));
    
    return {
      valid: true,
      transactionId: decoded.transaction_id,
      productId: decoded.product_id,
      expiresDate: new Date(decoded.expires_date)
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid receipt format'
    };
  }
};

// Play Store purchase verification (simplified)
export const verifyPlayStorePurchase = async (
  packageName: string,
  subscriptionId: string,
  purchaseToken: string
): Promise<{
  valid: boolean;
  expiryTimeMillis?: number;
  error?: string;
}> => {
  // In production, verify with Google Play Developer API
  // This is a simplified mock implementation
  try {
    // Mock verification logic
    return {
      valid: true,
      expiryTimeMillis: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid purchase token'
    };
  }
};

// Map product IDs to tiers
const mapProductIdToTier = (productId: string): 'basic' | 'semi' | 'premium' => {
  if (productId.includes('basic')) return 'basic';
  if (productId.includes('semi') || productId.includes('plus')) return 'semi';
  if (productId.includes('premium')) return 'premium';
  return 'basic'; // default
};

// Create or update subscription from App Store
export const handleAppStoreWebhook = async (webhookData: any): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { notification_type, unified_receipt } = webhookData;
    
    if (!unified_receipt?.latest_receipt_info?.[0]) {
      return { success: false, error: 'Missing receipt info' };
    }
    
    const receiptInfo = unified_receipt.latest_receipt_info[0];
    const userId = receiptInfo.original_application_version; // Use this field to store user ID
    const productId = receiptInfo.product_id;
    const expiresDate = new Date(parseInt(receiptInfo.expires_date_ms));
    const transactionId = receiptInfo.transaction_id;
    
    // Map product ID to tier
    const tier = mapProductIdToTier(productId);
    const capCents = TIER_CAPS[tier];
    
    // Determine subscription status
    let status: 'active' | 'canceled' | 'past_due' = 'active';
    if (notification_type === 'DID_FAIL_TO_RENEW') {
      status = 'past_due';
    } else if (notification_type === 'CANCEL') {
      status = 'canceled';
    }
    
    // Calculate period start (30 days before expires)
    const periodStart = new Date(expiresDate.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    await runTransaction(db, async (transaction) => {
      // Create or update subscription
      const subscriptionData: Omit<Subscription, 'id'> = {
        user_id: userId,
        tier,
        cap_cents: capCents,
        status,
        store: 'apple',
        store_receipt: JSON.stringify(receiptInfo),
        current_period_start_utc: Timestamp.fromDate(periodStart),
        current_period_end_utc: Timestamp.fromDate(expiresDate),
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };
      
      const subscriptionRef = doc(collection(db, 'subscriptions'));
      transaction.set(subscriptionRef, subscriptionData);
      
      // Create new monthly spend record for the new period
      if (status === 'active') {
        const monthlySpendData: Omit<MonthlySpend, 'id'> = {
          parent_id: userId,
          period_start_utc: Timestamp.fromDate(periodStart),
          period_end_utc: Timestamp.fromDate(expiresDate),
          spent_cents: 0,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        };
        
        const spendRef = doc(collection(db, 'monthly_spend'));
        transaction.set(spendRef, monthlySpendData);
      }
    });
    
    console.log(`✅ App Store subscription updated for user ${userId}: ${tier} ${status}`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ App Store webhook error:', error);
    return { success: false, error: error.message };
  }
};

// Create or update subscription from Play Store
export const handlePlayStoreWebhook = async (webhookData: any): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { subscriptionNotification } = webhookData;
    
    if (!subscriptionNotification) {
      return { success: false, error: 'Missing subscription notification' };
    }
    
    const {
      subscriptionId,
      purchaseToken,
      notificationType
    } = subscriptionNotification;
    
    // Verify the purchase with Google Play API
    const verification = await verifyPlayStorePurchase(
      webhookData.packageName,
      subscriptionId,
      purchaseToken
    );
    
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }
    
    // Extract user ID from purchase metadata (would be set during purchase)
    // For now, using a placeholder - in production, this would come from the purchase
    const userId = 'user-from-purchase-metadata';
    
    const expiresDate = new Date(verification.expiryTimeMillis!);
    const periodStart = new Date(expiresDate.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Map subscription ID to tier
    const tier = mapProductIdToTier(subscriptionId);
    const capCents = TIER_CAPS[tier];
    
    // Determine status from notification type
    let status: 'active' | 'canceled' | 'past_due' = 'active';
    switch (notificationType) {
      case 1: // SUBSCRIPTION_RECOVERED
      case 2: // SUBSCRIPTION_RENEWED
        status = 'active';
        break;
      case 3: // SUBSCRIPTION_CANCELED
        status = 'canceled';
        break;
      case 6: // SUBSCRIPTION_ON_HOLD
      case 12: // SUBSCRIPTION_EXPIRED
        status = 'past_due';
        break;
    }
    
    await runTransaction(db, async (transaction) => {
      // Create or update subscription
      const subscriptionData: Omit<Subscription, 'id'> = {
        user_id: userId,
        tier,
        cap_cents: capCents,
        status,
        store: 'google',
        store_receipt: JSON.stringify(subscriptionNotification),
        current_period_start_utc: Timestamp.fromDate(periodStart),
        current_period_end_utc: Timestamp.fromDate(expiresDate),
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };
      
      const subscriptionRef = doc(collection(db, 'subscriptions'));
      transaction.set(subscriptionRef, subscriptionData);
      
      // Create new monthly spend record for the new period
      if (status === 'active') {
        const monthlySpendData: Omit<MonthlySpend, 'id'> = {
          parent_id: userId,
          period_start_utc: Timestamp.fromDate(periodStart),
          period_end_utc: Timestamp.fromDate(expiresDate),
          spent_cents: 0,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        };
        
        const spendRef = doc(collection(db, 'monthly_spend'));
        transaction.set(spendRef, monthlySpendData);
      }
    });
    
    console.log(`✅ Play Store subscription updated for user ${userId}: ${tier} ${status}`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Play Store webhook error:', error);
    return { success: false, error: error.message };
  }
};

// Initialize default subscription for testing (remove in production)
export const createTestSubscription = async (
  userId: string, 
  tier: 'basic' | 'semi' | 'premium' = 'basic'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const capCents = TIER_CAPS[tier];
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
    
    const subscriptionData: Omit<Subscription, 'id'> = {
      user_id: userId,
      tier,
      cap_cents: capCents,
      status: 'active',
      store: 'web',
      current_period_start_utc: Timestamp.fromDate(now),
      current_period_end_utc: Timestamp.fromDate(periodEnd),
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    const subscriptionRef = doc(collection(db, 'subscriptions'));
    await setDoc(subscriptionRef, subscriptionData);
    
    // Create monthly spend record
    const monthlySpendData: Omit<MonthlySpend, 'id'> = {
      parent_id: userId,
      period_start_utc: Timestamp.fromDate(now),
      period_end_utc: Timestamp.fromDate(periodEnd),
      spent_cents: 0,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    const spendRef = doc(collection(db, 'monthly_spend'));
    await setDoc(spendRef, monthlySpendData);
    
    console.log(`✅ Test subscription created for user ${userId}: ${tier}`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Error creating test subscription:', error);
    return { success: false, error: error.message };
  }
};