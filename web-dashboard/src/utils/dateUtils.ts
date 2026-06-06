/**
 * Date formatting utility functions
 * Centralized date formatting for consistent display across the application
 */

import { format, formatDistanceToNow, formatDistanceStrict } from 'date-fns';

/**
 * Format date for display in cards/lists (short format)
 * Example: "Oct 28, 2025"
 */
export const formatDateShort = (date: string | Date | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMM dd, yyyy');
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date with time (medium format)
 * Example: "Oct 28, 2025, 12:12 PM"
 */
export const formatDateTime = (date: string | Date | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMM dd, yyyy, hh:mm a');
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date with time (24-hour format)
 * Example: "Oct 28, 2025, 12:12"
 */
export const formatDateTime24 = (date: string | Date | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMM dd, yyyy, HH:mm');
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date for map popups (compact format)
 * Example: "Oct 28, 2025, 12:12 PM"
 */
export const formatDateForMap = (dateString?: string): string => {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy, hh:mm a');
  } catch {
    return 'Unknown';
  }
};

/**
 * Format relative time (e.g., "3 days ago", "2 hours ago")
 */
export const formatRelativeTime = (date: string | Date | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format relative time with strict formatting
 */
export const formatRelativeTimeStrict = (date: string | Date | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceStrict(d, new Date(), { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export const formatDateForInput = (date: string | Date | undefined): string => {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

/**
 * Format time only (HH:mm)
 */
export const formatTime = (date: string | Date | undefined): string => {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'HH:mm');
  } catch {
    return 'Invalid time';
  }
};

/**
 * Format date and time separately (for display in two lines)
 */
export const formatDateAndTime = (date: string | Date | undefined): { date: string; time: string } => {
  if (!date) return { date: 'N/A', time: 'N/A' };
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return {
      date: format(d, 'MMM dd, yyyy'),
      time: format(d, 'hh:mm a'),
    };
  } catch {
    return { date: 'Invalid date', time: 'Invalid time' };
  }
};


