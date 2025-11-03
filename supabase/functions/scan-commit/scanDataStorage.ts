/**
 * Validate that a skin tone V2 object has the required structure for database insertion
 */
function validateSkinToneV2Structure(skinToneV2) {
  if (!skinToneV2) {
    return { valid: true, errors: [], reason: 'null_is_allowed' };
  }

  const errors = [];

  // Check required top-level keys
  if (!skinToneV2.zones) errors.push('Missing required key: zones');
  if (!skinToneV2.averageColor) errors.push('Missing required key: averageColor');
  if (typeof skinToneV2.overallConfidence !== 'number') errors.push('Missing or invalid key: overallConfidence');

  // Validate zones array
  if (skinToneV2.zones) {
    if (!Array.isArray(skinToneV2.zones)) {
      errors.push('zones must be an array');
    } else if (skinToneV2.zones.length === 0) {
      errors.push('zones array cannot be empty');
    } else {
      // Validate first zone structure (representative)
      const zone = skinToneV2.zones[0];
      if (!zone.name) errors.push('Zone missing name');
      if (!zone.avgColor) errors.push('Zone missing avgColor');
      if (typeof zone.confidence !== 'number') errors.push('Zone missing or invalid confidence');
      if (typeof zone.pixelsSampled !== 'number') errors.push('Zone missing or invalid pixelsSampled');
    }
  }

  // Validate averageColor structure
  if (skinToneV2.averageColor) {
    if (typeof skinToneV2.averageColor.r !== 'number' ||
        typeof skinToneV2.averageColor.g !== 'number' ||
        typeof skinToneV2.averageColor.b !== 'number') {
      errors.push('averageColor must have r, g, b number properties');
    }
  }

  // Validate confidence range
  if (typeof skinToneV2.overallConfidence === 'number') {
    if (skinToneV2.overallConfidence < 0 || skinToneV2.overallConfidence > 1) {
      errors.push(`overallConfidence must be between 0 and 1, got ${skinToneV2.overallConfidence}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    reason: errors.length > 0 ? 'validation_failed' : 'valid_structure'
  };
}

/**
 * Convert skin tone to database V2 format (multi-zone structure)
 * Handles both client V2 format and legacy format
 */
function convertSkinToneToV2(skinTone) {
  // Log input for debugging
  console.log('🔍 [convertSkinToneToV2] Starting conversion', {
    hasSkinTone: !!skinTone,
    skinToneType: skinTone ? typeof skinTone : 'undefined',
    skinToneKeys: skinTone && typeof skinTone === 'object' ? Object.keys(skinTone) : [],
    skinTonePreview: skinTone && typeof skinTone === 'object' ? {
      hasZones: !!skinTone.zones,
      hasAverageColor: !!skinTone.averageColor,
      hasOverallConfidence: typeof skinTone.overallConfidence === 'number',
      hasSchema: !!skinTone.schema,
      hasRGB: typeof skinTone.r === 'number' && typeof skinTone.g === 'number' && typeof skinTone.b === 'number',
      hasRGBNested: !!skinTone.rgb
    } : null,
    philosophy: 'conversion_entry_point_with_detailed_input_logging'
  });

  // Handle null/undefined - this is allowed
  if (!skinTone) {
    console.log('⚠️ [convertSkinToneToV2] No skin tone provided (null/undefined)', {
      philosophy: 'null_skin_tone_allowed'
    });
    return null;
  }

  // Already in database V2 format with zones
  if (skinTone?.zones && skinTone?.averageColor && skinTone?.overallConfidence) {
    console.log('✅ [convertSkinToneToV2] Already in database V2 format', {
      zonesCount: skinTone.zones.length,
      averageColor: skinTone.averageColor,
      overallConfidence: skinTone.overallConfidence,
      philosophy: 'passthrough_v2_format'
    });
    return skinTone;
  }

  // Client V2 format with rgb/hex/schema - convert to database multi-zone format
  if (skinTone?.schema === 'v2' && skinTone?.rgb) {
    const r = Math.max(0, Math.min(255, Math.round(skinTone.rgb.r)));
    const g = Math.max(0, Math.min(255, Math.round(skinTone.rgb.g)));
    const b = Math.max(0, Math.min(255, Math.round(skinTone.rgb.b)));
    const confidence = Math.max(0, Math.min(1, skinTone.confidence || 0.75));
    const pixelCount = skinTone.pixelCount || 10000;

    console.log('✅ [convertSkinToneToV2] Converting client V2 to database multi-zone format', {
      clientV2: { rgb: { r, g, b }, hex: skinTone.hex, schema: skinTone.schema },
      confidence,
      pixelCount,
      philosophy: 'client_v2_to_database_multizone'
    });

    const converted = {
      zones: [{
        name: 'face',
        avgColor: { r, g, b },
        minColor: { r, g, b },
        maxColor: { r, g, b },
        stdDev: { r: 5, g: 5, b: 5 },
        confidence: confidence,
        pixelsSampled: pixelCount
      }],
      averageColor: { r, g, b },
      minColor: { r, g, b },
      maxColor: { r, g, b },
      colorVariation: { r: 5, g: 5, b: 5 },
      overallConfidence: confidence,
      totalPixelsSampled: pixelCount,
      extractedAt: new Date().toISOString()
    };

    // Validate the converted structure
    const validation = validateSkinToneV2Structure(converted);
    if (!validation.valid) {
      console.error('❌ [convertSkinToneToV2] Conversion produced invalid structure', {
        errors: validation.errors,
        converted,
        philosophy: 'conversion_validation_failed'
      });
      return null;
    }

    return converted;
  }

  // Legacy format {r, g, b} - convert to database multi-zone format
  if (skinTone && typeof skinTone.r === 'number' && typeof skinTone.g === 'number' && typeof skinTone.b === 'number') {
    const r = Math.max(0, Math.min(255, Math.round(skinTone.r)));
    const g = Math.max(0, Math.min(255, Math.round(skinTone.g)));
    const b = Math.max(0, Math.min(255, Math.round(skinTone.b)));
    const confidence = Math.max(0, Math.min(1, skinTone.confidence || 0.75));
    const pixelCount = skinTone.pixelCount || 10000;
    const regionUsed = skinTone.region_used || 'unknown';

    console.log('✅ [convertSkinToneToV2] Converting legacy format to database multi-zone format', {
      legacy: { r, g, b },
      confidence,
      pixelCount,
      regionUsed,
      originalConfidence: skinTone.confidence,
      philosophy: 'legacy_to_database_multizone'
    });

    const converted = {
      zones: [{
        name: 'face',
        avgColor: { r, g, b },
        minColor: { r, g, b },
        maxColor: { r, g, b },
        stdDev: { r: 5, g: 5, b: 5 },
        confidence: confidence,
        pixelsSampled: pixelCount
      }],
      averageColor: { r, g, b },
      minColor: { r, g, b },
      maxColor: { r, g, b },
      colorVariation: { r: 5, g: 5, b: 5 },
      overallConfidence: confidence,
      totalPixelsSampled: pixelCount,
      extractedAt: new Date().toISOString()
    };

    // Validate the converted structure
    const validation = validateSkinToneV2Structure(converted);
    if (!validation.valid) {
      console.error('❌ [convertSkinToneToV2] Conversion produced invalid structure', {
        errors: validation.errors,
        converted,
        philosophy: 'conversion_validation_failed'
      });
      return null;
    }

    console.log('✅ [convertSkinToneToV2] Legacy conversion successful and validated', {
      averageColor: converted.averageColor,
      overallConfidence: converted.overallConfidence,
      zonesCount: converted.zones.length,
      philosophy: 'legacy_conversion_validated_success'
    });

    return converted;
  }

  // No valid skin tone format detected - return null
  console.log('⚠️ [convertSkinToneToV2] No valid skin tone format detected', {
    skinTone,
    availableKeys: skinTone && typeof skinTone === 'object' ? Object.keys(skinTone) : [],
    philosophy: 'invalid_format_return_null'
  });
  return null;
}

/**
 * Store body scan data in the database
 */
export async function storeBodyScanData(supabase, scanId, scanData) {
  try {
    console.log('🔍 [storeBodyScanData] Starting data storage', {
      scanId,
      scanDataKeys: Object.keys(scanData),
      philosophy: 'storage_entry_point'
    });

    // Extract clamping metadata from match_result if available
    const clampingMetadata = scanData.match_result?.ai_refinement?.clamping_metadata || null;
    const aiRefined = scanData.match_result?.ai_refinement?.ai_refined || false;

    console.log('🔍 [storeBodyScanData] Extracting AI refinement metadata', {
      scanId,
      hasClampingMetadata: !!clampingMetadata,
      aiRefined,
      philosophy: 'ai_metadata_extraction'
    });

    // CRITICAL: Convert skin tone to V2 format for database compatibility
    console.log('🔍 [storeBodyScanData] Converting skin tone to V2 format', {
      scanId,
      hasSkinTone: !!scanData.skin_tone,
      skinToneType: scanData.skin_tone ? typeof scanData.skin_tone : 'undefined',
      skinToneKeys: scanData.skin_tone && typeof scanData.skin_tone === 'object' ? Object.keys(scanData.skin_tone) : [],
      skinToneRawPreview: scanData.skin_tone && typeof scanData.skin_tone === 'object' ? {
        r: scanData.skin_tone.r,
        g: scanData.skin_tone.g,
        b: scanData.skin_tone.b,
        confidence: scanData.skin_tone.confidence,
        region_used: scanData.skin_tone.region_used
      } : null,
      philosophy: 'skin_tone_conversion_start_with_raw_preview'
    });

    const skinToneV2 = convertSkinToneToV2(scanData.skin_tone);

    // Validate the converted skin tone structure BEFORE database insertion
    const validation = validateSkinToneV2Structure(skinToneV2);

    console.log('🔍 [storeBodyScanData] Skin tone V2 validation result', {
      scanId,
      validationResult: {
        valid: validation.valid,
        errors: validation.errors,
        reason: validation.reason
      },
      hasSkinToneV2: !!skinToneV2,
      philosophy: 'pre_insertion_validation'
    });

    if (!validation.valid && skinToneV2 !== null) {
      console.error('❌ [storeBodyScanData] Skin tone V2 validation failed', {
        scanId,
        validationErrors: validation.errors,
        skinToneV2Structure: skinToneV2,
        philosophy: 'skin_tone_validation_failure'
      });
      throw new Error(`Skin tone V2 validation failed: ${validation.errors.join(', ')}`);
    }

    console.log('✅ [storeBodyScanData] Skin tone converted to V2 and validated', {
      scanId,
      hasSkinToneV2: !!skinToneV2,
      skinToneV2Format: skinToneV2 ? {
        hasZones: !!skinToneV2.zones,
        zonesCount: skinToneV2.zones?.length || 0,
        hasAverageColor: !!skinToneV2.averageColor,
        averageColorRGB: skinToneV2.averageColor ? `rgb(${skinToneV2.averageColor.r}, ${skinToneV2.averageColor.g}, ${skinToneV2.averageColor.b})` : 'none',
        overallConfidence: skinToneV2.overallConfidence,
        validationPassed: validation.valid
      } : 'null',
      philosophy: 'skin_tone_conversion_complete_with_validation'
    });

    // Prepare metrics object with all scan data
    const metrics = {
      estimate_result: scanData.estimate_result,
      match_result: scanData.match_result,
      morph_bounds: scanData.morph_bounds,
      semantic_result: scanData.semantic_result,
      validation_metadata: scanData.validation_metadata,
      temporal_analysis: scanData.temporal_analysis,
      smoothing_metadata: scanData.smoothing_metadata,
      visionfit_result: scanData.visionfit_result,
      photos_metadata: scanData.photos_metadata,
      // CRITICAL: Include complete avatar data for persistence
      final_shape_params: scanData.final_shape_params,
      final_limb_masses: scanData.final_limb_masses,
      skin_tone: scanData.skin_tone,
      resolved_gender: scanData.resolved_gender,
      mapping_version: scanData.mapping_version,
      gltf_model_id: scanData.gltf_model_id,
      material_config_version: scanData.material_config_version,
      avatar_version: scanData.avatar_version,
      // AUDIT TRAIL: Include AI refinement metadata
      ai_refined: aiRefined,
      clamping_metadata: clampingMetadata
    };
    console.log('✅ [storeBodyScanData] Storing complete avatar data with audit trail', {
      scanId,
      user_id: scanData.user_id,
      hasFinalShapeParams: !!scanData.final_shape_params,
      finalShapeParamsCount: scanData.final_shape_params ? Object.keys(scanData.final_shape_params).length : 0,
      hasFinalLimbMasses: !!scanData.final_limb_masses,
      finalLimbMassesCount: scanData.final_limb_masses ? Object.keys(scanData.final_limb_masses).length : 0,
      hasSkinTone: !!skinToneV2,
      skinToneV2Format: skinToneV2 ? {
        averageColor: skinToneV2.averageColor,
        overallConfidence: skinToneV2.overallConfidence,
        zonesCount: skinToneV2.zones?.length || 0
      } : 'none',
      resolvedGender: scanData.resolved_gender,
      avatarVersion: scanData.avatar_version,
      aiRefined: aiRefined,
      hasClampingMetadata: !!clampingMetadata,
      clampingMetadataSummary: clampingMetadata ? {
        totalTransformations: clampingMetadata.total_transformations,
        validationStatus: clampingMetadata.validation_status,
        envelopeViolations: clampingMetadata.envelope_violations?.length || 0,
        dbViolations: clampingMetadata.db_violations?.length || 0,
        genderViolations: clampingMetadata.gender_violations?.length || 0
      } : null,
      philosophy: 'complete_avatar_persistence_with_audit_trail'
    });
    // Extract metrics from estimate_result for direct column storage
    const extractedData = scanData.estimate_result?.extracted_data || {};
    const rawMeasurements = extractedData.raw_measurements || {};

    // CRITICAL: Extract complete avatar payload for direct column persistence
    const resolvedGender = scanData.resolved_gender;
    const morphValues = scanData.final_shape_params || {};
    const limbMasses = scanData.final_limb_masses || {};
    const skinTone = skinToneV2;
    const gltfModelId = scanData.gltf_model_id;
    const materialConfigVersion = scanData.material_config_version || 'pbr-v2';
    const mappingVersion = scanData.mapping_version || 'v1.0';
    const avatarVersion = scanData.avatar_version || 'v2.0';

    // Extract body metrics
    const weight = rawMeasurements.weight_kg || scanData.user_profile?.weight_kg;
    const bodyFatPercentage = extractedData.estimated_body_fat_perc;
    const bmi = extractedData.estimated_bmi;
    const waistCircumference = rawMeasurements.waist_cm;

    console.log('✅ [storeBodyScanData] Persisting complete avatar payload to direct columns', {
      scanId,
      resolvedGender,
      morphValuesCount: Object.keys(morphValues).length,
      limbMassesCount: Object.keys(limbMasses).length,
      hasSkinTone: !!skinTone,
      skinToneStructurePreview: skinTone ? {
        hasZones: !!skinTone.zones,
        zonesCount: skinTone.zones?.length || 0,
        hasAverageColor: !!skinTone.averageColor,
        averageColorRGB: skinTone.averageColor ? `rgb(${skinTone.averageColor.r}, ${skinTone.averageColor.g}, ${skinTone.averageColor.b})` : 'none',
        hasOverallConfidence: typeof skinTone.overallConfidence === 'number',
        overallConfidence: skinTone.overallConfidence
      } : 'null',
      gltfModelId,
      materialConfigVersion,
      mappingVersion,
      avatarVersion,
      weight,
      bodyFatPercentage,
      bmi,
      waistCircumference,
      philosophy: 'complete_payload_persistence_v2_with_skin_tone_structure_audit'
    });

    // Prepare insert payload with comprehensive logging
    const insertPayload = {
      id: scanId,
      user_id: scanData.user_id,
      timestamp: new Date().toISOString(),
      // JSONB metrics for backward compatibility
      metrics: metrics,
      // CRITICAL: Direct columns for efficient querying and projection
      resolved_gender: resolvedGender,
      morph_values: morphValues,
      morph3d: morphValues, // Backward compatibility
      limb_masses: limbMasses,
      skin_tone_map_v2: skinTone, // V2 format with zones, averageColor, overallConfidence
      gltf_model_id: gltfModelId,
      material_config_version: materialConfigVersion,
      mapping_version: mappingVersion,
      avatar_version: avatarVersion,
      weight: weight,
      body_fat_percentage: bodyFatPercentage,
      bmi: bmi,
      waist_circumference: waistCircumference,
      raw_measurements: rawMeasurements
    };

    console.log('🔍 [storeBodyScanData] CRITICAL: About to insert into body_scans', {
      scanId,
      payloadKeys: Object.keys(insertPayload),
      payloadSummary: {
        user_id: insertPayload.user_id?.substring(0, 8) + '...',
        resolved_gender: insertPayload.resolved_gender,
        morph_values_count: insertPayload.morph_values ? Object.keys(insertPayload.morph_values).length : 0,
        limb_masses_count: insertPayload.limb_masses ? Object.keys(insertPayload.limb_masses).length : 0,
        has_skin_tone_map_v2: !!insertPayload.skin_tone_map_v2,
        skin_tone_map_v2_structure: insertPayload.skin_tone_map_v2 ? {
          hasZones: !!insertPayload.skin_tone_map_v2.zones,
          zonesCount: insertPayload.skin_tone_map_v2.zones?.length,
          hasAverageColor: !!insertPayload.skin_tone_map_v2.averageColor,
          hasOverallConfidence: typeof insertPayload.skin_tone_map_v2.overallConfidence === 'number'
        } : null,
        gltf_model_id: insertPayload.gltf_model_id,
        avatar_version: insertPayload.avatar_version,
        weight: insertPayload.weight,
        bmi: insertPayload.bmi
      },
      philosophy: 'pre_insert_final_audit'
    });

    // Insert the body scan data with BOTH metrics JSONB AND direct columns
    const { data, error } = await supabase.from('body_scans').insert(insertPayload).select().single();
    if (error) {
      console.error('❌ [storeBodyScanData] Database error storing body scan:', {
        scanId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        skinToneDebugInfo: {
          hasSkinToneParam: !!skinTone,
          skinToneStructure: skinTone ? {
            hasZones: !!skinTone.zones,
            hasAverageColor: !!skinTone.averageColor,
            hasOverallConfidence: typeof skinTone.overallConfidence === 'number',
            fullStructure: JSON.stringify(skinTone)
          } : 'null'
        },
        philosophy: 'database_insertion_error_with_skin_tone_debug'
      });
      throw new Error(`Failed to store body scan: ${error.message}`);
    }
    console.log('✅ [storeBodyScanData] Body scan stored successfully with complete avatar data in direct columns:', {
      scanId: data.id,
      metricsKeys: Object.keys(metrics),
      // Direct columns verification
      directColumnsStored: {
        resolved_gender: data.resolved_gender,
        morph_values_count: data.morph_values ? Object.keys(data.morph_values).length : 0,
        limb_masses_count: data.limb_masses ? Object.keys(data.limb_masses).length : 0,
        has_skin_tone_v2: !!data.skin_tone_map_v2,
        gltf_model_id: data.gltf_model_id,
        avatar_version: data.avatar_version,
        weight: data.weight,
        bmi: data.bmi
      },
      philosophy: 'server_side_persistence_complete_v2_direct_columns'
    });
    return data;
  } catch (error) {
    console.error('❌ [storeBodyScanData] Error storing scan data:', {
      scanId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name || typeof error,
      philosophy: 'storage_error_catch'
    });
    throw error;
  }
}
