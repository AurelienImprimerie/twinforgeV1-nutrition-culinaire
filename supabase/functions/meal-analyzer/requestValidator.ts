/**
 * Request Validation - meal-analyzer
 * Sprint 2 Phase 3.2
 *
 * RÈGLE CRITIQUE: Validation des inputs utilisateur UNIQUEMENT.
 * NE TOUCHE PAS aux prompts nutritionnels ou à la logique Vision AI.
 */

import {
  validateUserId,
  validateImageData,
  validateTimestamp
} from '../_shared/validation/index.ts';
import {
  validateScannedProducts,
  validateMealType,
  validateMealDescription
} from '../_shared/validation/nutrition.ts';

/**
 * Validate meal analysis request
 */
export function validateMealAnalysisRequest(request: any): string | null {
  if (!request) {
    return 'Request body is required';
  }

  const { user_id, image_url, image_data, scanned_products, meal_type, timestamp } = request;

  // Validate user_id
  const userIdResult = validateUserId(user_id, { required: true });
  if (!userIdResult.isValid) {
    return userIdResult.error || 'Invalid user ID';
  }

  // Validate that at least one input source is provided
  const hasImageUrl = !!image_url;
  const hasImageData = !!image_data;
  const hasScannedProducts = scanned_products && scanned_products.length > 0;

  if (!hasImageUrl && !hasImageData && !hasScannedProducts) {
    return 'At least one of image_url, image_data, or scanned_products is required';
  }

  // Validate image_data if provided (base64)
  if (image_data) {
    const imageResult = validateImageData(image_data, { required: false });
    if (!imageResult.isValid) {
      return `Image data: ${imageResult.error}`;
    }
  }

  // Validate image_url if provided
  if (image_url) {
    if (typeof image_url !== 'string') {
      return 'Image URL must be a string';
    }

    // Basic URL validation
    try {
      const url = new URL(image_url);
      // Check it's a Supabase storage URL
      const isSupabase = url.hostname.includes('supabase.co');
      if (!isSupabase) {
        return 'Image URL must be from Supabase storage';
      }
    } catch {
      return 'Invalid image URL format';
    }
  }

  // Validate scanned products if provided
  if (scanned_products) {
    const productsResult = validateScannedProducts(scanned_products);
    if (!productsResult.isValid) {
      return `Scanned products: ${productsResult.error}`;
    }
  }

  // Validate meal_type if provided
  if (meal_type) {
    const mealTypeResult = validateMealType(meal_type);
    if (!mealTypeResult.isValid) {
      return `Meal type: ${mealTypeResult.error}`;
    }
  }

  // Validate timestamp if provided
  if (timestamp) {
    const timestampResult = validateTimestamp(timestamp, { required: false });
    if (!timestampResult.isValid) {
      return `Timestamp: ${timestampResult.error}`;
    }
  }

  // Note: user_profile_context is complex and used by AI
  // We don't deeply validate it - AI will use what it needs

  // All validations passed
  return null;
}

/**
 * Sanitize and prepare request data for AI processing
 */
export function sanitizeMealAnalysisRequest(request: any): {
  user_id: string;
  image_url?: string;
  image_data?: string;
  scanned_products?: any[];
  meal_type?: string;
  timestamp?: string;
  user_profile_context?: any;
} {
  // Validation should be done first with validateMealAnalysisRequest()
  const userIdResult = validateUserId(request.user_id, { required: true });

  let sanitizedImageData = null;
  if (request.image_data) {
    const imageResult = validateImageData(request.image_data, { required: false });
    sanitizedImageData = imageResult.sanitizedValue;
  }

  let sanitizedScannedProducts = null;
  if (request.scanned_products) {
    const productsResult = validateScannedProducts(request.scanned_products);
    sanitizedScannedProducts = productsResult.sanitizedValue;
  }

  let sanitizedMealType = 'snack';
  if (request.meal_type) {
    const mealTypeResult = validateMealType(request.meal_type);
    sanitizedMealType = mealTypeResult.sanitizedValue as string;
  }

  let sanitizedTimestamp = null;
  if (request.timestamp) {
    const timestampResult = validateTimestamp(request.timestamp, { required: false });
    sanitizedTimestamp = timestampResult.sanitizedValue;
  }

  return {
    user_id: userIdResult.sanitizedValue as string,
    image_url: request.image_url || undefined,
    image_data: sanitizedImageData || undefined,
    scanned_products: sanitizedScannedProducts || undefined,
    meal_type: sanitizedMealType,
    timestamp: sanitizedTimestamp || undefined,
    user_profile_context: request.user_profile_context // Pass through - used by AI
  };
}
