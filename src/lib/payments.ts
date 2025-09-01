import { db, getCurrentUser, Subscription, MonthlySpend, Payment } from './firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  setDoc, 
  updateDoc,
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import { cache, CACHE_CONFIGS } from '../utils/universalCache';

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  basic: { cap_cents: 2500, display_name: 'Basic', description: '$25/month send limit' },
  semi: { cap_cents: 5000, display_name: 'Semi Premium', description: '$50/month send limit' },
  premium: { cap_cents: 10000, display_name: 'Premium', description: '$100/month send limit' }
};

// Payment providers configuration with caching
export const getPaymentProviders = async (): Promise<{
  id: 'paypal' | 'venmo' | 'cashapp' | 'zelle';
  name: string;
  emoji: string;
  description: string;
  available: boolean;
  manual: boolean;
}[]> => {
  return await cache.getOrFetch(
    CACHE_CONFIGS.PAYMENT_PROVIDERS,
    async () => {
      console.log('🔄 Loading payment providers configuration...');
      
      // This could come from a config service in the future
      return [
        {
          id: 'paypal' as const,
          name: 'PayPal',
          emoji: '💙',
          description: 'Best experience. Returns to CampusLife.',
          available: true,
          manual: false
        },
        {
          id: 'venmo' as const,
          name: 'Venmo',
          emoji: '💙',
          description: 'Opens app; confirm after.',
          available: true,
          manual: true
        },
        {
          id: 'cashapp' as const,
          name: 'Cash App',
          emoji: '💚',
          description: 'Opens app; confirm after.',
          available: true,
          manual: true
        },
        {
          id: 'zelle' as const,
          name: 'Zelle',
          emoji: '⚡',
          description: 'Opens your bank/Zelle; manual confirm.',
          available: true,
          manual: true
        }
      ];
    }
  );
};

