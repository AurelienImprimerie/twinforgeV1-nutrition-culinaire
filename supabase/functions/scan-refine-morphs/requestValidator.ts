/**
 * Request Validation - scan-refine-morphs
 * Enhanced with unified validation system (Sprint 2 Phase 3.2)
 *
 * RÈGLE CRITIQUE: Validation des inputs UNIQUEMENT.
 * NE TOUCHE PAS à la logique AI de raffinement morphologique.
 * NE TOUCHE PAS aux prompts OpenAI.
 */

import {
  validateUserId,
  validateNumber,
  validateArray
} from '../_shared/validation/index.ts';
import {
  validateShapeParams,
  validateLimbMasses,
  validateK5Envelope
} from '../_shared/validation/morphs.ts';

/**
 * PHASE B: Validate AI refinement request with K=5 envelope requirements
 */
export function validateRefineRequest(request: any): string | null {
  if (!request) {
    return 'Request body is required';
  }

  const {
    scan_id,
    user_id,
    resolvedGender,
    photos,
    blend_shape_params,
    blend_limb_masses,
    mapping_version,
    k5_envelope,
    vision_classification,
    user_measurements
  } = request;

  // Validate scan_id (UUID)
  const scanIdResult = validateUserId(scan_id, { required: true });
  if (!scanIdResult.isValid) {
    return `Scan ID: ${scanIdResult.error}`;
  }

  // Validate user_id (UUID)
  const userIdResult = validateUserId(user_id, { required: true });
  if (!userIdResult.isValid) {
    return `User ID: ${userIdResult.error}`;
  }

  // Validate gender
  if (!resolvedGender || !['masculine', 'feminine'].includes(resolvedGender)) {
    return 'Gender must be "masculine" or "feminine"';
  }

  // PHASE B: Validate K=5 envelope with unified system
  if (!k5_envelope || typeof k5_envelope !== 'object') {
    return 'K5 envelope is required for PHASE B AI refinement';
  }

  // Validate shape params envelope
  if (!k5_envelope.shape_params_envelope) {
    return 'K5 envelope must contain shape_params_envelope';
  }
  const shapeEnvelopeResult = validateK5Envelope(k5_envelope.shape_params_envelope);
  if (!shapeEnvelopeResult.isValid) {
    return `Shape params envelope: ${shapeEnvelopeResult.error}`;
  }

  // Validate limb masses envelope
  if (!k5_envelope.limb_masses_envelope) {
    return 'K5 envelope must contain limb_masses_envelope';
  }
  const limbEnvelopeResult = validateK5Envelope(k5_envelope.limb_masses_envelope);
  if (!limbEnvelopeResult.isValid) {
    return `Limb masses envelope: ${limbEnvelopeResult.error}`;
  }

  // Validate envelope metadata
  if (!k5_envelope.envelope_metadata || !Array.isArray(k5_envelope.envelope_metadata.archetypes_used)) {
    return 'K5 envelope metadata with archetypes_used array is required';
  }

  // PHASE B: Validate vision classification
  if (!vision_classification || typeof vision_classification !== 'object') {
    return 'Vision classification is required for PHASE B AI refinement';
  }

  const requiredVisionFields = ['muscularity', 'obesity', 'morphotype', 'level'];
  for (const field of requiredVisionFields) {
    if (!vision_classification[field] || typeof vision_classification[field] !== 'string') {
      return `Vision classification.${field} is required`;
    }
  }

  // Validate photos
  const photosResult = validateArray(photos, 1, 4, { required: true });
  if (!photosResult.isValid) {
    return `Photos: ${photosResult.error}`;
  }

  const photosArray = photosResult.sanitizedValue as any[];
  for (let i = 0; i < photosArray.length; i++) {
    const photo = photosArray[i];
    if (!photo.view || !['front', 'profile', 'side', 'back'].includes(photo.view)) {
      return `Photo ${i + 1}: View must be "front", "profile", "side", or "back"`;
    }
    if (!photo.url || typeof photo.url !== 'string') {
      return `Photo ${i + 1}: URL is required`;
    }
  }

  // Validate blend_shape_params with unified system
  const shapeParamsResult = validateShapeParams(blend_shape_params);
  if (!shapeParamsResult.isValid) {
    return `Blend shape params: ${shapeParamsResult.error}`;
  }

  // Validate blend_limb_masses with unified system
  const limbMassesResult = validateLimbMasses(blend_limb_masses);
  if (!limbMassesResult.isValid) {
    return `Blend limb masses: ${limbMassesResult.error}`;
  }

  // Validate mapping_version
  if (!mapping_version || typeof mapping_version !== 'string') {
    return 'Mapping version is required';
  }

  // Validate user_measurements (optional but recommended)
  if (user_measurements) {
    if (typeof user_measurements !== 'object') {
      return 'User measurements must be an object';
    }

    // Validate height
    if (user_measurements.height_cm !== undefined) {
      const heightResult = validateNumber(user_measurements.height_cm, 'height_cm', { required: false });
      if (!heightResult.isValid) {
        return `User measurements height: ${heightResult.error}`;
      }
    }

    // Validate weight
    if (user_measurements.weight_kg !== undefined) {
      const weightResult = validateNumber(user_measurements.weight_kg, 'weight_kg', { required: false });
      if (!weightResult.isValid) {
        return `User measurements weight: ${weightResult.error}`;
      }
    }

    // Validate BMI
    if (user_measurements.estimated_bmi !== undefined) {
      const bmiResult = validateNumber(user_measurements.estimated_bmi, 'bmi', { required: false });
      if (!bmiResult.isValid) {
        return `User measurements BMI: ${bmiResult.error}`;
      }
    }

    // Validate raw measurements
    if (user_measurements.raw_measurements) {
      const raw = user_measurements.raw_measurements;
      if (typeof raw !== 'object') {
        return 'Raw measurements must be an object';
      }

      // Validate waist, chest, hips (cm)
      const measurements = ['waist_cm', 'chest_cm', 'hips_cm'];
      for (const m of measurements) {
        if (raw[m] !== undefined) {
          if (typeof raw[m] !== 'number' || raw[m] < 30 || raw[m] > 300) {
            return `Raw measurement ${m} must be between 30 and 300 cm`;
          }
        }
      }
    }
  }

  // All validations passed
  return null;
}

/**
 * Sanitize and prepare request data for AI processing
 * Returns sanitized data ready for OpenAI refinement
 */
export function sanitizeRefineRequest(request: any): {
  scan_id: string;
  user_id: string;
  resolvedGender: 'masculine' | 'feminine';
  photos: any[];
  blend_shape_params: Record<string, number>;
  blend_limb_masses: Record<string, number>;
  mapping_version: string;
  k5_envelope: any;
  vision_classification: any;
  user_measurements?: any;
} {
  // Validation should be done first with validateRefineRequest()
  const scanIdResult = validateUserId(request.scan_id, { required: true });
  const userIdResult = validateUserId(request.user_id, { required: true });
  const shapeParamsResult = validateShapeParams(request.blend_shape_params);
  const limbMassesResult = validateLimbMasses(request.blend_limb_masses);

  return {
    scan_id: scanIdResult.sanitizedValue as string,
    user_id: userIdResult.sanitizedValue as string,
    resolvedGender: request.resolvedGender,
    photos: request.photos,
    blend_shape_params: shapeParamsResult.sanitizedValue as Record<string, number>,
    blend_limb_masses: limbMassesResult.sanitizedValue as Record<string, number>,
    mapping_version: request.mapping_version,
    k5_envelope: request.k5_envelope,
    vision_classification: request.vision_classification,
    user_measurements: request.user_measurements
  };
}
