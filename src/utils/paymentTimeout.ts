import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';

/**
 * Payment timeout configuration
 */
export const PAYMENT_TIMEOUT_CONFIG = {
  // Different timeout periods for different providers
  PAYPAL_TIMEOUT_HOURS: 24 * 7, // 1 week
  VENMO_TIMEOUT_HOURS: 24 * 3,  // 3 days
  ZELLE_TIMEOUT_HOURS: 24 * 2,  // 2 days
  CASHAPP_TIMEOUT_HOURS: 24 * 2, // 2 days
  
  // Default timeout if provider not specified
  DEFAULT_TIMEOUT_HOURS: 24 * 7, // 1 week
  
  // How often to run cleanup (in hours)
  CLEANUP_INTERVAL_HOURS: 6, // Every 6 hours
  
  // Statuses that should be cleaned up
  CLEANUP_STATUSES: ['initiated', 'pending', 'processing']
} as const;

/**
 * Get timeout hours for a specific provider
 */
export const getTimeoutHours = (provider: string): number => {
  switch (provider?.toLowerCase()) {
    case 'paypal': return PAYMENT_TIMEOUT_CONFIG.PAYPAL_TIMEOUT_HOURS;
    case 'venmo': return PAYMENT_TIMEOUT_CONFIG.VENMO_TIMEOUT_HOURS;
    case 'zelle': return PAYMENT_TIMEOUT_CONFIG.ZELLE_TIMEOUT_HOURS;
    case 'cashapp': return PAYMENT_TIMEOUT_CONFIG.CASHAPP_TIMEOUT_HOURS;
    default: return PAYMENT_TIMEOUT_CONFIG.DEFAULT_TIMEOUT_HOURS;
  }
};

/**
 * Check if a payment has timed out
 */
export const isPaymentTimedOut = (
  createdAt: Date, 
  provider: string
): boolean => {
  if (!createdAt || !createdAt.getTime) {
    return false; // Can't timeout if no valid creation date
  }
  
  const timeoutHours = getTimeoutHours(provider);
  const timeoutMs = timeoutHours * 60 * 60 * 1000;
  const now = new Date();
  
  return (now.getTime() - createdAt.getTime()) > timeoutMs;
};

/**
 * Get human-readable timeout duration
 */
export const getTimeoutDuration = (provider: string): string => {
  const hours = getTimeoutHours(provider);
  
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''}`;
};

/**
 * Find and cleanup timed out payments
 */
export const cleanupTimedOutPayments = async (): Promise<{
  cleaned: number;
  errors: number;
  details: { id: string; provider: string; age: string; error?: string }[];
}> => {
  const results = {
    cleaned: 0,
    errors: 0,
    details: [] as { id: string; provider: string; age: string; error?: string }[]
  };

  try {
    console.log('🧹 Starting payment timeout cleanup...');
    
    // Query for payments that might be timed out
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('status', 'in', PAYMENT_TIMEOUT_CONFIG.CLEANUP_STATUSES)
    );
    
    const snapshot = await getDocs(paymentsQuery);
    console.log(`🔍 Found ${snapshot.size} payments to check for timeout`);
    
    for (const paymentDoc of snapshot.docs) {
      const payment = paymentDoc.data();
      const paymentId = paymentDoc.id;
      
      // Skip if no created_at timestamp
      if (!payment.created_at) {
        console.warn(`⚠️ Payment ${paymentId} missing created_at timestamp`);
        continue;
      }
      
      const createdAt = payment.created_at && payment.created_at.toDate ? payment.created_at.toDate() : null;
      if (!createdAt) {
        console.warn(`⚠️ Payment ${paymentId} has invalid created_at timestamp`);
        continue;
      }
      
      const provider = payment.provider || 'unknown';
      const ageMs = new Date().getTime() - createdAt.getTime();
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
      const ageDays = Math.floor(ageHours / 24);
      const ageString = ageDays > 0 ? `${ageDays}d ${ageHours % 24}h` : `${ageHours}h`;
      
      if (isPaymentTimedOut(createdAt, provider)) {
        try {
          // Mark payment as timed out
          await updateDoc(doc(db, 'payments', paymentId), {
            status: 'timeout',
            timeout_at: Timestamp.now(),
            timeout_reason: `Auto-timeout after ${getTimeoutDuration(provider)}`,
            original_status: payment.status,
            updated_at: Timestamp.now()
          });
          
          results.cleaned++;
          results.details.push({
            id: paymentId,
            provider,
            age: ageString
          });
          
          console.log(`⏰ Timed out payment ${paymentId} (${provider}, ${ageString} old)`);
          
        } catch (error) {
          results.errors++;
          results.details.push({
            id: paymentId,
            provider,
            age: ageString,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          console.error(`❌ Failed to timeout payment ${paymentId}:`, error);
        }
      } else {
        // Log remaining time for debugging
        const timeoutHours = getTimeoutHours(provider);
        const remainingMs = (timeoutHours * 60 * 60 * 1000) - ageMs;
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        
        if (remainingHours <= 12) { // Log if within 12 hours of timeout
          console.log(`⏳ Payment ${paymentId} (${provider}) will timeout in ${remainingHours}h`);
        }
      }
    }
    
    console.log(`🧹 Cleanup complete: ${results.cleaned} cleaned, ${results.errors} errors`);
    
  } catch (error) {
    console.error('❌ Payment cleanup failed:', error);
    results.errors++;
  }
  
  return results;
};

/**
 * Check if a payment is close to timing out (within warning threshold)
 */
export const isPaymentNearTimeout = (
  createdAt: Date,
  provider: string,
  warningHours: number = 12
): boolean => {
  if (!createdAt || !createdAt.getTime) {
    return false; // Can't be near timeout if no valid creation date
  }
  
  const timeoutHours = getTimeoutHours(provider);
  const warningMs = (timeoutHours - warningHours) * 60 * 60 * 1000;
  const now = new Date();
  
  return (now.getTime() - createdAt.getTime()) > warningMs;
};

/**
 * Get time remaining until timeout
 */
export const getTimeUntilTimeout = (
  createdAt: Date,
  provider: string
): { hours: number; minutes: number; expired: boolean } => {
  if (!createdAt || !createdAt.getTime) {
    return { hours: 0, minutes: 0, expired: true }; // Treat invalid dates as expired
  }
  
  const timeoutHours = getTimeoutHours(provider);
  const timeoutMs = timeoutHours * 60 * 60 * 1000;
  const now = new Date();
  const elapsedMs = now.getTime() - createdAt.getTime();
  const remainingMs = timeoutMs - elapsedMs;
  
  if (remainingMs <= 0) {
    return { hours: 0, minutes: 0, expired: true };
  }
  
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes, expired: false };
};

/**
 * Format time remaining for display
 */
export const formatTimeRemaining = (createdAt: Date, provider: string): string => {
  if (!createdAt || !createdAt.getTime) {
    return 'Invalid Date';
  }
  
  const remaining = getTimeUntilTimeout(createdAt, provider);
  
  if (remaining.expired) {
    return 'Expired';
  }
  
  if (remaining.hours > 24) {
    const days = Math.floor(remaining.hours / 24);
    return `${days}d ${remaining.hours % 24}h remaining`;
  }
  
  if (remaining.hours > 0) {
    return `${remaining.hours}h ${remaining.minutes}m remaining`;
  }
  
  return `${remaining.minutes}m remaining`;
};