// Payment provider URL builders
export const buildProviderUrl = async (
  provider: 'paypal' | 'venmo' | 'cashapp' | 'zelle',
  amount_cents: number,
  recipient: any,
  note?: string,
  payment_id?: string
): Promise<{ redirectUrl: string; manual: boolean }> => {
  const dollars = (amount_cents / 100).toFixed(2);

  switch (provider) {
    case 'paypal':
      // Create real PayPal order
      try {
        const { createPayPalOrder } = await import('./paypalIntegration');
        const { approvalUrl } = await createPayPalOrder(
          amount_cents,
          recipient.email || recipient.paypal_email,
          payment_id || '',
          note || `Campus Life reward: $${dollars}`
        );
        return {
          redirectUrl: approvalUrl,
          manual: false
        };
      } catch (error) {
        console.error('PayPal order creation failed:', error);
        // Fallback to manual
        return {
          redirectUrl: `https://paypal.me/${recipient.paypal_username || 'campuslife'}/${dollars}`,
          manual: true
        };
      }

    case 'venmo':
      const venmoRecipient = recipient.venmo_username || recipient.email || recipient.zelle_phone;
      const encodedNote = encodeURIComponent(note || `CampusLife reward: $${dollars}`);
      return {
        redirectUrl: `https://venmo.com/?txn=pay&amount=${dollars}&note=${encodedNote}&recipients=${venmoRecipient}`,
        manual: true
      };

    case 'cashapp':
      const cashtag = recipient.cashapp_cashtag || '$student';
      return {
        redirectUrl: `https://cash.app/${cashtag}/${dollars}`,
        manual: true
      };

    case 'zelle':
      return {
        redirectUrl: 'https://www.zellepay.com/get-started',
        manual: true
      };

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

// Get active subscription for user
export const getActiveSubscription = async (userId: string): Promise<Subscription | null> => {
  try {
    const q = query(
      collection(db, 'subscriptions'),
      where('user_id', '==', userId),
      where('status', '==', 'active'),
      orderBy('created_at', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data() as Subscription;
    
    // Check if period is still active
    if (data.current_period_end_utc.toDate() > new Date()) {
      return { id: doc.id, ...data };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting active subscription:', error);
    return null;
  }
};

// Get or create monthly spend record for current period
export const getCurrentPeriodSpend = async (
  parentId: string, 
  periodStart: Date, 
  periodEnd: Date
): Promise<MonthlySpend> => {
  try {
    const periodStartTimestamp = Timestamp.fromDate(periodStart);
    
    // Try to find existing record
    const q = query(
      collection(db, 'monthly_spend'),
      where('parent_id', '==', parentId),
      where('period_start_utc', '==', periodStartTimestamp)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as MonthlySpend;
    }
    
    // Create new record if doesn't exist
    const newSpend: Omit<MonthlySpend, 'id'> = {
      parent_id: parentId,
      period_start_utc: Timestamp.fromDate(periodStart),
      period_end_utc: Timestamp.fromDate(periodEnd),
      spent_cents: 0,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, 'monthly_spend'), newSpend);
    return { id: docRef.id, ...newSpend };
  } catch (error) {
    console.error('Error getting current period spend:', error);
    throw error;
  }
};

// Create payment intent
export const createPaymentIntent = async (
  studentId: string,
  amountCents: number,
  provider: 'paypal' | 'venmo' | 'cashapp' | 'zelle',
  note?: string
): Promise<{
  success: boolean;
  paymentId?: string;
  idempotencyKey?: string;
  redirectUrl?: string;
  manual?: boolean;
  error?: string;
}> => {
  try {
    const user = getCurrentUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if user's email is verified
    const { getUserProfile } = await import('./firebase');
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile?.email_verified) {
      return { 
        success: false, 
        error: 'Email verification required. Please verify your email address before sending money.' 
      };
    }

    // Try to get active subscription, but continue without it for MVP
    let subscription = await getActiveSubscription(user.uid);
    if (!subscription) {
      console.log('No subscription found, using default limits for testing');
      // For MVP, allow payments without subscription (with basic limits)
      subscription = {
        id: 'test',
        user_id: user.uid,
        tier: 'basic',
        cap_cents: 2500, // $25 basic limit
        status: 'active',
        store: 'web',
        current_period_start_utc: { toDate: () => new Date() } as any,
        current_period_end_utc: { toDate: () => new Date(Date.now() + 30*24*60*60*1000) } as any,
        created_at: { now: () => new Date() } as any,
        updated_at: { now: () => new Date() } as any
      };
    }

    // Skip spending check for MVP - just create the payment
    // In production, you'd properly check caps here

    // Generate idempotency key (React Native compatible)
    const idempotencyKey = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);

    // Create payment record
    const payment: Omit<Payment, 'id'> = {
      parent_id: user.uid,
      student_id: studentId,
      provider,
      intent_cents: amountCents,
      note,
      status: 'initiated',
      idempotency_key: idempotencyKey,
      created_at: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'payments'), payment);
    
    // Get student info for provider URL (simplified - would need full student profile)
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    const studentData = studentDoc.exists() ? studentDoc.data() : {};

    // Build provider redirect URL
    const { redirectUrl, manual } = await buildProviderUrl(provider, amountCents, studentData, note, docRef.id);

    // Send payment notification to student
    try {
      const { pushNotificationService, NotificationTemplates } = await import('../services/pushNotificationService');
      
      const notification = {
        ...NotificationTemplates.paymentReceived(
          `$${(amountCents / 100).toFixed(2)}`,
          userProfile?.full_name || 'Family'
        ),
        userId: studentId
      };
      
      await pushNotificationService.sendPushNotification(notification);
      console.log('💰 Payment notification sent to student');
    } catch (notifError) {
      console.error('Failed to send payment notification:', notifError);
    }

    return {
      success: true,
      paymentId: docRef.id,
      idempotencyKey,
      redirectUrl,
      manual
    };
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return { success: false, error: error.message };
  }
};

// Confirm payment (idempotent)
export const confirmPayment = async (
  paymentId: string,
  idempotencyKey: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // TESTING: Skip all complex checks for development
    const TESTING_MODE = true;
    
    if (TESTING_MODE) {
      console.log('🧪 TESTING MODE: Simplified payment confirmation');
      const paymentRef = doc(db, 'payments', paymentId);
      const paymentDoc = await getDoc(paymentRef);
      
      if (!paymentDoc.exists()) {
        throw new Error('Payment not found');
      }
      
      const payment = paymentDoc.data() as Payment;
      
      // Simple confirmation - just update status
      await updateDoc(paymentRef, {
        status: 'confirmed_by_parent',
        confirmed_at: Timestamp.now()
      });

      // Send payment status notification
      try {
        const { pushNotificationService, NotificationTemplates } = await import('../services/pushNotificationService');
        
        const notification = {
          ...NotificationTemplates.paymentStatus(
            'confirmed',
            `$${(payment.intent_cents / 100).toFixed(2)}`
          ),
          userId: payment.student_id
        };
        
        await pushNotificationService.sendPushNotification(notification);
        console.log('📧 Payment confirmation notification sent');
      } catch (notifError) {
        console.error('Failed to send payment status notification:', notifError);
      }
      
      return { success: true };
    }
    
    return await runTransaction(db, async (transaction) => {
      const paymentRef = doc(db, 'payments', paymentId);
      const paymentDoc = await transaction.get(paymentRef);
      
      if (!paymentDoc.exists()) {
        throw new Error('Payment not found');
      }
      
      const payment = paymentDoc.data() as Payment;
      
      // Verify idempotency key
      if (payment.idempotency_key !== idempotencyKey) {
        throw new Error('Invalid idempotency key');
      }
      
      // If already confirmed, return success (idempotent)
      if (payment.status === 'confirmed_by_parent') {
        return { success: true };
      }
      
      // Get monthly spend record
      const user = getCurrentUser();
      if (!user || user.uid !== payment.parent_id) {
        throw new Error('Unauthorized');
      }
      
      const subscription = await getActiveSubscription(payment.parent_id);
      if (!subscription) {
        throw new Error('No active subscription');
      }
      
      const spendQuery = query(
        collection(db, 'monthly_spend'),
        where('parent_id', '==', payment.parent_id),
        where('period_start_utc', '==', subscription.current_period_start_utc)
      );
      const spendSnapshot = await getDocs(spendQuery);
      
      if (spendSnapshot.empty) {
        throw new Error('Monthly spend record not found');
      }
      
      const spendDoc = spendSnapshot.docs[0];
      const spendRef = doc(db, 'monthly_spend', spendDoc.id);
      const spendData = spendDoc.data() as MonthlySpend;
      
      // Check cap again
      if (spendData.spent_cents + payment.intent_cents > subscription.cap_cents) {
        throw new Error('Payment would exceed monthly cap');
      }
      
      // Update payment status
      transaction.update(paymentRef, {
        status: 'confirmed_by_parent',
        confirmed_at: Timestamp.now()
      });
      
      // Update monthly spend atomically
      transaction.update(spendRef, {
        spent_cents: spendData.spent_cents + payment.intent_cents,
        updated_at: Timestamp.now()
      });
      
      return { success: true };
    });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    return { success: false, error: error.message };
  }
};

