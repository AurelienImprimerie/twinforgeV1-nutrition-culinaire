/**
 * Request Validation - scan-commit
 * Enhanced with unified validation system (Sprint 3 Phase 3.2)
 *
 * RÈGLE CRITIQUE: Validation des données de scan UNIQUEMENT.
 * Ne touche PAS aux résultats des AI agents (estimate, semantic, refinement).
 */

import {
  validateUserId,
  ValidationResult
} from '../_shared/validation/index.ts';
import {
  validateShapeParams,
  validateLimbMasses
} from '../_shared/validation/morphs.ts';

/**
 * Validate scan commit request
 */
export function validateCommitRequest(request: any): string | null {
  if (!request) {
    return 'Request body is required';
  }

  const {
    user_id,
    estimate_result,
    match_result,
    semantic_result,
    final_shape_params,
    final_limb_masses,
    ai_refinement_result,
    skin_tone,
    resolved_gender
  } = request;

  // Validate user_id with unified system
  const userIdResult = validateUserId(user_id, { required: true });
  if (!userIdResult.isValid) {
    return userIdResult.error || 'Invalid user ID';
  }

  // Validate estimate_result exists (AI output - don't deep validate)
  if (!estimate_result || typeof estimate_result !== 'object') {
    return 'Valid estimate_result is required';
  }

  // Validate shape_params from estimate (ranges only)
  if (estimate_result.shape_params) {
    const shapeResult = validateShapeParams(estimate_result.shape_params);
    if (!shapeResult.isValid) {
      return `Estimate shape params: ${shapeResult.error}`;
    }
  }

  // Validate limb_masses from estimate (ranges only)
  if (estimate_result.limb_masses) {
    const limbResult = validateLimbMasses(estimate_result.limb_masses);
    if (!limbResult.isValid) {
      return `Estimate limb masses: ${limbResult.error}`;
    }
  }

  // Validate match_result exists (DB output - don't deep validate)
  if (!match_result || typeof match_result !== 'object') {
    return 'Valid match_result is required';
  }

  // Validate semantic_result exists (AI output - don't deep validate)
  if (!semantic_result || typeof semantic_result !== 'object') {
    return 'Valid semantic_result is required';
  }

  // CRITICAL: Validate final_shape_params (post-AI refinement or blend)
  if (final_shape_params) {
    const finalShapeResult = validateShapeParams(final_shape_params);
    if (!finalShapeResult.isValid) {
      return `Final shape params: ${finalShapeResult.error}`;
    }
  }

  // CRITICAL: Validate final_limb_masses (post-AI refinement or blend)
  if (final_limb_masses) {
    const finalLimbResult = validateLimbMasses(final_limb_masses);
    if (!finalLimbResult.isValid) {
      return `Final limb masses: ${finalLimbResult.error}`;
    }
  }

  // Validate skin_tone if present (0-1 range or object)
  if (skin_tone !== undefined && skin_tone !== null) {
    if (typeof skin_tone === 'number') {
      if (!Number.isFinite(skin_tone) || skin_tone < 0 || skin_tone > 1) {
        return 'Skin tone must be between 0 and 1';
      }
    } else if (typeof skin_tone === 'object') {
      // Multi-zone skin tone - validate each zone
      for (const [zone, value] of Object.entries(skin_tone)) {
        if (typeof value === 'number') {
          if (!Number.isFinite(value) || value < 0 || value > 1) {
            return `Skin tone ${zone} must be between 0 and 1`;
          }
        }
      }
    } else if (typeof skin_tone !== 'string') {
      // Allow string for legacy hex values
      return 'Skin tone must be a number, object, or string';
    }
  }

  // Validate resolved_gender
  if (resolved_gender && !['masculine', 'feminine'].includes(resolved_gender)) {
    return 'Gender must be "masculine" or "feminine"';
  }

  // Validate ai_refinement_result if present (AI output - just log)
  if (ai_refinement_result && typeof ai_refinement_result === 'object') {
    console.log('✅ [requestValidator] AI refinement result present', {
      ai_refine: ai_refinement_result.ai_refine,
      hasFinalShapeParams: !!ai_refinement_result.final_shape_params,
      hasFinalLimbMasses: !!ai_refinement_result.final_limb_masses,
      philosophy: 'ai_refinement_validation'
    });
  }

  // All validations passed
  return null;
}

/**
 * Sanitize and prepare commit data for storage
 * Returns sanitized data ready for DB insertion
 */
export function sanitizeCommitRequest(request: any): {
  user_id: string;
  estimate_result: any;
  match_result: any;
  semantic_result: any;
  final_shape_params?: Record<string, number>;
  final_limb_masses?: Record<string, number>;
  [key: string]: any;
} {
  // Validation should be done first with validateCommitRequest()
  const userIdResult = validateUserId(request.user_id, { required: true });

  let sanitizedFinalShape = undefined;
  if (request.final_shape_params) {
    const shapeResult = validateShapeParams(request.final_shape_params);
    sanitizedFinalShape = shapeResult.sanitizedValue as Record<string, number>;
  }

  let sanitizedFinalLimb = undefined;
  if (request.final_limb_masses) {
    const limbResult = validateLimbMasses(request.final_limb_masses);
    sanitizedFinalLimb = limbResult.sanitizedValue as Record<string, number>;
  }

  return {
    user_id: userIdResult.sanitizedValue as string,
    estimate_result: request.estimate_result,
    match_result: request.match_result,
    semantic_result: request.semantic_result,
    final_shape_params: sanitizedFinalShape,
    final_limb_masses: sanitizedFinalLimb,
    // Pass through other fields as-is (AI outputs, metadata)
    ...Object.fromEntries(
      Object.entries(request).filter(([key]) =>
        !['user_id', 'estimate_result', 'match_result', 'semantic_result',
          'final_shape_params', 'final_limb_masses'].includes(key)
      )
    )
  };
}
