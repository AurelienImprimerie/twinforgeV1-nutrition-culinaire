/**
 * Unified Validation System - Sprint 2 Phase 3.1
 *
 * RÈGLES CRITIQUES - PROTECTION DES AI AGENTS:
 * 1. ❌ NE JAMAIS modifier les prompts AI
 * 2. ❌ NE JAMAIS modifier les paramètres des modèles AI
 * 3. ❌ NE JAMAIS valider les outputs des AI agents
 * 4. ✅ UNIQUEMENT valider les inputs utilisateur AVANT l'appel AI
 * 5. ✅ UNIQUEMENT valider les paramètres métier (poids, taille, etc.)
 *
 * Ce système protège contre les injections et inputs malformés
 * sans affecter la logique des agents AI.
 */

import { ValidationRules } from './schemas.ts';
import {
  sanitizeHTML,
  sanitizeText,
  sanitizeBase64Image,
  sanitizeNumber,
  sanitizeArray,
  sanitizeObjectKeys,
  sanitizeURL,
  sanitizeUUID,
  sanitizeTimestamp
} from './sanitizers.ts';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: any;
}

export interface ValidationOptions {
  required?: boolean;
  allowEmpty?: boolean;
  customMessage?: string;
}

/**
 * Validate User ID (UUID v4)
 */
export function validateUserId(
  userId: any,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!userId) {
      if (options.required !== false) {
        return { isValid: false, error: 'User ID is required' };
      }
      return { isValid: true, sanitizedValue: null };
    }

    const sanitized = sanitizeUUID(userId);
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || ValidationRules.userId.errorMessage
    };
  }
}

/**
 * Validate base64 image data
 */
export function validateImageData(
  imageData: any,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!imageData) {
      if (options.required !== false) {
        return { isValid: false, error: 'Image data is required' };
      }
      return { isValid: true, sanitizedValue: null };
    }

    if (typeof imageData !== 'string') {
      return { isValid: false, error: 'Image data must be a string' };
    }

    // Validate format
    if (!ValidationRules.image.base64Pattern.test(imageData)) {
      return { isValid: false, error: 'Invalid image format (expected base64 data URL)' };
    }

    // Estimate size (base64 is ~1.37x larger than binary)
    const estimatedSize = (imageData.length * 0.75);
    if (estimatedSize > ValidationRules.image.maxSizeBytes) {
      return {
        isValid: false,
        error: `Image size exceeds ${ValidationRules.image.maxSizeBytes / (1024 * 1024)}MB limit`
      };
    }

    const sanitized = sanitizeBase64Image(imageData);
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || (error instanceof Error ? error.message : ValidationRules.image.errorMessage)
    };
  }
}

/**
 * Validate text input
 */
export function validateTextInput(
  text: any,
  maxLength: number,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!text) {
      if (options.required !== false) {
        return { isValid: false, error: 'Text input is required' };
      }
      return { isValid: true, sanitizedValue: '' };
    }

    if (typeof text !== 'string') {
      return { isValid: false, error: 'Text must be a string' };
    }

    if (text.length > maxLength) {
      return {
        isValid: false,
        error: `Text exceeds maximum length of ${maxLength} characters`
      };
    }

    // Sanitize for safe storage
    const sanitized = sanitizeText(text);

    // Check after sanitization
    if (!options.allowEmpty && sanitized.length === 0) {
      return { isValid: false, error: 'Text cannot be empty after sanitization' };
    }

    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || (error instanceof Error ? error.message : ValidationRules.text.errorMessage)
    };
  }
}

/**
 * Validate numeric value with range
 */
export function validateNumber(
  value: any,
  rangeName: keyof typeof ValidationRules.ranges,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (value === null || value === undefined) {
      if (options.required !== false) {
        return { isValid: false, error: `${rangeName} is required` };
      }
      return { isValid: true, sanitizedValue: null };
    }

    const range = ValidationRules.ranges[rangeName];
    if (!range) {
      return { isValid: false, error: `Unknown range: ${rangeName}` };
    }

    const sanitized = sanitizeNumber(value, range.min, range.max);
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || (error instanceof Error ? error.message : `Invalid ${rangeName}`)
    };
  }
}

