import validator from 'validator';

// CRITICAL: Input sanitization and validation

export class InputSanitizer {
  // CRITICAL: Sanitize user messages (support requests, wellness notes)
  static sanitizeMessage(input: string, maxLength: number = 2000): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Remove potential XSS - strip HTML tags and dangerous characters
    let sanitized = input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>'"&]/g, '') // Remove dangerous characters
      .replace(/javascript:/gi, '') // Remove javascript: urls
      .replace(/on\w+=/gi, ''); // Remove event handlers
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Enforce length limit
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }
  
  // CRITICAL: Sanitize payment notes (stricter limits)
  static sanitizePaymentNote(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Very strict - only alphanumeric and basic punctuation
    let sanitized = input.replace(/[^a-zA-Z0-9\s.,!?-]/g, '');
    
    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Strict length limit for payment notes
    if (sanitized.length > 140) {
      sanitized = sanitized.substring(0, 140);
    }
    
    return sanitized;
  }
  
  // CRITICAL: Validate wellness entry data
  static validateWellnessEntry(entry: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!entry || typeof entry !== 'object') {
      return { valid: false, errors: ['Invalid entry format'] };
    }
    
    // Validate rankings
    const requiredRankings = ['sleep_ranking', 'nutrition_ranking', 'academics_ranking', 'social_ranking'];
    for (const ranking of requiredRankings) {
      if (!Number.isInteger(entry[ranking]) || entry[ranking] < 1 || entry[ranking] > 4) {
        errors.push(`Invalid ${ranking}: must be integer 1-4`);
      }
    }
    
    // Check for duplicate rankings
    const rankingValues = requiredRankings.map(r => entry[r]).filter(v => Number.isInteger(v));
    const uniqueValues = new Set(rankingValues);
    if (rankingValues.length !== uniqueValues.size) {
      errors.push('Rankings must be unique values 1-4');
    }
    
    // Validate overall mood
    if (!Number.isInteger(entry.overall_mood) || entry.overall_mood < 1 || entry.overall_mood > 10) {
      errors.push('Invalid overall_mood: must be integer 1-10');
    }
    
    // Validate date
    if (!entry.date || !validator.isISO8601(entry.date)) {
      errors.push('Invalid date format: must be ISO8601');
    }
    
    // Validate user_id (should be valid UUID/Firebase UID)
    if (!entry.user_id || typeof entry.user_id !== 'string' || entry.user_id.length < 10) {
      errors.push('Invalid user_id');
    }
    
    // Sanitize notes if present
    if (entry.notes) {
      entry.notes = this.sanitizeMessage(entry.notes, 2000);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  // CRITICAL: Validate payment data
  static validatePaymentData(payment: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!payment || typeof payment !== 'object') {
      return { valid: false, errors: ['Invalid payment format'] };
    }
    
    // Validate amount
    if (!Number.isInteger(payment.amount_cents) || payment.amount_cents <= 0) {
      errors.push('Invalid amount: must be positive integer (cents)');
    }
    
    if (payment.amount_cents > 50000) { // Max $500
      errors.push('Amount exceeds maximum limit ($500)');
    }
    
    // Validate provider
    const allowedProviders = ['paypal', 'venmo', 'cashapp', 'zelle'];
    if (!allowedProviders.includes(payment.provider)) {
      errors.push(`Invalid provider: must be one of ${allowedProviders.join(', ')}`);
    }
    
    // Validate user IDs
    if (!payment.parent_id || typeof payment.parent_id !== 'string') {
      errors.push('Invalid parent_id');
    }
    
    if (!payment.student_id || typeof payment.student_id !== 'string') {
      errors.push('Invalid student_id');
    }
    
    // Validate status
    const allowedStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
    if (!allowedStatuses.includes(payment.status)) {
      errors.push(`Invalid status: must be one of ${allowedStatuses.join(', ')}`);
    }
    
    // Sanitize notes if present
    if (payment.notes) {
      payment.notes = this.sanitizePaymentNote(payment.notes);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  // CRITICAL: Validate email addresses
  static validateEmail(email: string): boolean {
    return validator.isEmail(email) && email.length <= 254;
  }
  
  // CRITICAL: Validate family data
  static validateFamilyData(family: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!family || typeof family !== 'object') {
      return { valid: false, errors: ['Invalid family format'] };
    }
    
    // Validate name
    if (!family.name || typeof family.name !== 'string') {
      errors.push('Family name is required');
    } else if (family.name.length > 100) {
      errors.push('Family name too long (max 100 characters)');
    }
    
    // Validate member arrays
    if (family.parentIds && !Array.isArray(family.parentIds)) {
      errors.push('parentIds must be an array');
    }
    
    if (family.studentIds) {
      if (!Array.isArray(family.studentIds)) {
        errors.push('studentIds must be an array');
      } else if (family.studentIds.length > 10) {
        errors.push('Too many students (max 10 per family)');
      }
    }
    
    // Sanitize name
    if (family.name) {
      family.name = this.sanitizeMessage(family.name, 100);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  // CRITICAL: Rate limiting data structure
  private static rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  
  // CRITICAL: Simple rate limiting
  static checkRateLimit(userId: string, action: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
    const key = `${userId}:${action}`;
    const now = Date.now();
    
    const existing = this.rateLimitMap.get(key);
    
    if (!existing || now > existing.resetTime) {
      // Reset window
      this.rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (existing.count >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    existing.count++;
    return true;
  }
  
  // CRITICAL: Clean up old rate limit entries periodically
  static cleanupRateLimitMap(): void {
    const now = Date.now();
    for (const [key, data] of this.rateLimitMap.entries()) {
      if (now > data.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}

// CRITICAL: Validation middleware for React Native components
export const withInputValidation = <T extends Record<string, any>>(
  validationFn: (data: T) => { valid: boolean; errors: string[] }
) => {
  return (data: T): T => {
    const { valid, errors } = validationFn(data);
    
    if (!valid) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    return data;
  };
};

// Clean up rate limiting map every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    InputSanitizer.cleanupRateLimitMap();
  }, 5 * 60 * 1000);
}