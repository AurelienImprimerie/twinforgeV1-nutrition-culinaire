/**
 * Input Sanitizers - Nettoyage des inputs utilisateur
 *
 * RÈGLE CRITIQUE: Sanitize UNIQUEMENT les inputs utilisateur, pas les outputs AI.
 */

/**
 * Sanitize HTML from text input to prevent XSS
 */
export function sanitizeHTML(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize text for safe storage and display
 * Removes control characters and normalizes whitespace
 */
export function sanitizeText(text: string): string {
  if (!text) return '';

  return text
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize base64 image data
 * Validates format and removes potential injection attempts
 */
export function sanitizeBase64Image(data: string): string {
  if (!data) return '';

  // Extract only the base64 data part (after the comma)
  const matches = data.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);

  if (!matches) {
    throw new Error('Invalid base64 image format');
  }

  const [, format, base64Data] = matches;

  // Validate base64 characters only
  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
    throw new Error('Invalid base64 characters detected');
  }

  return `data:image/${format.toLowerCase()};base64,${base64Data}`;
}

/**
 * Sanitize numeric input
 * Ensures value is a valid number within bounds
 */
export function sanitizeNumber(
  value: any,
  min?: number,
  max?: number
): number {
  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    throw new Error(`Invalid number: ${value}`);
  }

  if (min !== undefined && num < min) {
    throw new Error(`Number ${num} below minimum ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new Error(`Number ${num} above maximum ${max}`);
  }

  return num;
}

/**
 * Sanitize array input
 * Ensures value is an array and validates length
 */
export function sanitizeArray<T>(
  value: any,
  minLength: number = 0,
  maxLength: number = 1000
): T[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected array');
  }

  if (value.length < minLength) {
    throw new Error(`Array length ${value.length} below minimum ${minLength}`);
  }

  if (value.length > maxLength) {
    throw new Error(`Array length ${value.length} above maximum ${maxLength}`);
  }

  return value;
}

/**
 * Sanitize object keys
 * Validates that all keys match expected pattern
 */
export function sanitizeObjectKeys(
  obj: Record<string, any>,
  allowedPattern: RegExp = /^[a-zA-Z0-9_-]+$/
): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Expected object');
  }

  const invalidKeys = Object.keys(obj).filter(key => !allowedPattern.test(key));

  if (invalidKeys.length > 0) {
    throw new Error(`Invalid keys detected: ${invalidKeys.join(', ')}`);
  }

  return obj;
}

/**
 * Sanitize URL
 * Validates URL format and protocol
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';

  // Only allow https and http protocols
  if (!url.match(/^https?:\/\//i)) {
    throw new Error('Invalid URL protocol (only http/https allowed)');
  }

  try {
    const urlObj = new URL(url);

    // Prevent javascript: and data: URLs
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      throw new Error('Invalid URL protocol');
    }

    return urlObj.toString();
  } catch (error) {
    throw new Error(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize UUID
 * Validates UUID v4 format
 */
export function sanitizeUUID(uuid: string): string {
  if (!uuid) {
    throw new Error('UUID is required');
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(uuid)) {
    throw new Error('Invalid UUID format');
  }

  return uuid.toLowerCase();
}

/**
 * Sanitize ISO 8601 timestamp
 */
export function sanitizeTimestamp(timestamp: string): string {
  if (!timestamp) {
    throw new Error('Timestamp is required');
  }

  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

  if (!isoPattern.test(timestamp)) {
    throw new Error('Invalid ISO 8601 timestamp format');
  }

  // Validate it's a valid date
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp value');
  }

  return timestamp;
}
