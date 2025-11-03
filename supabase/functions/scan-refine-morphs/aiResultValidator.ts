// supabase/functions/scan-refine-morphs/validation/aiResultValidator.ts
/**
 * AI Result Validator - Phase B Implementation
 * Validates and clamps AI refinement results with K=5 envelope and DB bounds
 */ export async function validateAndClampAIResults(aiResult, mappingData, k5_envelope, resolvedGender, vision_classification, traceId) {
  // PHASE 1: Strict input validation
  if (!aiResult) {
    throw new Error('AI result is null or undefined');
  }
  if (!aiResult.final_shape_params || typeof aiResult.final_shape_params !== 'object') {
    throw new new Error('AI result missing or invalid final_shape_params');
  }
  if (!aiResult.final_limb_masses || typeof aiResult.final_limb_masses !== 'object') {
    throw new Error('AI result missing or invalid final_limb_masses');
  }
  if (!mappingData || !mappingData.morph_values || !mappingData.limb_masses) {
    throw new Error('Mapping data is invalid or incomplete');
  }
  if (!k5_envelope || !k5_envelope.shape_params_envelope || !k5_envelope.limb_masses_envelope) {
    throw new Error('K5 envelope is invalid or incomplete');
  }
  console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Starting strict AI results validation:`, {
    resolvedGender,
    aiShapeParamsCount: Object.keys(aiResult.final_shape_params).length,
    aiLimbMassesCount: Object.keys(aiResult.final_limb_masses).length,
    k5EnvelopeShapeKeys: Object.keys(k5_envelope.shape_params_envelope).length,
    k5EnvelopeLimbKeys: Object.keys(k5_envelope.limb_masses_envelope).length,
    inputValidationPassed: true,
    philosophy: 'phase_b_strict_k5_envelope_db_validation'
  });
  const validatedShapeParams = {};
  const validatedLimbMasses = {};
  const clamped_keys = [];
  const envelope_violations = [];
  const db_violations = [];
  const gender_violations = []; // Added for clarity
  const missing_keys_added = [];
  const extra_keys_removed = [];
  let out_of_range_count = 0;
  // STEP 1: Process shape parameters with strict DB allowlisting
  console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Processing shape parameters with strict allowlisting`);
  // First, remove any extra keys not in DB
  Object.keys(aiResult.final_shape_params).forEach((key)=>{
    if (!(key in mappingData.morph_values)) {
      extra_keys_removed.push(key);
      console.log(`🚫 [aiResultValidator] [${traceId}] PHASE B: Removed extra key not in DB:`, {
        key,
        value: aiResult.final_shape_params[key],
        reason: 'key_not_in_db_mapping',
        philosophy: 'phase_b_strict_db_allowlisting'
      });
    }
  });
  // Process all DB-authorized shape parameters
  for (const [key, dbRange] of Object.entries(mappingData.morph_values)){
    let value = aiResult.final_shape_params[key];
    // Log initial value from AI
    console.log(`🔍 [aiResultValidator] [${traceId}] Processing shape param "${key}". AI value: ${value !== undefined && value !== null ? value.toFixed(3) : 'undefined'}. DB Range: [${dbRange.min.toFixed(3)}, ${dbRange.max.toFixed(3)}]`);
    // Handle missing keys from AI response
    if (value === undefined || value === null) {
      // Use 0 if it's within range, otherwise use middle of range
      value = dbRange.min <= 0 && dbRange.max >= 0 ? 0 : (dbRange.min + dbRange.max) / 2;
      missing_keys_added.push(key);
      console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Added missing shape param:`, {
        key,
        defaultValue: value.toFixed(3),
        dbRange: `[${dbRange.min}, ${dbRange.max}]`,
        reason: 'missing_from_ai_response'
      });
    }
    // Validate value is a finite number
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      value = dbRange.min <= 0 && dbRange.max >= 0 ? 0 : (dbRange.min + dbRange.max) / 2;
      clamped_keys.push(key);
      out_of_range_count++;
      console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Fixed invalid shape param (NaN/Infinity):`, {
        key,
        invalidValue: aiResult.final_shape_params[key],
        fixedValue: value.toFixed(3),
        reason: 'invalid_number_from_ai'
      });
    }
    // STEP 1A: Clamp to K=5 envelope bounds FIRST (priority 1)
    const k5Range = k5_envelope.shape_params_envelope[key];
    if (k5Range) {
      const originalValueBeforeK5Clamp = value;
      value = Math.max(k5Range.min, Math.min(k5Range.max, value));
      if (Math.abs(originalValueBeforeK5Clamp - value) > 0.001) {
        envelope_violations.push(key);
        console.log(`🚫 [aiResultValidator] [${traceId}] PHASE B: K=5 ENVELOPE VIOLATION - Clamped:`, {
          key,
          originalValue: originalValueBeforeK5Clamp.toFixed(3),
          clampedValue: value.toFixed(3),
          k5Range: `[${k5Range.min.toFixed(3)}, ${k5Range.max.toFixed(3)}]`,
          reason: 'ai_value_outside_k5_envelope',
          priority: 'envelope_constraint_violation'
        });
        out_of_range_count++;
      }
    }
    // STEP 1B: Final clamp to DB bounds (priority 2)
    const originalValueBeforeDBClamp = value;
    value = Math.max(dbRange.min, Math.min(dbRange.max, value));
    if (Math.abs(originalValueBeforeDBClamp - value) > 0.001) {
      db_violations.push(key);
      console.log(`🔒 [aiResultValidator] [${traceId}] PHASE B: DB BOUNDS VIOLATION - Clamped:`, {
        key,
        originalValue: originalValueBeforeDBClamp.toFixed(3),
        clampedValue: value.toFixed(3),
        dbRange: `[${dbRange.min}, ${dbRange.max}]`,
        reason: 'ai_value_outside_db_physiological_bounds',
        priority: 'db_physiological_constraint'
      });
      out_of_range_count++;
    }
    validatedShapeParams[key] = value;
  }
  // STEP 2: Process limb masses with strict DB allowlisting
  console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Processing limb masses with strict allowlisting`);
  // First, remove any extra keys not in DB
  Object.keys(aiResult.final_limb_masses).forEach((key)=>{
    if (!(key in mappingData.limb_masses)) {
      extra_keys_removed.push(key);
      console.log(`🚫 [aiResultValidator] [${traceId}] PHASE B: Removed extra limb mass key not in DB:`, {
        key,
        value: aiResult.final_limb_masses[key],
        reason: 'key_not_in_db_mapping',
        philosophy: 'phase_b_strict_db_allowlisting'
      });
    }
  });
  // Process all DB-authorized limb masses
  for (const [key, dbRange] of Object.entries(mappingData.limb_masses)){
    let value = aiResult.final_limb_masses[key];
    // Log initial value from AI
    console.log(`🔍 [aiResultValidator] [${traceId}] Processing limb mass "${key}". AI value: ${value !== undefined && value !== null ? value.toFixed(3) : 'undefined'}. DB Range: [${dbRange.min.toFixed(3)}, ${dbRange.max.toFixed(3)}]`);
    // Handle missing keys from AI response
    if (value === undefined || value === null) {
      // Use 1.0 for gate and most limb masses, otherwise use middle of range
      value = key === 'gate' ? 1.0 : dbRange.min <= 1.0 && dbRange.max >= 1.0 ? 1.0 : (dbRange.min + dbRange.max) / 2;
      missing_keys_added.push(key);
      console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Added missing limb mass:`, {
        key,
        defaultValue: value.toFixed(3),
        dbRange: `[${dbRange.min}, ${dbRange.max}]`,
        reason: 'missing_from_ai_response'
      });
    }
    // Validate value is a finite number
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      value = key === 'gate' ? 1.0 : dbRange.min <= 1.0 && dbRange.max >= 1.0 ? 1.0 : (dbRange.min + dbRange.max) / 2;
      clamped_keys.push(key);
      out_of_range_count++;
      console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Fixed invalid limb mass (NaN/Infinity):`, {
        key,
        invalidValue: aiResult.final_limb_masses[key],
        fixedValue: value.toFixed(3),
        reason: 'invalid_number_from_ai'
      });
    }
    // STEP 2A: Clamp to K=5 envelope bounds FIRST (priority 1)
    const k5Range = k5_envelope.limb_masses_envelope[key];
    if (k5Range) {
      const originalValueBeforeK5Clamp = value;
      value = Math.max(k5Range.min, Math.min(k5Range.max, value));
      if (Math.abs(originalValueBeforeK5Clamp - value) > 0.001) {
        envelope_violations.push(key);
        console.log(`🚫 [aiResultValidator] [${traceId}] PHASE B: K=5 ENVELOPE VIOLATION - Clamped limb mass:`, {
          key,
          originalValue: originalValueBeforeK5Clamp.toFixed(3),
          clampedValue: value.toFixed(3),
          k5Range: `[${k5Range.min.toFixed(3)}, ${k5Range.max.toFixed(3)}]`,
          reason: 'ai_value_outside_k5_envelope',
          priority: 'envelope_constraint_violation'
        });
        out_of_range_count++;
      }
    }
    // STEP 2B: Final clamp to DB bounds (priority 2)
    const originalValueBeforeDBClamp = value;
    value = Math.max(dbRange.min, Math.min(dbRange.max, value));
    if (Math.abs(originalValueBeforeDBClamp - value) > 0.001) {
      db_violations.push(key);
      console.log(`🔒 [aiResultValidator] [${traceId}] PHASE B: DB BOUNDS VIOLATION - Clamped limb mass:`, {
        key,
        originalValue: originalValueBeforeDBClamp.toFixed(3),
        clampedValue: value.toFixed(3),
        dbRange: `[${dbRange.min}, ${dbRange.max}]`,
        reason: 'ai_value_outside_db_physiological_bounds',
        priority: 'db_physiological_constraint'
      });
      out_of_range_count++;
    }
    validatedLimbMasses[key] = value;
  }
  // STEP 3: Apply strict gender-specific constraints (Defense in Depth)
  console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Applying strict gender-specific constraints`);
  if (resolvedGender === 'masculine') {
    // CONSTRAINT 1: breastsSmall must never exceed 1.0 for masculine avatars
    if ('breastsSmall' in validatedShapeParams) {
      const originalBreastsSmall = validatedShapeParams.breastsSmall;
      if (originalBreastsSmall > 1.0) {
        validatedShapeParams.breastsSmall = 1.0;
        gender_violations.push('breastsSmall');
        clamped_keys.push('breastsSmall');
        out_of_range_count++;
        console.log(`🚫 [aiResultValidator] [${traceId}] GENDER CONSTRAINT VIOLATION - breastsSmall clamped:`, {
          originalValue: originalBreastsSmall.toFixed(3),
          clampedValue: '1.000',
          reason: 'masculine_physiological_limit_exceeded',
          constraint: 'breastsSmall_max_1.0_for_masculine',
          priority: 'gender_physiological_constraint'
        });
      }
    }
    // CONSTRAINT 2: superBreast must be 0.0 or negative for masculine avatars
    if ('superBreast' in validatedShapeParams) {
      const originalSuperBreast = validatedShapeParams.superBreast;
      if (originalSuperBreast > 0.0) {
        validatedShapeParams.superBreast = 0.0;
        gender_violations.push('superBreast');
        clamped_keys.push('superBreast');
        out_of_range_count++;
        console.log(`🚫 [aiResultValidator] [${traceId}] GENDER CONSTRAINT VIOLATION - superBreast clamped:`, {
          originalValue: originalSuperBreast.toFixed(3),
          clampedValue: '0.000',
          reason: 'masculine_anatomy_positive_superBreast_forbidden',
          constraint: 'superBreast_max_0.0_for_masculine',
          priority: 'gender_physiological_constraint'
        });
      }
    }
    console.log(`🔒 [aiResultValidator] [${traceId}] PHASE B: Masculine gender constraints applied:`, {
      genderViolationsCount: gender_violations.length,
      genderViolations: gender_violations,
      breastsSmallFinal: validatedShapeParams.breastsSmall?.toFixed(3) || 'not_present',
      superBreastFinal: validatedShapeParams.superBreast?.toFixed(3) || 'not_present',
      philosophy: 'masculine_physiological_constraints_enforced'
    });
  }
  // STEP 3: Apply semantic coherence validation (PHASE B enhanced)
  console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Applying enhanced semantic coherence validation`);
  const semanticCorrections = applyEnhancedSemanticCoherence(validatedShapeParams, validatedLimbMasses, resolvedGender, k5_envelope, vision_classification, traceId); // Pass vision_classification
  semanticCorrections.forEach((correction)=>{
    if (correction.type === 'shape_param') {
      validatedShapeParams[correction.key] = correction.correctedValue;
    } else if (correction.type === 'limb_mass') {
      validatedLimbMasses[correction.key] = correction.correctedValue;
    }
    clamped_keys.push(correction.key);
    out_of_range_count++;
    console.log(`🔒 [aiResultValidator] [${traceId}] PHASE B: Applied semantic coherence correction:`, {
      type: correction.type,
      key: correction.key,
      originalValue: correction.originalValue.toFixed(3),
      correctedValue: correction.correctedValue.toFixed(3),
      reason: correction.reason
    });
  });
  console.log(`✅ [aiResultValidator] [${traceId}] PHASE B: Strict validation completed:`, {
    validatedShapeParamsCount: Object.keys(validatedShapeParams).length,
    validatedLimbMassesCount: Object.keys(validatedLimbMasses).length,
    envelopeViolationsCount: envelope_violations.length,
    dbViolationsCount: db_violations.length,
    genderViolationsCount: gender_violations.length,
    totalClampedKeys: clamped_keys.length,
    outOfRangeCount: out_of_range_count,
    missingKeysAddedCount: missing_keys_added.length,
    extra_keys_removed_count: extra_keys_removed.length,
    finalValidationPassed: true,
    philosophy: 'phase_b_strict_validation_complete'
  });
  // Build detailed clamping metadata for audit trail
  const clampingMetadata = {
    envelope_violations: envelope_violations.map(key => ({
      key,
      original_value: aiResult.final_shape_params[key] || aiResult.final_limb_masses[key],
      clamped_value: validatedShapeParams[key] || validatedLimbMasses[key],
      envelope_range: k5_envelope.shape_params_envelope[key] || k5_envelope.limb_masses_envelope[key],
      reason: 'k5_envelope_constraint',
      priority: 1
    })),
    db_violations: db_violations.map(key => ({
      key,
      original_value: aiResult.final_shape_params[key] || aiResult.final_limb_masses[key],
      clamped_value: validatedShapeParams[key] || validatedLimbMasses[key],
      db_range: mappingData.morph_values[key] || mappingData.limb_masses[key],
      reason: 'db_physiological_constraint',
      priority: 2
    })),
    gender_violations: gender_violations.map(key => ({
      key,
      original_value: aiResult.final_shape_params[key],
      clamped_value: validatedShapeParams[key],
      constraint: key === 'breastsSmall' ? 'max_1.0_for_masculine' : 'max_0.0_for_masculine',
      reason: 'gender_physiological_constraint',
      priority: 3
    })),
    semantic_corrections: semanticCorrections.map(correction => ({
      key: correction.key,
      type: correction.type,
      original_value: correction.originalValue,
      corrected_value: correction.correctedValue,
      reason: correction.reason,
      priority: 4
    })),
    missing_keys: missing_keys_added.map(key => ({
      key,
      default_value: validatedShapeParams[key] || validatedLimbMasses[key],
      reason: 'missing_from_ai_response'
    })),
    removed_keys: extra_keys_removed,
    total_transformations: clamped_keys.length + missing_keys_added.length + extra_keys_removed.length,
    validation_status: envelope_violations.length > 0 || db_violations.length > 0 || gender_violations.length > 0 ? 'transformations_applied' : 'no_transformations',
    philosophy: 'complete_audit_trail'
  };

  console.log(`📊 [aiResultValidator] [${traceId}] PHASE B: Clamping metadata generated:`, {
    envelopeViolationsCount: clampingMetadata.envelope_violations.length,
    dbViolationsCount: clampingMetadata.db_violations.length,
    genderViolationsCount: clampingMetadata.gender_violations.length,
    semanticCorrectionsCount: clampingMetadata.semantic_corrections.length,
    missingKeysCount: clampingMetadata.missing_keys.length,
    removedKeysCount: clampingMetadata.removed_keys.length,
    totalTransformations: clampingMetadata.total_transformations,
    philosophy: 'audit_trail_complete'
  });

  // PHASE 1: Final validation of result structure
  const result = {
    final_shape_params: validatedShapeParams,
    final_limb_masses: validatedLimbMasses,
    clamped_keys,
    envelope_violations,
    db_violations,
    gender_violations,
    out_of_range_count,
    missing_keys_added,
    extra_keys_removed,
    clamping_metadata: clampingMetadata
  };
  // PHASE 1: Ensure result structure is complete
  if (Object.keys(result.final_shape_params).length === 0) {
    throw new Error('Validation resulted in empty final_shape_params');
  }
  if (Object.keys(result.final_limb_masses).length === 0) {
    throw new Error('Validation resulted in empty final_limb_masses');
  }
  console.log(`✅ [aiResultValidator] [${traceId}] PHASE 1: Final result structure validation passed:`, {
    finalShapeParamsCount: Object.keys(result.final_shape_params).length,
    finalLimbMassesCount: Object.keys(result.final_limb_masses).length,
    philosophy: 'phase_1_final_structure_validation_passed'
  });
  return result;
}
/**
 * PHASE B: Apply enhanced semantic coherence validation
 * Ensures morphological coherence within K=5 envelope and DB constraints
 */ function applyEnhancedSemanticCoherence(shapeParams, limbMasses, resolvedGender, k5_envelope, vision_classification, traceId) {
  const corrections = [];
  console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: Applying enhanced semantic coherence:`, {
    resolvedGender,
    shapeParamsCount: Object.keys(shapeParams).length,
    philosophy: 'phase_b_enhanced_semantic_coherence'
  });
  const pearFigure = shapeParams.pearFigure || 0;
  const bodybuilderSize = shapeParams.bodybuilderSize || 0;
  const bodybuilderDetails = shapeParams.bodybuilderDetails || 0;
  const emaciated = shapeParams.emaciated || 0;
  const narrowWaist = shapeParams.narrowWaist || 0;
  // Get envelope ranges for coherence validation
  const pearFigureRange = k5_envelope.shape_params_envelope.pearFigure;
  const bodybuilderSizeRange = k5_envelope.shape_params_envelope.bodybuilderSize;
  const bodybuilderDetailsRange = k5_envelope.shape_params_envelope.bodybuilderDetails;
  const emaciatedRange = k5_envelope.shape_params_envelope.emaciated;
  const narrowWaistRange = k5_envelope.shape_params_envelope.narrowWaist;
  // NOUVELLE LOGIQUE : Gérer la cohérence adiposité/musculature en fonction de la classification d'obésité
  const isObese = vision_classification.obesity === 'Obèse' || vision_classification.obesity === 'Obésité morbide';
  const isOverweight = vision_classification.obesity === 'Surpoids';
  // Règle 1: Si l'utilisateur est obèse, pearFigure doit rester élevé, et la musculature doit être basse.
  if (isObese) {
    // Forcer bodybuilderSize et bodybuilderDetails à des valeurs très basses
    if (bodybuilderSizeRange && bodybuilderSize > bodybuilderSizeRange.min + 0.1) {
      const targetValue = bodybuilderSizeRange.min; // Forcer vers le minimum de la plage
      corrections.push({
        type: 'shape_param',
        key: 'bodybuilderSize',
        originalValue: bodybuilderSize,
        correctedValue: targetValue,
        reason: `PHASE B: Obese user, forcing bodybuilderSize to min range (${targetValue.toFixed(3)})`
      });
    }
    if (bodybuilderDetailsRange && bodybuilderDetails > bodybuilderDetailsRange.min + 0.1) {
      const targetValue = bodybuilderDetailsRange.min;
      corrections.push({
        type: 'shape_param',
        key: 'bodybuilderDetails',
        originalValue: bodybuilderDetails,
        correctedValue: targetValue,
        reason: `PHASE B: Obese user, forcing bodybuilderDetails to min range (${targetValue.toFixed(3)})`
      });
    }
  // S'assurer que pearFigure reste élevé (ne pas le réduire)
  // Cette règle est désactivée pour les obèses car pearFigure doit rester élevé.
  } else if (isOverweight) {
    // Pour les surpoids, on peut être un peu plus flexible mais toujours privilégier l'adiposité
    // Règle 1: High adiposity (pearFigure > 1.0) incompatible with high muscularity
    if (pearFigureRange && bodybuilderSizeRange && pearFigure > 1.0) {
      const maxCompatibleBodybuilder = Math.min(0.2, bodybuilderSizeRange.max);
      if (bodybuilderSize > maxCompatibleBodybuilder) {
        corrections.push({
          type: 'shape_param',
          key: 'bodybuilderSize',
          originalValue: bodybuilderSize,
          correctedValue: maxCompatibleBodybuilder,
          reason: `PHASE B: High adiposity (pearFigure=${pearFigure.toFixed(3)}) incompatible with muscularity in K=5 envelope`
        });
      }
      if (bodybuilderDetailsRange) {
        const maxCompatibleDetails = Math.min(0.1, bodybuilderDetailsRange.max);
        if (bodybuilderDetails > maxCompatibleDetails) {
          corrections.push({
            type: 'shape_param',
            key: 'bodybuilderDetails',
            originalValue: bodybuilderDetails,
            correctedValue: maxCompatibleDetails,
            reason: `PHASE B: High adiposity incompatible with muscle definition in K=5 envelope`
          });
        }
      }
    }
  } else {
    // Règle 1: High adiposity (pearFigure > 1.0) incompatible with high muscularity
    if (pearFigureRange && bodybuilderSizeRange && pearFigure > 1.0) {
      const maxCompatibleBodybuilder = Math.min(0.2, bodybuilderSizeRange.max);
      if (bodybuilderSize > maxCompatibleBodybuilder) {
        corrections.push({
          type: 'shape_param',
          key: 'bodybuilderSize',
          originalValue: bodybuilderSize,
          correctedValue: maxCompatibleBodybuilder,
          reason: `PHASE B: High adiposity (pearFigure=${pearFigure.toFixed(3)}) incompatible with muscularity in K=5 envelope`
        });
      }
      if (bodybuilderDetailsRange) {
        const maxCompatibleDetails = Math.min(0.1, bodybuilderDetailsRange.max);
        if (bodybuilderDetails > maxCompatibleDetails) {
          corrections.push({
            type: 'shape_param',
            key: 'bodybuilderDetails',
            originalValue: bodybuilderDetails,
            correctedValue: maxCompatibleDetails,
            reason: `PHASE B: High adiposity incompatible with muscle definition in K=5 envelope`
          });
        }
      }
    }
    // Règle 2: High muscularity (bodybuilderSize > 0.8) incompatible with high adiposity
    if (bodybuilderSizeRange && pearFigureRange && bodybuilderSize > 0.8) {
      const maxCompatiblePearFigure = Math.min(0.5, pearFigureRange.max);
      if (pearFigure > maxCompatiblePearFigure) {
        corrections.push({
          type: 'shape_param',
          key: 'pearFigure',
          originalValue: pearFigure,
          correctedValue: maxCompatiblePearFigure,
          reason: `PHASE B: High muscularity (bodybuilderSize=${bodybuilderSize.toFixed(3)}) incompatible with high adiposity in K=5 envelope`
        });
      }
    }
  }
  // Correct narrowWaist for high adiposity (applicable à tous les cas d'obésité/surpoids)
  if ((isObese || isOverweight) && narrowWaistRange && narrowWaist > 0) {
    const maxCompatibleNarrowWaist = Math.min(-0.2, narrowWaistRange.max);
    if (narrowWaist > maxCompatibleNarrowWaist) {
      corrections.push({
        type: 'shape_param',
        key: 'narrowWaist',
        originalValue: narrowWaist,
        correctedValue: maxCompatibleNarrowWaist,
        reason: `PHASE B: High adiposity incompatible with narrow waist in K=5 envelope`
      });
    }
  }
  // RULE 3: Emaciation coherence (emaciated treated as standard morph key)
  if (emaciatedRange && emaciated > 0.5) {
    // If emaciated is high, reduce conflicting morphs within envelope
    if (pearFigureRange && pearFigure > Math.min(0.3, pearFigureRange.max)) {
      const maxCompatiblePearFigure = Math.min(0.2, pearFigureRange.max);
      corrections.push({
        type: 'shape_param',
        key: 'pearFigure',
        originalValue: pearFigure,
        correctedValue: maxCompatiblePearFigure,
        reason: `PHASE B: High emaciation (emaciated=${emaciated.toFixed(3)}) incompatible with adiposity in K=5 envelope`
      });
    }
    if (bodybuilderSizeRange && bodybuilderSize > Math.min(0.1, bodybuilderSizeRange.max)) {
      const maxCompatibleBodybuilder = Math.min(0, bodybuilderSizeRange.max);
      corrections.push({
        type: 'shape_param',
        key: 'bodybuilderSize',
        originalValue: bodybuilderSize,
        correctedValue: maxCompatibleBodybuilder,
        reason: `PHASE B: High emaciation (emaciated=${emaciated.toFixed(3)}) incompatible with muscularity in K=5 envelope`
      });
    }
  }
  // RULE 4: Gender-specific bans (always apply - DB constraints)
  if (resolvedGender === 'masculine') {
    const genderBannedKeys = [
      'pregnant',
      'nipples',
      'animeProportion'
    ];
    genderBannedKeys.forEach((key)=>{
      if (key in shapeParams && Math.abs(shapeParams[key]) > 0.001) {
        corrections.push({
          type: 'shape_param',
          key,
          originalValue: shapeParams[key],
          correctedValue: 0,
          reason: `PHASE B: Gender ban - ${key} not allowed for ${resolvedGender} (DB constraint min=max=0)`
        });
      }
    });
  }
  // RULE 5: Fixed limb masses (gate should always be 1.0)
  if ('gate' in limbMasses && Math.abs(limbMasses.gate - 1.0) > 0.001) {
    corrections.push({
      type: 'limb_mass',
      key: 'gate',
      originalValue: limbMasses.gate,
      correctedValue: 1.0,
      reason: `PHASE B: gate must be exactly 1.0 (DB constraint min=max=1)`
    });
  }
  console.log(`🔒 [aiResultValidator] [${traceId}] PHASE B: Enhanced semantic coherence validation:`, {
    correctionsNeeded: corrections.length,
    corrections: corrections.map((c)=>({
        type: c.type,
        key: c.key,
        delta: (c.correctedValue - c.originalValue).toFixed(3),
        reason: c.reason
      })),
    philosophy: 'phase_b_enhanced_semantic_coherence_complete'
  });
  return corrections;
}
/**
 * PHASE B: Validate that all required DB keys are present
 * Ensures completeness of the validated result
 */ function validateDBKeyCompleteness(validatedShapeParams, validatedLimbMasses, mappingData, traceId) {
  const missingShapeKeys = Object.keys(mappingData.morph_values).filter((key)=>!(key in validatedShapeParams));
  const missingLimbKeys = Object.keys(mappingData.limb_masses).filter((key)=>!(key in validatedLimbMasses));
  const isComplete = missingShapeKeys.length === 0 && missingLimbKeys.length === 0;
  console.log(`🔍 [aiResultValidator] [${traceId}] PHASE B: DB key completeness validation:`, {
    isComplete,
    missingShapeKeysCount: missingShapeKeys.length,
    missingLimbKeysCount: missingLimbKeys.length,
    missingShapeKeys: missingShapeKeys.slice(0, 5),
    missingLimbKeys: missingLimbKeys.slice(0, 5),
    philosophy: 'phase_b_db_completeness_validation'
  });
  return {
    isComplete,
    missingShapeKeys,
    missingLimbKeys
  };
}
