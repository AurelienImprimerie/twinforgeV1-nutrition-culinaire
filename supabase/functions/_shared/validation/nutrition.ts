/**
 * Nutrition Validation - Sprint 2 Phase 3.2
 *
 * Validation spécifique pour:
 * - meal-analyzer (meal analysis with AI)
 *
 * RÈGLE CRITIQUE: Valider UNIQUEMENT les inputs utilisateur.
 * NE PAS toucher aux prompts nutritionnels ou à la logique AI.
 */

import {
  validateTextInput,
  validateBarcode,
  validateArray,
  ValidationResult
} from './index.ts';

/**
 * Validate scanned product data from barcode
 */
export function validateScannedProduct(product: any): ValidationResult {
  if (!product || typeof product !== 'object') {
    return { isValid: false, error: 'Scanned product must be an object' };
  }

  // Validate barcode
  const barcodeResult = validateBarcode(product.barcode, { required: true });
  if (!barcodeResult.isValid) {
    return { isValid: false, error: `Barcode: ${barcodeResult.error}` };
  }

  // Validate product name
  const nameResult = validateTextInput(product.name, 200, { required: true });
  if (!nameResult.isValid) {
    return { isValid: false, error: `Product name: ${nameResult.error}` };
  }

  // Validate brand (optional)
  let sanitizedBrand = null;
  if (product.brand) {
    const brandResult = validateTextInput(product.brand, 200, { required: false });
    if (!brandResult.isValid) {
      return { isValid: false, error: `Brand: ${brandResult.error}` };
    }
    sanitizedBrand = brandResult.sanitizedValue;
  }

  // Validate portion multiplier (optional, default 1)
  let portionMultiplier = 1;
  if (product.portionMultiplier !== undefined) {
    if (typeof product.portionMultiplier !== 'number' || product.portionMultiplier <= 0) {
      return { isValid: false, error: 'Portion multiplier must be a positive number' };
    }
    portionMultiplier = product.portionMultiplier;
  }

  return {
    isValid: true,
    sanitizedValue: {
      barcode: barcodeResult.sanitizedValue,
      name: nameResult.sanitizedValue,
      brand: sanitizedBrand,
      portionMultiplier,
      mealItem: product.mealItem // Pass through - validated by AI
    }
  };
}

/**
 * Validate array of scanned products
 */
export function validateScannedProducts(products: any): ValidationResult {
  if (!products) {
    return { isValid: true, sanitizedValue: null };
  }

  // Validate array
  const arrayResult = validateArray(products, 0, 50);
  if (!arrayResult.isValid) {
    return arrayResult;
  }

  const productsArray = arrayResult.sanitizedValue as any[];

  // Validate each product
  const sanitizedProducts: any[] = [];
  for (let i = 0; i < productsArray.length; i++) {
    const productResult = validateScannedProduct(productsArray[i]);
    if (!productResult.isValid) {
      return {
        isValid: false,
        error: `Product ${i + 1}: ${productResult.error}`
      };
    }
    sanitizedProducts.push(productResult.sanitizedValue);
  }

  return {
    isValid: true,
    sanitizedValue: sanitizedProducts
  };
}

/**
 * Validate meal type
 */
export function validateMealType(mealType: any): ValidationResult {
  if (!mealType) {
    return { isValid: true, sanitizedValue: 'snack' }; // Default
  }

  const validTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

  if (!validTypes.includes(mealType)) {
    return {
      isValid: false,
      error: `Invalid meal type. Must be one of: ${validTypes.join(', ')}`
    };
  }

  return { isValid: true, sanitizedValue: mealType };
}

/**
 * Validate user description of meal (optional text input)
 */
export function validateMealDescription(description: any): ValidationResult {
  if (!description) {
    return { isValid: true, sanitizedValue: null };
  }

  return validateTextInput(description, 2000, { required: false });
}

/**
 * Helper: Validate complete meal analysis request
 * Used by meal-analyzer function
 */
export function validateMealAnalysisRequest(request: {
  image_data?: any;
  image_url?: any;
  scanned_products?: any;
  meal_type?: any;
  user_description?: any;
}): {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    image_data: string | null;
    image_url: string | null;
    scanned_products: any[] | null;
    meal_type: string;
    user_description: string | null;
  };
} {
  const errors: string[] = [];

  // Note: image validation is done by images.ts
  // We just pass through here

  // Validate scanned products
  const productsResult = validateScannedProducts(request.scanned_products);
  if (!productsResult.isValid) {
    errors.push(`Scanned products: ${productsResult.error}`);
  }

  // Validate meal type
  const mealTypeResult = validateMealType(request.meal_type);
  if (!mealTypeResult.isValid) {
    errors.push(`Meal type: ${mealTypeResult.error}`);
  }

  // Validate description
  const descriptionResult = validateMealDescription(request.user_description);
  if (!descriptionResult.isValid) {
    errors.push(`Description: ${descriptionResult.error}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      image_data: request.image_data || null,
      image_url: request.image_url || null,
      scanned_products: productsResult.sanitizedValue as any[] | null,
      meal_type: mealTypeResult.sanitizedValue as string,
      user_description: descriptionResult.sanitizedValue as string | null
    }
  };
}

/**
 * Validate nutritional values (for manual input or verification)
 */
export function validateNutritionalValues(values: {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}): ValidationResult {
  const sanitized: any = {};

  // Validate calories (0-5000 kcal)
  if (values.calories !== undefined) {
    if (typeof values.calories !== 'number' || values.calories < 0 || values.calories > 5000) {
      return { isValid: false, error: 'Calories must be between 0 and 5000' };
    }
    sanitized.calories = values.calories;
  }

  // Validate protein (0-500g)
  if (values.protein !== undefined) {
    if (typeof values.protein !== 'number' || values.protein < 0 || values.protein > 500) {
      return { isValid: false, error: 'Protein must be between 0 and 500g' };
    }
    sanitized.protein = values.protein;
  }

  // Validate carbs (0-1000g)
  if (values.carbs !== undefined) {
    if (typeof values.carbs !== 'number' || values.carbs < 0 || values.carbs > 1000) {
      return { isValid: false, error: 'Carbs must be between 0 and 1000g' };
    }
    sanitized.carbs = values.carbs;
  }

  // Validate fat (0-500g)
  if (values.fat !== undefined) {
    if (typeof values.fat !== 'number' || values.fat < 0 || values.fat > 500) {
      return { isValid: false, error: 'Fat must be between 0 and 500g' };
    }
    sanitized.fat = values.fat;
  }

  return { isValid: true, sanitizedValue: sanitized };
}
