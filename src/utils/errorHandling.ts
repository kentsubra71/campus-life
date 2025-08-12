import { Alert } from 'react-native';

export interface AppError {
  code: string;
  message: string;
  context?: string;
}

export const createError = (code: string, message: string, context?: string): AppError => ({
  code,
  message,
  context
});

export const handleFirebaseError = (error: any, context: string = ''): AppError => {
  switch (error.code) {
    case 'permission-denied':
      return createError('PERMISSION_DENIED', 'Access denied. Please check your permissions.', context);
    case 'not-found':
      return createError('NOT_FOUND', 'Requested data not found.', context);
    case 'failed-precondition':
      return createError('MISSING_INDEX', 'Database optimization in progress. Please try again.', context);
    case 'unavailable':
      return createError('NETWORK_ERROR', 'Network unavailable. Please check your connection.', context);
    case 'unauthenticated':
      return createError('AUTH_ERROR', 'Please log in again.', context);
    default:
      return createError('UNKNOWN_ERROR', error.message || 'An unexpected error occurred.', context);
  }
};

export const showErrorAlert = (error: AppError) => {
  Alert.alert(
    'Error',
    error.message,
    [{ text: 'OK' }],
    { cancelable: true }
  );
};

export const logError = (error: AppError) => {
  console.error(`[${error.code}] ${error.context ? `${error.context}: ` : ''}${error.message}`);
};

export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  context: string,
  showAlert: boolean = false
): Promise<{ data?: T; error?: AppError }> => {
  try {
    const data = await operation();
    return { data };
  } catch (err: any) {
    const error = handleFirebaseError(err, context);
    logError(error);
    
    if (showAlert) {
      showErrorAlert(error);
    }
    
    return { error };
  }
};

export const executeWithFallback = async <T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  context: string
): Promise<T> => {
  try {
    return await primary();
  } catch (error: any) {
    console.log(`Primary operation failed in ${context}, trying fallback`);
    try {
      return await fallback();
    } catch (fallbackError: any) {
      console.error(`Both primary and fallback failed in ${context}`);
      throw handleFirebaseError(fallbackError, context);
    }
  }
};