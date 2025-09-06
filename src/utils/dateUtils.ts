/**
 * Date utilities to ensure proper local time handling
 * Avoids timezone issues with Date.toISOString()
 */

/**
 * Get today's date in local timezone as YYYY-MM-DD string
 * This avoids the timezone issues with toISOString()
 */
export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get a date string in local timezone as YYYY-MM-DD
 * @param date - Date object
 */
export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a date string (YYYY-MM-DD) to a Date object in local timezone
 * @param dateString - Date string in YYYY-MM-DD format
 */
export const parseLocalDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Get a date N days ago as YYYY-MM-DD string
 * @param daysAgo - Number of days ago
 */
export const getDateStringDaysAgo = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getLocalDateString(date);
};

/**
 * Format a date for display in the user's locale
 * @param dateString - Date string in YYYY-MM-DD format
 * @param options - Intl.DateTimeFormatOptions
 */
export const formatDateForDisplay = (
  dateString: string, 
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }
): string => {
  const date = parseLocalDateString(dateString);
  return date.toLocaleDateString(undefined, options);
};

/**
 * Check if a date string is today
 * @param dateString - Date string in YYYY-MM-DD format
 */
export const isToday = (dateString: string): boolean => {
  return dateString === getTodayDateString();
};

/**
 * Get the current local time as a formatted string
 * @param options - Intl.DateTimeFormatOptions
 */
export const getCurrentTimeString = (
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }
): string => {
  return new Date().toLocaleTimeString(undefined, options);
};

/**
 * Format time ago in a human-readable way
 * @param timestamp - Date object or timestamp
 */
export const formatTimeAgo = (timestamp: Date | number): string => {
  const now = new Date();
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
};