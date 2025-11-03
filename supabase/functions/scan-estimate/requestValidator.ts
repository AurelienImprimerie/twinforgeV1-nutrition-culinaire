/**
 * Request Validation - scan-estimate
 * Enhanced with unified validation system (Sprint 2 Phase 3.2)
 *
 * RÈGLE CRITIQUE: Validation des inputs UNIQUEMENT.
 * Ne touche PAS à la logique Vision AI ou aux prompts.
 */

import {
  validateUserId,
  validateNumber,
  validateArray,
  ValidationRules
} from '../_shared/validation/index.ts';

/**
 * Validate scan estimate request
 */
export function validateEstimateRequest(request: any): string | null {
  if (!request) {
    return 'Request body is required';
  }

  const { user_id, photos, user_declared_height_cm, user_declared_weight_kg, user_declared_gender } = request;

  // Validate user_id with unified system
  const userIdResult = validateUserId(user_id, { required: true });
  if (!userIdResult.isValid) {
    return userIdResult.error || 'Invalid user ID';
  }

  // Validate photos array
  const photosResult = validateArray(photos, 1, 4, { required: true });
  if (!photosResult.isValid) {
    return photosResult.error || 'Invalid photos array';
  }

  const photosArray = photosResult.sanitizedValue as any[];

  // Validate each photo structure
  for (let i = 0; i < photosArray.length; i++) {
    const photo = photosArray[i];

    if (!photo || typeof photo !== 'object') {
      return `Photo ${i + 1}: Must be an object`;
    }

    // Validate view
    if (!photo.view || !['front', 'profile', 'side', 'back'].includes(photo.view)) {
      return `Photo ${i + 1}: View must be "front", "profile", "side", or "back"`;
    }

    // Validate URL (Supabase storage URL)
    if (!photo.url || typeof photo.url !== 'string') {
      return `Photo ${i + 1}: URL is required`;
    }

    // Basic URL validation
    try {
      const url = new URL(photo.url);
      // Check it's a Supabase storage URL or base64 data
      const isSupabase = url.hostname.includes('supabase.co');
      const isDataURL = photo.url.startsWith('data:image/');

      if (!isSupabase && !isDataURL) {
        return `Photo ${i + 1}: URL must be from Supabase storage or base64 data`;
      }
    } catch {
      // Might be base64, check that
      if (!photo.url.startsWith('data:image/')) {
        return `Photo ${i + 1}: Invalid URL format`;
      }
    }

    // Validate report exists (required for body scan)
    if (!photo.report) {
      return `Photo ${i + 1}: Report is required`;
    }
  }

  // Validate height with unified system
  const heightResult = validateNumber(user_declared_height_cm, 'height_cm', { required: true });
  if (!heightResult.isValid) {
    return `Height: ${heightResult.error}`;
  }

  // Validate weight with unified system
  const weightResult = validateNumber(user_declared_weight_kg, 'weight_kg', { required: true });
  if (!weightResult.isValid) {
    return `Weight: ${weightResult.error}`;
  }

  // Validate gender
  if (!user_declared_gender || !['masculine', 'feminine'].includes(user_declared_gender)) {
    return 'Gender must be "masculine" or "feminine"';
  }

  // All validations passed
  return null;
}

/**
 * Sanitize and prepare request data for AI processing
 * Returns sanitized data ready for Vision AI
 */
export function sanitizeEstimateRequest(request: any): {
  user_id: string;
  photos: any[];
  user_declared_height_cm: number;
  user_declared_weight_kg: number;
  user_declared_gender: 'masculine' | 'feminine';
} {
  // Validation should be done first with validateEstimateRequest()
  const userIdResult = validateUserId(request.user_id, { required: true });
  const heightResult = validateNumber(request.user_declared_height_cm, 'height_cm', { required: true });
  const weightResult = validateNumber(request.user_declared_weight_kg, 'weight_kg', { required: true });

  return {
    user_id: userIdResult.sanitizedValue as string,
    photos: request.photos, // Photos are complex objects, passed through
    user_declared_height_cm: heightResult.sanitizedValue as number,
    user_declared_weight_kg: weightResult.sanitizedValue as number,
    user_declared_gender: request.user_declared_gender
  };
}
