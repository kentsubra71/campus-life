/**
 * Utility for converting technical errors into user-friendly messages
 * while logging full details for debugging
 */

interface ErrorResponse {
  userMessage: string;
  shouldLog: boolean;
  severity: 'low' | 'medium' | 'high';
}

// Maps error patterns to user-friendly messages
const ERROR_MAP: Record<string, ErrorResponse> = {
  // Network errors
  'fetch': {
    userMessage: 'Unable to connect to servers. Please check your internet connection.',
    shouldLog: true,
    severity: 'medium'
  },
  'network': {
    userMessage: 'Network connection issue. Please try again.',
    shouldLog: true,
    severity: 'medium'
  },
  'timeout': {
    userMessage: 'Request timed out. Please try again.',
    shouldLog: true,
    severity: 'medium'
  },

  // Firebase/Database errors
  'permission-denied': {
    userMessage: 'You do not have permission to perform this action.',
    shouldLog: true,
    severity: 'high'
  },
  'not-found': {
    userMessage: 'The requested information was not found.',
    shouldLog: false,
    severity: 'low'
  },
  'already-exists': {
    userMessage: 'This item already exists. Please try a different option.',
    shouldLog: false,
    severity: 'low'
  },
  'unavailable': {
    userMessage: 'Service temporarily unavailable. Please try again later.',
    shouldLog: true,
    severity: 'high'
  },

  // Authentication errors
  'user-not-found': {
    userMessage: 'Account not found. Please check your login information.',
    shouldLog: false,
    severity: 'low'
  },
  'wrong-password': {
    userMessage: 'Incorrect password. Please try again.',
    shouldLog: false,
    severity: 'low'
  },
  'too-many-requests': {
    userMessage: 'Too many failed attempts. Please wait before trying again.',
    shouldLog: true,
    severity: 'medium'
  },
  'weak-password': {
    userMessage: 'Password is too weak. Please choose a stronger password.',
    shouldLog: false,
    severity: 'low'
  },

  // PayPal errors
  'paypal': {
    userMessage: 'Payment processing issue. Please try again or use a different method.',
    shouldLog: true,
    severity: 'medium'
  },
  'payment-failed': {
    userMessage: 'Payment could not be completed. Please check your payment details.',
    shouldLog: true,
    severity: 'medium'
  },
  'insufficient-funds': {
    userMessage: 'Insufficient funds. Please check your account balance.',
    shouldLog: false,
    severity: 'low'
  },

  // Validation errors
  'invalid-email': {
    userMessage: 'Please enter a valid email address.',
    shouldLog: false,
    severity: 'low'
  },
  'invalid-phone': {
    userMessage: 'Please enter a valid phone number.',
    shouldLog: false,
    severity: 'low'
  },
  'missing-required': {
    userMessage: 'Please fill in all required fields.',
    shouldLog: false,
    severity: 'low'
  },

  // Default fallbacks
  'unknown': {
    userMessage: 'An unexpected error occurred. Please try again.',
    shouldLog: true,
    severity: 'medium'
  }
};

/**
 * Convert any error into a user-friendly message
 * @param error - The error object or message
 * @param context - Optional context for better error mapping
 * @returns User-friendly error message
 */
export const getUserFriendlyError = (error: any, context?: string): string => {
  let errorMessage = '';
  let errorCode = '';

  // Extract error message and code from different error formats
  if (typeof error === 'string') {
    errorMessage = error.toLowerCase();
  } else if (error?.message) {
    errorMessage = error.message.toLowerCase();
    errorCode = error.code || '';
  } else if (error?.error) {
    errorMessage = error.error.toLowerCase();
  } else {
    errorMessage = 'unknown error';
  }

  // Find matching error pattern
  for (const [pattern, response] of Object.entries(ERROR_MAP)) {
    if (errorMessage.includes(pattern) || errorCode.includes(pattern)) {
      // Log technical details if needed
      if (response.shouldLog) {
        console.error(`[${response.severity.toUpperCase()}] Error in ${context || 'unknown'}:`, error);
      }
      return response.userMessage;
    }
  }

  // Default fallback
  console.error('[MEDIUM] Unmapped error in', context || 'unknown', ':', error);
  return ERROR_MAP.unknown.userMessage;
};

/**
 * Log error for debugging without exposing to user
 * @param error - The error to log
 * @param context - Context where error occurred
 * @param additionalInfo - Additional debugging info
 */
export const logError = (error: any, context: string, additionalInfo?: any) => {
  console.error(`[ERROR] ${context}:`, {
    error: error?.message || error,
    stack: error?.stack,
    code: error?.code,
    additionalInfo,
    timestamp: new Date().toISOString()
  });
};

/**
 * Show user-friendly alert for errors
 * @param error - The error object
 * @param context - Context for better error mapping
 * @param title - Optional custom title
 */
export const showUserFriendlyError = (
  error: any, 
  context: string, 
  title: string = 'Error'
): void => {
  const userMessage = getUserFriendlyError(error, context);
  logError(error, context);

  // Import Alert dynamically to avoid circular dependencies
  import('react-native').then(({ Alert }) => {
    Alert.alert(title, userMessage, [{ text: 'OK' }]);
  });
};

/**
 * Wrapper for async operations with user-friendly error handling
 * @param operation - The async operation to execute
 * @param context - Context for error logging
 * @param fallbackValue - Value to return on error
 */
export const withUserFriendlyError = async <T>(
  operation: () => Promise<T>,
  context: string,
  fallbackValue?: T
): Promise<T | typeof fallbackValue> => {
  try {
    return await operation();
  } catch (error) {
    showUserFriendlyError(error, context);
    return fallbackValue as T;
  }
};

/**
 * Common error scenarios and their user messages
 */
export const COMMON_ERRORS = {
  NETWORK_OFFLINE: 'You appear to be offline. Please check your internet connection.',
  SERVER_ERROR: 'Our servers are experiencing issues. Please try again later.',
  INVALID_INPUT: 'Please check your input and try again.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  NOT_AUTHENTICATED: 'Please log in to continue.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  MAINTENANCE: 'The app is currently under maintenance. Please try again later.',
} as const;