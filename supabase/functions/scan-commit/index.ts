import { jsonResponse, corsHeaders } from './response.ts';
import { validateCommitRequest } from './requestValidator.ts';
import { storeBodyScanData } from './scanDataStorage.ts';
import { updateUserProfile } from './profileUpdater.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createSecurityLogger } from '../_shared/securityLogger.ts';

/**
 * Scan Commit Edge Function - Final Persistence
 * Stores complete scan results with all metadata
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
      },
      405
    );
  }

  try {
    // Generate unique scan ID first
    const scanId = crypto.randomUUID();
    console.log('🔍 [scan-commit] Generated scan ID', {
      scanId,
    });

    console.log('🔍 [scan-commit] Starting request parsing', {
      scanId,
      philosophy: 'detailed_error_tracking'
    });

    // Parse and validate request
    const requestData = await req.json();

    console.log('✅ [scan-commit] Request parsed successfully', {
      scanId,
      requestDataKeys: Object.keys(requestData),
      philosophy: 'request_parsing_success'
    });

    console.log('🔍 [scan-commit] Starting request validation', {
      scanId,
      philosophy: 'pre_validation_checkpoint'
    });

    const validationError = validateCommitRequest(requestData);

    if (validationError) {
      console.error('❌ [scan-commit] Request validation failed:', validationError);

      // Sprint 3 Phase 4.2: Log validation failure
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const securityLogger = createSecurityLogger(supabase);

        await securityLogger.logValidationError(
          'scan-commit',
          validationError,
          req,
          requestData.user_id
        );
      } catch (logError) {
        console.error('⚠️ [scan-commit] Failed to log security event:', logError);
      }

      return jsonResponse(
        {
          error: validationError,
        },
        400
      );
    }

    console.log('🔍 [scan-commit] Starting data extraction from request', {
      scanId,
      philosophy: 'pre_extraction_checkpoint'
    });

    let user_id, estimate_result, match_result, morph_bounds, semantic_result;
    let validation_metadata, temporal_analysis, smoothing_metadata, visionfit_result, photos_metadata;
    let final_shape_params, final_limb_masses, skin_tone, resolved_gender;
    let mapping_version, gltf_model_id, material_config_version, avatar_version;

    try {
      ({
        user_id,
        estimate_result,
        match_result,
        morph_bounds,
        semantic_result,
        validation_metadata,
        temporal_analysis,
        smoothing_metadata,
        visionfit_result,
        photos_metadata,
        final_shape_params,
        final_limb_masses,
        skin_tone,
        resolved_gender,
        mapping_version,
        gltf_model_id,
        material_config_version,
        avatar_version,
      } = requestData);

      console.log('✅ [scan-commit] Data extraction successful', {
        scanId,
        extractedUserId: user_id?.substring(0, 8) + '...',
        extractedFieldsCount: 18,
        philosophy: 'extraction_success'
      });
    } catch (extractionError) {
      console.error('❌ [scan-commit] Data extraction failed', {
        scanId,
        error: extractionError instanceof Error ? extractionError.message : String(extractionError),
        stack: extractionError instanceof Error ? extractionError.stack : undefined,
        philosophy: 'extraction_failure'
      });
      throw extractionError;
    }

    // Check if this is a mock user ID in development
    const isMockUser = user_id === '00000000-0000-0000-0000-000000000001';
    const isProduction = Deno.env.get('ENVIRONMENT') === 'production';

    if (isMockUser && !isProduction) {
      console.log('🔧 [scan-commit] Mock user detected in development - bypassing database operations');
      return jsonResponse({
        success: true,
        scan_id: scanId,
        processing_complete: true,
        mock_mode: true,
      });
    }

    console.log('📥 [scan-commit] Request received - detailed data audit', {
      scanId,
      user_id,
      hasEstimateResult: !!estimate_result,
      estimateResultKeys: estimate_result ? Object.keys(estimate_result) : [],
      estimateResultShapeParams: estimate_result?.shape_params ? Object.keys(estimate_result.shape_params) : [],
      estimateResultLimbMasses: estimate_result?.limb_masses ? Object.keys(estimate_result.limb_masses) : [],
      hasMatchResult: !!match_result,
      matchResultKeys: match_result ? Object.keys(match_result) : [],
      matchResultBlendedShapeParams: match_result?.blended_shape_params ? Object.keys(match_result.blended_shape_params) : [],
      matchResultBlendedLimbMasses: match_result?.blended_limb_masses ? Object.keys(match_result.blended_limb_masses) : [],
      hasMorphBounds: !!morph_bounds,
      morphBoundsCount: Object.keys(morph_bounds || {}).length,
      morphBoundsKeys: morph_bounds ? Object.keys(morph_bounds) : [],
      hasSemanticResult: !!semantic_result,
      photosCount: photos_metadata?.length || 0,
      // Log new fields
      hasFinalShapeParams: !!final_shape_params,
      finalShapeParamsCount: final_shape_params ? Object.keys(final_shape_params).length : 0,
      hasFinalLimbMasses: !!final_limb_masses,
      finalLimbMassesCount: final_limb_masses ? Object.keys(final_limb_masses).length : 0,
      hasSkinTone: !!skin_tone,
      skinToneType: skin_tone ? typeof skin_tone : 'undefined',
      skinToneKeys: skin_tone && typeof skin_tone === 'object' ? Object.keys(skin_tone) : [],
      resolvedGender: resolved_gender,
      mappingVersion: mapping_version,
      gltfModelId: gltf_model_id,
      materialConfigVersion: material_config_version,
      avatarVersion: avatar_version,
      philosophy: 'detailed_request_audit'
    });

    // CRITICAL: Log complete skin tone structure as received from client
    console.log('🎨 [scan-commit] SKIN TONE RECEIVED FROM CLIENT', {
      scanId,
      skinToneComplete: skin_tone,
      skinToneKeys: skin_tone && typeof skin_tone === 'object' ? Object.keys(skin_tone) : [],
      skinToneSchema: skin_tone?.schema,
      skinToneRGB: skin_tone?.rgb,
      skinToneHex: skin_tone?.hex,
      skinToneSource: skin_tone?.source,
      skinToneConfidence: skin_tone?.confidence,
      philosophy: 'CRITICAL_SKIN_TONE_AUDIT_ON_RECEIVE'
    });

    console.log('🔍 [scan-commit] Initializing Supabase client', {
      scanId,
      user_id: user_id?.substring(0, 8) + '...',
      philosophy: 'pre_supabase_init'
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [scan-commit] Missing Supabase configuration:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        urlPreview: supabaseUrl?.substring(0, 30) + '...' || 'missing',
        serviceKeyPreview: supabaseServiceKey ? 'eyJ...' + supabaseServiceKey.slice(-10) : 'missing',
      });
      return jsonResponse(
        {
          error: "Supabase configuration missing",
        },
        500
      );
    }

    console.log('🔍 [scan-commit] Importing Supabase client library', {
      scanId,
      philosophy: 'pre_import'
    });

    const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');

    console.log('🔍 [scan-commit] Creating Supabase client instance', {
      scanId,
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      philosophy: 'pre_client_creation'
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('✅ [scan-commit] Service client initialized', {
      scanId,
      clientType: 'service_role',
      philosophy: 'rls_bypass_controlled_access',
    });

    // Store body scan data with complete metadata
    console.log('🔍 [scan-commit] Starting body scan data storage', {
      scanId,
      user_id,
      dataKeys: Object.keys({
        user_id,
        estimate_result,
        match_result,
        morph_bounds,
        semantic_result,
        validation_metadata,
        temporal_analysis,
        smoothing_metadata,
        visionfit_result,
        photos_metadata,
        final_shape_params,
        final_limb_masses,
        skin_tone,
        resolved_gender,
        mapping_version,
        gltf_model_id,
        material_config_version,
        avatar_version,
      }).filter(key => eval(key) !== undefined),
      philosophy: 'pre_storage_validation'
    });

    const scanData = await storeBodyScanData(supabase, scanId, {
      user_id,
      estimate_result,
      match_result,
      morph_bounds,
      semantic_result,
      validation_metadata,
      temporal_analysis,
      smoothing_metadata,
      visionfit_result,
      photos_metadata,
      // Pass new fields to storeBodyScanData
      final_shape_params,
      final_limb_masses,
      skin_tone,
      resolved_gender,
      mapping_version,
      gltf_model_id,
      material_config_version,
      avatar_version,
    });

    console.log('✅ [scan-commit] Body scan data stored successfully', {
      scanId,
      scanDataId: scanData.id,
      philosophy: 'storage_success_checkpoint'
    });

    // Update user profile if needed
    console.log('🔍 [scan-commit] Starting user profile update', {
      scanId,
      user_id,
      philosophy: 'pre_profile_update'
    });

    await updateUserProfile(
      supabase,
      user_id,
      estimate_result,
      match_result,
      semantic_result,
      { // Pass AI refinement result if available, otherwise an empty object
        ai_refine: match_result?.ai_refinement?.ai_refine || false,
        final_shape_params: final_shape_params,
        final_limb_masses: final_limb_masses,
        ai_confidence: match_result?.ai_refinement?.ai_confidence,
        clamped_keys: match_result?.ai_refinement?.clamped_keys,
        envelope_violations: match_result?.ai_refinement?.envelope_violations,
        db_violations: match_result?.ai_refinement?.db_violations,
        gender_violations: match_result?.ai_refinement?.gender_violations,
        out_of_range_count: match_result?.ai_refinement?.out_of_range_count,
        missing_keys_added: match_result?.ai_refinement?.missing_keys_added,
        extra_keys_removed: match_result?.ai_refinement?.extra_keys_removed,
        active_keys_count: match_result?.ai_refinement?.active_keys_count,
        refinement_deltas: match_result?.ai_refinement?.refinement_deltas,
      },
      resolved_gender,
      final_shape_params,
      final_limb_masses,
      skin_tone,
      gltf_model_id,
      material_config_version,
      avatar_version
    );

    console.log('✅ [scan-commit] User profile updated successfully', {
      scanId,
      user_id,
      philosophy: 'profile_update_success'
    });

    console.log('✅ [scan-commit] Scan committed successfully with morph_bounds', {
      scanId: scanData.id,
      hasMorphBounds: !!morph_bounds,
      morphBoundsCount: Object.keys(morph_bounds || {}).length,
      philosophy: 'commit_success_final'
    });

    return jsonResponse({
      success: true,
      scan_id: scanData.id,
      processing_complete: true,
    });
  } catch (error) {
    console.error('❌ [scan-commit] Commit failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name || typeof error,
      errorDetails: error instanceof Error ? {
        name: error.name,
        message: error.message,
        cause: error.cause
      } : error,
      philosophy: 'detailed_error_logging'
    });

    return jsonResponse(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        errorType: error?.constructor?.name || typeof error,
      },
      500
    );
  }
});