/**
 * Validate array of items
 */
export function validateArray<T>(
  items: any,
  minLength: number = 0,
  maxLength: number = 1000,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!items) {
      if (options.required !== false) {
        return { isValid: false, error: 'Array is required' };
      }
      return { isValid: true, sanitizedValue: [] };
    }

    const sanitized = sanitizeArray<T>(items, minLength, maxLength);
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || (error instanceof Error ? error.message : 'Invalid array')
    };
  }
}

/**
 * Validate URL
 */
export function validateURL(
  url: any,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!url) {
      if (options.required !== false) {
        return { isValid: false, error: 'URL is required' };
      }
      return { isValid: true, sanitizedValue: null };
    }

    if (typeof url !== 'string') {
      return { isValid: false, error: 'URL must be a string' };
    }

    if (url.length > ValidationRules.url.maxLength) {
      return { isValid: false, error: 'URL exceeds maximum length' };
    }

    const sanitized = sanitizeURL(url);
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || (error instanceof Error ? error.message : ValidationRules.url.errorMessage)
    };
  }
}

/**
 * Validate timestamp (ISO 8601)
 */
export function validateTimestamp(
  timestamp: any,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!timestamp) {
      if (options.required !== false) {
        return { isValid: false, error: 'Timestamp is required' };
      }
      return { isValid: true, sanitizedValue: null };
    }

    const sanitized = sanitizeTimestamp(timestamp);
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || (error instanceof Error ? error.message : ValidationRules.timestamp.errorMessage)
    };
  }
}

/**
 * Validate barcode
 */
export function validateBarcode(
  barcode: any,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!barcode) {
      if (options.required !== false) {
        return { isValid: false, error: 'Barcode is required' };
      }
      return { isValid: true, sanitizedValue: null };
    }

    if (typeof barcode !== 'string') {
      return { isValid: false, error: 'Barcode must be a string' };
    }

    if (!ValidationRules.barcode.pattern.test(barcode)) {
      return { isValid: false, error: ValidationRules.barcode.errorMessage };
    }

    return { isValid: true, sanitizedValue: barcode };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || ValidationRules.barcode.errorMessage
    };
  }
}

/**
 * Validate object with safe keys
 */
export function validateObjectKeys(
  obj: any,
  allowedPattern: RegExp = /^[a-zA-Z0-9_-]+$/,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    if (!obj) {
      if (options.required !== false) {
        return { isValid: false, error: 'Object is required' };
      }
      return { isValid: true, sanitizedValue: {} };
    }

    const sanitized = sanitizeObjectKeys(obj, allowedPattern);
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return {
      isValid: false,
      error: options.customMessage || (error instanceof Error ? error.message : 'Invalid object keys')
    };
  }
}

/**
 * Helper: Throw error if validation fails
 */
export function throwIfInvalid(result: ValidationResult): void {
  if (!result.isValid) {
    throw new Error(result.error || 'Validation failed');
  }
}

/**
 * Helper: Validate multiple fields at once
 */
export function validateFields(
  validations: Record<string, ValidationResult>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const [field, result] of Object.entries(validations)) {
    if (!result.isValid) {
      isValid = false;
      errors[field] = result.error || 'Validation failed';
    }
  }

  return { isValid, errors };
}

// Re-export sanitizers for direct use when needed
export {
  sanitizeHTML,
  sanitizeText,
  sanitizeBase64Image,
  sanitizeNumber,
  sanitizeArray,
  sanitizeObjectKeys,
  sanitizeURL,
  sanitizeUUID,
  sanitizeTimestamp
};

// Re-export schemas for reference
export { ValidationRules };