// Get spending caps for current user with caching
export const getCurrentSpendingCaps = async (): Promise<{
  success: boolean;
  capCents?: number;
  spentCents?: number;
  remainingCents?: number;
  periodStart?: Date;
  periodEnd?: Date;
  error?: string;
}> => {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  try {
    return await cache.getOrFetch(
      CACHE_CONFIGS.SPENDING_CAPS,
      async () => {
        console.log('🔄 Loading fresh spending caps...');
        
        // TESTING: Always return high limits for development
        const TESTING_MODE = true;
        
        if (TESTING_MODE) {
          console.log('🧪 TESTING MODE: Returning default high spending limits');
          return {
            success: true,
            capCents: 10000, // $100 default limit for testing
            spentCents: 0,
            remainingCents: 10000,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
          };
        }

        const subscription = await getActiveSubscription(user.uid);
        if (!subscription) {
          // For testing: provide default high limit when no subscription
          console.log('No subscription found, using default limits for testing');
          return {
            success: true,
            capCents: 10000, // $100 default limit for testing
            spentCents: 0,
            remainingCents: 10000,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
          };
        }

        const periodSpend = await getCurrentPeriodSpend(
          user.uid,
          subscription.current_period_start_utc.toDate(),
          subscription.current_period_end_utc.toDate()
        );

        return {
          success: true,
          capCents: subscription.cap_cents,
          spentCents: periodSpend.spent_cents,
          remainingCents: subscription.cap_cents - periodSpend.spent_cents,
          periodStart: subscription.current_period_start_utc.toDate(),
          periodEnd: subscription.current_period_end_utc.toDate()
        };
      },
      user.uid
    );
  } catch (error: any) {
    console.error('Error getting spending caps:', error);
    return { success: false, error: error.message };
  }
};

// Get payment by ID
export const getPayment = async (paymentId: string): Promise<Payment | null> => {
  try {
    const docRef = doc(db, 'payments', paymentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Payment;
    }
    return null;
  } catch (error) {
    console.error('Error getting payment:', error);
    return null;
  }
};