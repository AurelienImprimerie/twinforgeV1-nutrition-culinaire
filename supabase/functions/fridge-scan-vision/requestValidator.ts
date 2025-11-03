/**
 * Request Validation - fridge-scan-vision
 * Sprint 3 Phase 3.2
 *
 * RÈGLE CRITIQUE: Validation des images UNIQUEMENT.
 * NE TOUCHE PAS aux prompts Vision AI ou à la logique de détection.
 */

import {
  validateUserId,
  validateArray
} from '../_shared/validation/index.ts';
import {
  validatePhotos
} from '../_shared/validation/images.ts';

/**
 * Validate fridge scan vision request
 */
export function validateFridgeScanRequest(request: any): string | null {
  if (!request) {
    return 'Request body is required';
  }

  const { image_base64, user_id } = request;

  // Validate user_id
  const userIdResult = validateUserId(user_id, { required: true });
  if (!userIdResult.isValid) {
    return userIdResult.error || 'Invalid user ID';
  }

  // Validate image_base64 array
  if (!image_base64 || !Array.isArray(image_base64)) {
    return 'image_base64 must be an array';
  }

  // Validate photos (1-20 images for fridge scanning)
  const photosResult = validatePhotos(image_base64, {
    minPhotos: 1,
    maxPhotos: 20,
    required: true
  });

  if (!photosResult.isValid) {
    return photosResult.error || 'Invalid photos array';
  }

  // All validations passed
  return null;
}

/**
 * Sanitize and prepare request data for AI processing
 */
export function sanitizeFridgeScanRequest(request: any): {
  image_base64: string[];
  user_id: string;
} {
  // Validation should be done first with validateFridgeScanRequest()
  const userIdResult = validateUserId(request.user_id, { required: true });
  const photosResult = validatePhotos(request.image_base64, {
    minPhotos: 1,
    maxPhotos: 20,
    required: true
  });

  return {
    user_id: userIdResult.sanitizedValue as string,
    image_base64: photosResult.sanitizedValue as string[]
  };
}
