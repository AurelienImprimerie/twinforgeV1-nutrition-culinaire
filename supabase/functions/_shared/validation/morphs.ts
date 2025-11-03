/**
 * Morphology Validation - Sprint 2 Phase 3.2
 *
 * Validation spécifique pour les paramètres morphologiques:
 * - scan-refine-morphs (AI morphology refinement)
 *
 * RÈGLE CRITIQUE: Valider UNIQUEMENT les ranges numériques.
 * NE PAS modifier la logique de raffinement AI.
 */

import {
  validateNumber,
  validateObjectKeys,
  ValidationResult
} from './index.ts';

/**
 * Validate morphology shape parameters (0-1 range)
 */
export function validateShapeParams(
  shapeParams: any
): ValidationResult {
  // Validate it's an object
  if (!shapeParams || typeof shapeParams !== 'object') {
    return { isValid: false, error: 'Shape parameters must be an object' };
  }

  // Validate keys (safe key names)
  const keysResult = validateObjectKeys(shapeParams, /^[a-zA-Z0-9_-]+$/);
  if (!keysResult.isValid) {
    return keysResult;
  }

  // Validate each value is in 0-1 range
  const sanitizedParams: Record<string, number> = {};
  for (const [key, value] of Object.entries(shapeParams)) {
    const numResult = validateNumber(value, 'morph_value', { required: true });
    if (!numResult.isValid) {
      return {
        isValid: false,
        error: `Invalid morph value for key "${key}": ${numResult.error}`
      };
    }
    sanitizedParams[key] = numResult.sanitizedValue as number;
  }

  return {
    isValid: true,
    sanitizedValue: sanitizedParams
  };
}

/**
 * Validate limb masses (kg values)
 */
export function validateLimbMasses(
  limbMasses: any
): ValidationResult {
  // Validate it's an object
  if (!limbMasses || typeof limbMasses !== 'object') {
    return { isValid: false, error: 'Limb masses must be an object' };
  }

  // Validate keys
  const keysResult = validateObjectKeys(limbMasses, /^[a-zA-Z0-9_-]+$/);
  if (!keysResult.isValid) {
    return keysResult;
  }

  // Expected limb keys
  const expectedKeys = [
    'leftArm',
    'rightArm',
    'leftForearm',
    'rightForearm',
    'leftHand',
    'rightHand',
    'leftUpLeg',
    'rightUpLeg',
    'leftLeg',
    'rightLeg',
    'leftFoot',
    'rightFoot'
  ];

  // Validate each limb mass
  const sanitizedMasses: Record<string, number> = {};
  for (const [key, value] of Object.entries(limbMasses)) {
    // Check if key is expected
    if (!expectedKeys.includes(key)) {
      console.warn(`Unexpected limb mass key: ${key}`);
      // Don't fail, just warn - AI might use different naming
    }

    const numResult = validateNumber(value, 'limb_mass_kg', { required: true });
    if (!numResult.isValid) {
      return {
        isValid: false,
        error: `Invalid limb mass for "${key}": ${numResult.error}`
      };
    }
    sanitizedMasses[key] = numResult.sanitizedValue as number;
  }

  return {
    isValid: true,
    sanitizedValue: sanitizedMasses
  };
}

/**
 * Validate K5 envelope (physiological constraints from database)
 * This is the output from morphology mapping, used as constraint
 */
export function validateK5Envelope(
  k5Envelope: any
): ValidationResult {
  if (!k5Envelope) {
    // K5 envelope is optional in some cases
    return { isValid: true, sanitizedValue: null };
  }

  if (typeof k5Envelope !== 'object') {
    return { isValid: false, error: 'K5 envelope must be an object' };
  }

  // Validate keys
  const keysResult = validateObjectKeys(k5Envelope);
  if (!keysResult.isValid) {
    return keysResult;
  }

  // K5 envelope contains min/max bounds for each morph key
  // Structure: { morphKey: { min: number, max: number } }
  const sanitizedEnvelope: Record<string, { min: number; max: number }> = {};

  for (const [key, bounds] of Object.entries(k5Envelope)) {
    if (!bounds || typeof bounds !== 'object') {
      return {
        isValid: false,
        error: `K5 envelope bounds for "${key}" must be an object`
      };
    }

    const typedBounds = bounds as any;

    // Validate min
    const minResult = validateNumber(typedBounds.min, 'morph_value', { required: true });
    if (!minResult.isValid) {
      return {
        isValid: false,
        error: `Invalid K5 min for "${key}": ${minResult.error}`
      };
    }

    // Validate max
    const maxResult = validateNumber(typedBounds.max, 'morph_value', { required: true });
    if (!maxResult.isValid) {
      return {
        isValid: false,
        error: `Invalid K5 max for "${key}": ${maxResult.error}`
      };
    }

    const min = minResult.sanitizedValue as number;
    const max = maxResult.sanitizedValue as number;

    // Validate min <= max
    if (min > max) {
      return {
        isValid: false,
        error: `K5 envelope for "${key}": min (${min}) cannot be greater than max (${max})`
      };
    }

    sanitizedEnvelope[key] = { min, max };
  }

  return {
    isValid: true,
    sanitizedValue: sanitizedEnvelope
  };
}

/**
 * Helper: Validate complete morphology refinement request
 * Used by scan-refine-morphs function
 */
export function validateMorphologyRefinementRequest(request: {
  blend_shape_params?: any;
  blend_limb_masses?: any;
  k5_envelope?: any;
}): {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    blend_shape_params: Record<string, number>;
    blend_limb_masses: Record<string, number>;
    k5_envelope: Record<string, { min: number; max: number }> | null;
  };
} {
  const errors: string[] = [];

  // Validate shape params
  const shapeResult = validateShapeParams(request.blend_shape_params);
  if (!shapeResult.isValid) {
    errors.push(`Shape params: ${shapeResult.error}`);
  }

  // Validate limb masses
  const limbResult = validateLimbMasses(request.blend_limb_masses);
  if (!limbResult.isValid) {
    errors.push(`Limb masses: ${limbResult.error}`);
  }

  // Validate K5 envelope (optional)
  const k5Result = validateK5Envelope(request.k5_envelope);
  if (!k5Result.isValid) {
    errors.push(`K5 envelope: ${k5Result.error}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      blend_shape_params: shapeResult.sanitizedValue as Record<string, number>,
      blend_limb_masses: limbResult.sanitizedValue as Record<string, number>,
      k5_envelope: k5Result.sanitizedValue as Record<string, { min: number; max: number }> | null
    }
  };
}
