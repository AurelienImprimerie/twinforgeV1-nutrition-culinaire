/**
 * Image Validation - Sprint 2 Phase 3.2
 *
 * Validation spécifique pour les images utilisées dans:
 * - scan-estimate (body scan photos)
 * - meal-analyzer (meal photos)
 * - fridge-scan-vision (fridge photos)
 *
 * RÈGLE: Valider AVANT l'appel aux AI agents Vision
 */

import {
  validateImageData,
  validateArray,
  ValidationResult,
  throwIfInvalid
} from './index.ts';

export interface PhotoValidationOptions {
  minPhotos?: number;
  maxPhotos?: number;
  required?: boolean;
}

/**
 * Validate array of base64 photos
 * Used by scan-estimate and other photo-based functions
 */
export function validatePhotos(
  photos: any,
  options: PhotoValidationOptions = {}
): ValidationResult {
  const {
    minPhotos = 1,
    maxPhotos = 10,
    required = true
  } = options;

  // Validate array structure
  const arrayResult = validateArray(photos, minPhotos, maxPhotos, { required });
  if (!arrayResult.isValid) {
    return arrayResult;
  }

  const photosArray = arrayResult.sanitizedValue as string[];

  // Validate each photo
  const validatedPhotos: string[] = [];
  for (let i = 0; i < photosArray.length; i++) {
    const photoResult = validateImageData(photosArray[i], { required: true });
    if (!photoResult.isValid) {
      return {
        isValid: false,
        error: `Photo ${i + 1}: ${photoResult.error}`
      };
    }
    validatedPhotos.push(photoResult.sanitizedValue as string);
  }

  return {
    isValid: true,
    sanitizedValue: validatedPhotos
  };
}

/**
 * Validate single photo (optional)
 */
export function validateOptionalPhoto(photo: any): ValidationResult {
  if (!photo) {
    return { isValid: true, sanitizedValue: null };
  }

  return validateImageData(photo, { required: false });
}

/**
 * Validate image URL (for already uploaded images)
 */
export function validateImageURL(url: any, options = { required: true }): ValidationResult {
  if (!url) {
    if (options.required) {
      return { isValid: false, error: 'Image URL is required' };
    }
    return { isValid: true, sanitizedValue: null };
  }

  if (typeof url !== 'string') {
    return { isValid: false, error: 'Image URL must be a string' };
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);

    // Only allow https for security
    if (urlObj.protocol !== 'https:') {
      return { isValid: false, error: 'Image URL must use HTTPS' };
    }

    // Check for Supabase storage URLs (trusted source)
    const isSupabaseStorage = urlObj.hostname.includes('supabase.co') &&
                              urlObj.pathname.includes('/storage/v1/object/');

    if (!isSupabaseStorage) {
      return { isValid: false, error: 'Only Supabase storage URLs are allowed' };
    }

    return { isValid: true, sanitizedValue: url };
  } catch {
    return { isValid: false, error: 'Invalid image URL format' };
  }
}

/**
 * Helper: Validate body scan photos
 * Specific validation for scan-estimate function
 */
export function validateBodyScanPhotos(photos: any): {
  isValid: boolean;
  error?: string;
  photos?: string[];
} {
  const result = validatePhotos(photos, {
    minPhotos: 1,
    maxPhotos: 4, // Front, side, back, additional
    required: true
  });

  if (!result.isValid) {
    return { isValid: false, error: result.error };
  }

  return {
    isValid: true,
    photos: result.sanitizedValue as string[]
  };
}

/**
 * Helper: Validate meal photo
 * Specific validation for meal-analyzer function
 */
export function validateMealPhoto(photo: any): {
  isValid: boolean;
  error?: string;
  photo?: string | null;
} {
  const result = validateOptionalPhoto(photo);

  if (!result.isValid) {
    return { isValid: false, error: result.error };
  }

  return {
    isValid: true,
    photo: result.sanitizedValue as string | null
  };
}

/**
 * Helper: Validate fridge scan photos
 * Specific validation for fridge-scan-vision function
 */
export function validateFridgeScanPhotos(photos: any): {
  isValid: boolean;
  error?: string;
  photos?: string[];
} {
  const result = validatePhotos(photos, {
    minPhotos: 1,
    maxPhotos: 20, // Allow multiple fridge shelves
    required: true
  });

  if (!result.isValid) {
    return { isValid: false, error: result.error };
  }

  return {
    isValid: true,
    photos: result.sanitizedValue as string[]
  };
}
