// supabase/functions/scan-refine-morphs/index.ts
import { corsHeaders, jsonResponse } from './response.ts';
import { validateRefineRequest } from './requestValidator.ts';
import { refetchMorphologyMapping } from '../_shared/utils/mappingRefetcher.ts';
import { buildAIRefinementPrompt } from './promptBuilder.ts';
import { callOpenAIForRefinement } from './openaiClient.ts';
import { validateAndClampAIResults } from './aiResultValidator.ts';
import { calculateRefinementDeltas, countActiveKeys } from './aiResultValidator.ts';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

// AJOUTEZ UN LOG POUR VÉRIFIER L'ACCÈS À LA VARIABLE D'ENVIRONNEMENT
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openaiApiKey) {
  console.error('ERROR: [scan-refine-morphs] OPENAI_API_KEY is NOT set!');
} else {
  console.log('DEBUG: [scan-refine-morphs] OPENAI_API_KEY is set.');
}

/**
 * Scan Refine Morphs Edge Function - AI-Driven Morphological Refinement
 * Takes blended morphs and photos, uses AI to produce photo-realistic final vector
 * Respects ONLY physiological bounds from database (no rigid policies)
 */ 
Deno.serve(async (req)=>{
  const processingStartTime = performance.now();
  const traceId = `refine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`DEBUG: [scan-refine-morphs] [${traceId}] Handling OPTIONS request.`);
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    console.log(`DEBUG: [scan-refine-morphs] [${traceId}] Method not allowed: ${req.method}.`);
    return jsonResponse({
      error: "Method not allowed"
    }, 405);
  }
  let requestData; // Declare requestData here to ensure it's always defined
  try {
    // Parse and validate request
    requestData = await req.json(); // Assign requestData here
    const validationError = validateRefineRequest(requestData);
    if (validationError) {
      console.error(`❌ [scan-refine-morphs] [${traceId}] Request validation failed:`, validationError);
      return jsonResponse({
        error: validationError
      }, 400);
    }
    const { scan_id, user_id, resolvedGender, photos, blend_shape_params, blend_limb_masses, mapping_version, k5_envelope, vision_classification, user_measurements } = requestData;
    console.log(`📥 [scan-refine-morphs] [${traceId}] AI refinement request received:`, {
      scan_id,
      user_id,
      resolvedGender,
      photosCount: photos?.length,
      blendShapeParamsKeys: Object.keys(blend_shape_params || {}),
      blendLimbMassesKeys: Object.keys(blend_limb_masses || {}),
      mapping_version,
      hasK5Envelope: !!k5_envelope,
      hasVisionClassification: !!vision_classification,
      hasUserMeasurements: !!user_measurements,
      traceId,
      philosophy: 'phase_b_ai_driven_k5_envelope_constrained'
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const estimatedTokensForRefine = 150;
    const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokensForRefine);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('SCAN_REFINE_MORPHS', 'Insufficient tokens for morph refinement', {
        traceId,
        userId: user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokensForRefine,
        timestamp: new Date().toISOString()
      });

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokensForRefine,
        !tokenCheck.isSubscribed,
        corsHeaders
      );
    }

    console.log('💰 [SCAN_REFINE_MORPHS] Token check passed', {
      traceId,
      userId: user_id,
      currentBalance: tokenCheck.currentBalance,
      estimatedCost: estimatedTokensForRefine,
      timestamp: new Date().toISOString()
    });
    // PHASE B: Validate K=5 envelope is present
    if (!k5_envelope) {
      console.error(`❌ [scan-refine-morphs] [${traceId}] PHASE B: K=5 envelope missing from request`);
      return jsonResponse({
        error: "K=5 envelope is required for PHASE B AI refinement",
        phase: "B",
        fallback_available: false
      }, 400);
    }
    // PHASE B: Validate vision classification is present
    if (!vision_classification) {
      console.error(`❌ [scan-refine-morphs] [${traceId}] PHASE B: Vision classification missing from request`);
      return jsonResponse({
        error: "Vision classification is required for PHASE B AI refinement",
        phase: "B",
        fallback_available: false
      }, 400);
    }
    // CRITICAL: Refetch mapping from database (never trust client)
    console.log(`🔍 [scan-refine-morphs] [${traceId}] Refetching mapping from database`);
    const mappingData = await refetchMorphologyMapping(mapping_version, resolvedGender);
    if (!mappingData) {
      console.error(`❌ [scan-refine-morphs] [${traceId}] Failed to refetch mapping data`);
      return jsonResponse({
        error: "Failed to retrieve morphology mapping from database",
        phase: "B",
        fallback_available: true
      }, 500);
    }
    console.log(`✅ [scan-refine-morphs] [${traceId}] Mapping refetched successfully:`, {
      resolvedGender,
      mapping_version,
      morphValuesCount: Object.keys(mappingData.morph_values).length,
      limbMassesCount: Object.keys(mappingData.limb_masses).length,
      philosophy: 'phase_b_database_source_of_truth'
    });
    // PHASE B: Build AI refinement prompt with strict constraints
    console.log(`🔍 [scan-refine-morphs] [${traceId}] PHASE B: Building strict AI refinement prompt`);
    const aiPrompt = buildAIRefinementPrompt({
      photos,
      blend_shape_params,
      blend_limb_masses,
      mappingData,
      resolvedGender,
      k5_envelope,
      vision_classification,
      user_measurements,
      traceId
    });
    // PHASE B: Call OpenAI for strict AI-driven refinement
    console.log(`🔍 [scan-refine-morphs] [${traceId}] PHASE B: Calling OpenAI for K=5 envelope constrained refinement`);
    const aiRefinementResult = await callOpenAIForRefinement(aiPrompt, photos, traceId);
    console.log(`✅ [scan-refine-morphs] [${traceId}] PHASE B: AI refinement completed:`, {
      hasShapeParams: !!aiRefinementResult.final_shape_params,
      hasLimbMasses: !!aiRefinementResult.final_limb_masses,
      shapeParamsCount: Object.keys(aiRefinementResult.final_shape_params || {}).length,
      limbMassesCount: Object.keys(aiRefinementResult.final_limb_masses || {}).length,
      aiConfidence: aiRefinementResult.confidence,
      philosophy: 'phase_b_ai_driven_k5_envelope_constrained'
    });
    // PHASE B: Validate and clamp AI results with K=5 envelope and DB bounds
    console.log(`🔍 [scan-refine-morphs] [${traceId}] PHASE B: Validating with K=5 envelope and DB bounds`);
    const validationResult = await validateAndClampAIResults(aiRefinementResult, mappingData, k5_envelope, resolvedGender, vision_classification, traceId);
    // Calculate deltas between blend and AI-refined values
    const deltas = calculateRefinementDeltas(blend_shape_params, blend_limb_masses, validationResult.final_shape_params, validationResult.final_limb_masses);
    // Count active keys (|value| > 0.05)
    const activeKeysCount = countActiveKeys(validationResult.final_shape_params, validationResult.final_limb_masses);
    const response = {
      // AI-refined final vectors
      final_shape_params: validationResult.final_shape_params,
      final_limb_masses: validationResult.final_limb_masses,
      // Quality metrics
      ai_refine: true,
      ai_refined: true, // Flag indicating AI refinement was applied
      mapping_version,
      clamped_keys: validationResult.clamped_keys,
      envelope_violations: validationResult.envelope_violations,
      db_violations: validationResult.db_violations,
      gender_violations: validationResult.gender_violations,
      out_of_range_count: validationResult.out_of_range_count,
      missing_keys_added: validationResult.missing_keys_added,
      extra_keys_removed: validationResult.extra_keys_removed,
      active_keys_count: activeKeysCount,
      // Refinement analysis
      refinement_deltas: {
        top_10_shape_deltas: deltas.topShapeDeltas,
        top_10_limb_deltas: deltas.topLimbDeltas,
        total_shape_changes: deltas.totalShapeChanges,
        total_limb_changes: deltas.totalLimbChanges
      },
      // CRITICAL: Complete audit trail of transformations
      clamping_metadata: validationResult.clamping_metadata,
      // Metadata
      ai_confidence: aiRefinementResult.confidence || 0.8,
      processing_time_ms: performance.now() - processingStartTime,
      philosophy: 'phase_b_ai_driven_k5_envelope_db_bounds_strict_with_audit_trail'
    };
    const processingTime = performance.now() - processingStartTime;
    console.log(`🎉 [scan-refine-morphs] [${traceId}] PHASE B: AI-driven refinement completed successfully:`, {
      processingTimeMs: processingTime.toFixed(2),
      finalShapeParamsCount: Object.keys(response.final_shape_params).length,
      finalLimbMassesCount: Object.keys(response.final_limb_masses).length,
      clampedKeysCount: response.clamped_keys.length,
      envelopeViolationsCount: response.envelope_violations.length,
      dbViolationsCount: response.db_violations.length,
      genderViolationsCount: response.gender_violations?.length || 0,
      outOfRangeCount: response.out_of_range_count,
      missingKeysAddedCount: response.missing_keys_added.length,
      extraKeysRemovedCount: response.extra_keys_removed.length,
      activeKeysCount: response.active_keys_count,
      topShapeDeltas: deltas.topShapeDeltas.slice(0, 3),
      aiConfidence: response.ai_confidence,
      philosophy: 'phase_b_strict_validation_success'
    });

    if (aiRefinementResult?.ai_metadata?.usage) {
      const usage = aiRefinementResult.ai_metadata.usage;
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      const costUsd = (inputTokens * 0.25 / 1000000) + (outputTokens * 2.00 / 1000000);

      const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
        userId: user_id,
        edgeFunctionName: 'scan-refine-morphs',
        operationType: 'morph-refinement-ai',
        openaiModel: 'gpt-5-mini',
        openaiInputTokens: inputTokens,
        openaiOutputTokens: outputTokens,
        openaiCostUsd: costUsd,
        metadata: {
          traceId,
          scanId: scan_id,
          activeKeysCount: response.active_keys_count,
          clampedKeysCount: response.clamped_keys.length,
        }
      });
    }

    return jsonResponse(response);
  } catch (error) {
    const processingTime = performance.now() - processingStartTime;
    console.error(`❌ [scan-refine-morphs] [${traceId}] PHASE B: AI refinement failed:`, error);
    // PHASE B: Return strict fallback with blend data (clamped)
    const fallbackResponse = {
      final_shape_params: requestData.blend_shape_params || {},
      final_limb_masses: requestData.blend_limb_masses || {},
      ai_refine: false,
      mapping_version: requestData.mapping_version || 'v1.0',
      clamped_keys: [],
      envelope_violations: [],
      db_violations: [],
      gender_violations: [],
      out_of_range_count: 0,
      missing_keys_added: [],
      extra_keys_removed: [],
      active_keys_count: 0,
      refinement_deltas: {
        top_10_shape_deltas: [],
        top_10_limb_deltas: [],
        total_shape_changes: 0,
        total_limb_changes: 0
      },
      ai_confidence: 0.6,
      processing_time_ms: processingTime,
      error_occurred: true,
      error_message: error instanceof Error ? error.message : "Unknown error",
      philosophy: 'phase_b_fallback_blend_data_ai_failed'
    };
    console.log(`🔧 [scan-refine-morphs] [${traceId}] PHASE B: Returning strict fallback response:`, {
      fallbackShapeParamsCount: Object.keys(fallbackResponse.final_shape_params).length,
      fallbackLimbMassesCount: Object.keys(fallbackResponse.final_limb_masses).length,
      processingTime: processingTime.toFixed(2),
      philosophy: 'phase_b_resilient_fallback'
    });
    return jsonResponse(fallbackResponse, 200); // Return 200 with fallback data
  }
});
/**
 * Calculate refinement deltas between blend and AI-refined values
 */ function calculateRefinementDeltas(blendShapeParams, blendLimbMasses, finalShapeParams, finalLimbMasses) {
  const shapeDeltas = [];
  const limbDeltas = [];
  // Calculate shape parameter deltas
  Object.keys(finalShapeParams).forEach((key)=>{
    const blendValue = blendShapeParams[key] || 0;
    const finalValue = finalShapeParams[key] || 0;
    const delta = Math.abs(finalValue - blendValue);
    if (delta > 0.01) {
      shapeDeltas.push({
        key,
        delta,
        blend: blendValue,
        final: finalValue
      });
    }
  });
  // Calculate limb mass deltas
  Object.keys(finalLimbMasses).forEach((key)=>{
    const blendValue = blendLimbMasses[key] || (key === 'gate' ? 1 : 0);
    const finalValue = finalLimbMasses[key] || (key === 'gate' ? 1 : 0);
    const delta = Math.abs(finalValue - blendValue);
    if (delta > 0.01) {
      limbDeltas.push({
        key,
        delta,
        blend: blendValue,
        final: finalValue
      });
    }
  });
  // Sort by delta magnitude and take top 10
  const topShapeDeltas = shapeDeltas.sort((a, b)=>b.delta - a.delta).slice(0, 10).map((d)=>({
      key: d.key,
      delta: parseFloat(d.delta.toFixed(3)),
      blend: parseFloat(d.blend.toFixed(3)),
      final: parseFloat(d.final.toFixed(3))
    }));
  const topLimbDeltas = limbDeltas.sort((a, b)=>b.delta - a.delta).slice(0, 10).map((d)=>({
      key: d.key,
      delta: parseFloat(d.delta.toFixed(3)),
      blend: parseFloat(d.blend.toFixed(3)),
      final: parseFloat(d.final.toFixed(3))
    }));
  return {
    topShapeDeltas,
    topLimbDeltas,
    totalShapeChanges: shapeDeltas.length,
    totalLimbChanges: limbDeltas.length
  };
}
/**
 * Count active keys (|value| > 0.05)
 */ function countActiveKeys(shapeParams, limbMasses) {
  let count = 0;
  Object.values(shapeParams).forEach((value)=>{
    if (Math.abs(value) > 0.05) count++;
  });
  Object.entries(limbMasses).forEach(([key, value])=>{
    if (key !== 'gate' && Math.abs(value - 1.0) > 0.05) count++; // For limb masses, compare to baseline 1.0
  });
  return count;
}
