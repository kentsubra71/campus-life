interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface PaymentData {
  amount: string;
  provider: 'paypal' | 'venmo' | 'cashapp' | 'zelle' | null;
  note: string;
  studentId: string;
}

// Payment validation rules
const VALIDATION_RULES = {
  MIN_AMOUNT_CENTS: 100,        // $1.00
  MAX_AMOUNT_CENTS: 50000000,   // $500,000
  MAX_NOTE_LENGTH: 500,
  ALLOWED_PROVIDERS: ['paypal', 'venmo', 'cashapp', 'zelle'] as const,
  
  // Daily/monthly limits (in cents)
  DAILY_LIMIT_CENTS: 500000,   // $5,000 per day
  MONTHLY_LIMIT_CENTS: 2000000, // $20,000 per month
  
  // Suspicious activity thresholds
  LARGE_AMOUNT_WARNING_CENTS: 100000, // $1,000
  FREQUENT_PAYMENT_WARNING_COUNT: 10,  // 10 payments in 24 hours
};

export const validatePaymentInput = (data: PaymentData): PaymentValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Amount validation
  const amountNumber = parseFloat(data.amount);
  const amountCents = Math.round(amountNumber * 100);

  if (!data.amount || data.amount.trim() === '') {
    errors.push('Payment amount is required');
  } else if (isNaN(amountNumber) || amountNumber <= 0) {
    errors.push('Payment amount must be a valid positive number');
  } else if (amountCents < VALIDATION_RULES.MIN_AMOUNT_CENTS) {
    errors.push(`Minimum payment amount is $${VALIDATION_RULES.MIN_AMOUNT_CENTS / 100}.00`);
  } else if (amountCents > VALIDATION_RULES.MAX_AMOUNT_CENTS) {
    errors.push(`Maximum payment amount is $${VALIDATION_RULES.MAX_AMOUNT_CENTS / 100}.00`);
  }

  // Large amount warning
  if (amountCents >= VALIDATION_RULES.LARGE_AMOUNT_WARNING_CENTS) {
    warnings.push(`Large payment amount: $${amountNumber.toFixed(2)}. Please verify this is correct.`);
  }

  // Provider validation
  if (!data.provider) {
    errors.push('Payment provider is required');
  } else if (!VALIDATION_RULES.ALLOWED_PROVIDERS.includes(data.provider)) {
    errors.push(`Invalid payment provider: ${data.provider}`);
  }

  // Note validation
  if (data.note && data.note.length > VALIDATION_RULES.MAX_NOTE_LENGTH) {
    errors.push(`Payment note too long (max ${VALIDATION_RULES.MAX_NOTE_LENGTH} characters)`);
  }

  // Sanitize note for harmful content
  if (data.note && containsSuspiciousContent(data.note)) {
    errors.push('Payment note contains inappropriate content');
  }

  // Student ID validation
  if (!data.studentId || data.studentId.trim() === '') {
    errors.push('Student selection is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validatePaymentAmount = (amountStr: string): { isValid: boolean; error?: string } => {
  if (!amountStr || amountStr.trim() === '') {
    return { isValid: false, error: 'Amount is required' };
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: 'Amount must be a positive number' };
  }

  const cents = Math.round(amount * 100);
  
  if (cents < VALIDATION_RULES.MIN_AMOUNT_CENTS) {
    return { isValid: false, error: `Minimum amount is $${VALIDATION_RULES.MIN_AMOUNT_CENTS / 100}.00` };
  }

  if (cents > VALIDATION_RULES.MAX_AMOUNT_CENTS) {
    return { isValid: false, error: `Maximum amount is $${VALIDATION_RULES.MAX_AMOUNT_CENTS / 100}.00` };
  }

  return { isValid: true };
};

export const sanitizePaymentNote = (note: string): string => {
  if (!note) return '';
  
  return note
    .trim()
    .substring(0, VALIDATION_RULES.MAX_NOTE_LENGTH)
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript URLs
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
};

export const formatPaymentAmount = (amount: string): string => {
  // Remove non-numeric characters except decimal point
  const cleanAmount = amount.replace(/[^\d.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleanAmount.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts[1];
  }
  
  // Limit decimal places to 2
  if (parts[1] && parts[1].length > 2) {
    return parts[0] + '.' + parts[1].substring(0, 2);
  }
  
  return cleanAmount;
};

// Check for suspicious content in notes
const containsSuspiciousContent = (text: string): boolean => {
  const suspiciousPatterns = [
    /script/gi,
    /javascript/gi,
    /vbscript/gi,
    /onload/gi,
    /onerror/gi,
    /onclick/gi,
    /<.*>/gi,
    /eval\(/gi,
    /document\./gi,
    /window\./gi,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(text));
};

// Rate limiting helpers
export const checkPaymentRateLimit = async (
  userId: string, 
  amountCents: number
): Promise<{ allowed: boolean; reason?: string }> => {
  // This would typically check against a database
  // For now, return a simple implementation
  
  try {
    // Get user's recent payments (last 24 hours)
    const { collection, query, where, getDocs, Timestamp } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentPaymentsQuery = query(
      collection(db, 'payments'),
      where('parent_id', '==', userId),
      where('created_at', '>=', Timestamp.fromDate(yesterday))
    );
    
    const snapshot = await getDocs(recentPaymentsQuery);
    const recentPayments = snapshot.docs.map(doc => doc.data());
    
    // Check daily frequency limit
    if (recentPayments.length >= VALIDATION_RULES.FREQUENT_PAYMENT_WARNING_COUNT) {
      return { 
        allowed: false, 
        reason: `Daily payment limit reached (${VALIDATION_RULES.FREQUENT_PAYMENT_WARNING_COUNT} payments)` 
      };
    }
    
    // Check daily amount limit
    const totalDailyAmount = recentPayments.reduce((sum, payment) => sum + payment.intent_cents, 0);
    if (totalDailyAmount + amountCents > VALIDATION_RULES.DAILY_LIMIT_CENTS) {
      const remaining = (VALIDATION_RULES.DAILY_LIMIT_CENTS - totalDailyAmount) / 100;
      return { 
        allowed: false, 
        reason: `Daily spending limit would be exceeded. Remaining: $${remaining.toFixed(2)}` 
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Allow payment if check fails (don't block user due to technical issues)
    return { allowed: true };
  }
};

export { VALIDATION_RULES };