/**
 * Date utility functions
 * Provides helper functions for date calculations and formatting
 */

/**
 * Calculate age from birthdate
 * @param birthdate - Date string in ISO format (YYYY-MM-DD)
 * @returns Age in years, or undefined if birthdate is invalid
 */
export function calculateAge(birthdate: string | null | undefined): number | undefined {
  if (!birthdate) {
    return undefined;
  }

  try {
    const birth = new Date(birthdate);
    const today = new Date();

    // Check if date is valid
    if (isNaN(birth.getTime())) {
      return undefined;
    }

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    // Adjust age if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age >= 0 ? age : undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Format date to locale string
 * @param date - Date string or Date object
 * @param locale - Locale string (default: 'fr-FR')
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, locale = 'fr-FR'): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(locale);
  } catch (error) {
    return '';
  }
}

/**
 * Check if a date is today
 * @param date - Date string or Date object
 * @returns True if the date is today
 */
export function isToday(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();

  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}
