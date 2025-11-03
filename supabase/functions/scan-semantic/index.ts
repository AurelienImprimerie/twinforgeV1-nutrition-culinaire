// supabase/functions/scan-semantic/index.ts
import { corsHeaders, jsonResponse } from './response.ts';
import { validateSemanticRequest } from './requestValidator.ts';
import { analyzePhotosForSemantics } from './semanticAnalyzer.ts';
import { validateSemanticWithDB, getDefaultSemanticProfile } from './dbSemanticValidator.ts';
import { createFallbackSemanticAnalysis } from './semanticFallback.ts';
import { refetchMorphologyMapping } from '../_shared/utils/mappingRefetcher.ts';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

/**
 * Scan Semantic Edge Function - DB-First Architecture
 * Generates semantic morphological profile and validates against DB classification rules
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      error: "Method not allowed"
    }, 405);
  }

  try {
    // Parse and validate request
    const requestData = await req.json();
    const validationError = validateSemanticRequest(requestData);

    if (validationError) {
      console.error('❌ [scan-semantic] Request validation failed:', validationError);
      return jsonResponse({
        error: validationError
      }, 400);
    }

    const { user_id, photos, extracted_data, user_declared_gender } = requestData;

    console.log('📥 [scan-semantic] Request received:', {
      user_id,
      photosCount: photos?.length,
      extractedDataKeys: Object.keys(extracted_data || {}),
      userGender: user_declared_gender,
      estimatedBMI: extracted_data?.estimated_bmi
    });

    // Initialize Supabase client for DB validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [scan-semantic] Missing Supabase configuration:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        urlPreview: supabaseUrl?.substring(0, 30) + '...' || 'missing',
        serviceKeyPreview: supabaseServiceKey ? 'eyJ...' + supabaseServiceKey.slice(-10) : 'missing'
      });
      return jsonResponse({
        error: "Supabase configuration missing"
      }, 500);
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ [scan-semantic] Service client initialized', {
      clientType: 'service_role',
      philosophy: 'rls_bypass_controlled_access'
    });

    const estimatedTokensForSemantic = 100;
    const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokensForSemantic);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('SCAN_SEMANTIC', 'Insufficient tokens for semantic analysis', {
        userId: user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokensForSemantic,
        timestamp: new Date().toISOString()
      });

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokensForSemantic,
        !tokenCheck.isSubscribed,
        corsHeaders
      );
    }

    console.log('💰 [SCAN_SEMANTIC] Token check passed', {
      userId: user_id,
      currentBalance: tokenCheck.currentBalance,
      estimatedCost: estimatedTokensForSemantic,
      timestamp: new Date().toISOString()
    });

    const frontPhoto = photos.find(p => p.view === 'front');
    const profilePhoto = photos.find(p => p.view === 'profile');

    if (!frontPhoto || !profilePhoto) {
      console.error('❌ [scan-semantic] Missing front or profile photo');
      return jsonResponse({
        error: "Both front and profile photos required"
      }, 400);
    }

    // Étape 1.1 : Récupérer le mapping morphologique
    console.log('🔍 [scan-semantic] Fetching morphology mapping for clamping raw AI values');
    const mappingData = await refetchMorphologyMapping('v1.0', user_declared_gender); // Utiliser une version de mapping ou la récupérer dynamiquement

    // CRITICAL FIX: Use fallback mapping if database fetch fails
    let finalMappingData = mappingData;
    if (!mappingData) {
      console.error('❌ [scan-semantic] Failed to fetch morphology mapping for clamping. Using hardcoded fallback.');
      const { getHardcodedMappingFallback } = await import('../morphology-mapping/fallbackMapping.ts');
      const fallbackMapping = getHardcodedMappingFallback();
      finalMappingData = user_declared_gender === 'feminine' ? 
        fallbackMapping.mapping_feminine : 
        fallbackMapping.mapping_masculine;
      
      console.log('✅ [scan-semantic] Using hardcoded fallback mapping:', {
        user_declared_gender,
        morphValuesCount: Object.keys(finalMappingData.morph_values || {}).length,
        limbMassesCount: Object.keys(finalMappingData.limb_masses || {}).length,
        source: 'hardcoded_fallback'
      });
    }

    console.log('🔍 [scan-semantic] Starting semantic analysis with DB validation');

    // Step 1: AI Semantic Analysis
    let rawSemanticProfile;
    let aiAnalysisSuccess = false;

    try {
      rawSemanticProfile = await analyzePhotosForSemantics(
        frontPhoto.url,
        profilePhoto.url,
        {
          height_cm: extracted_data.raw_measurements.height_cm,
          weight_kg: extracted_data.raw_measurements.weight_kg,
          gender: user_declared_gender,
          estimated_bmi: extracted_data.estimated_bmi,
          frontReport: frontPhoto.report,
          profileReport: profilePhoto.report
        }
      );
      aiAnalysisSuccess = true;

      // Étape 1.2 : Appliquer le Clamping aux valeurs morphologiques brutes
      if (finalMappingData && rawSemanticProfile) {
        const clampedRawSemanticProfile = { ...rawSemanticProfile };
        for (const key in rawSemanticProfile) {
          if (rawSemanticProfile.hasOwnProperty(key) && typeof rawSemanticProfile[key] === 'number') {
            const range = finalMappingData.morph_values?.[key];
            if (range) {
              const originalValue = clampedRawSemanticProfile[key];
              const clampedValue = Math.max(range.min, Math.min(range.max, originalValue));
              if (originalValue !== clampedValue) {
                clampedRawSemanticProfile[key] = clampedValue;
                console.log(`🔧 [scan-semantic] Clamped raw morph value ${key}: ${originalValue.toFixed(3)} -> ${clampedValue.toFixed(3)} (DB range: [${range.min.toFixed(3)}, ${range.max.toFixed(3)}])`);
              }
            }
          }
        }
        rawSemanticProfile = clampedRawSemanticProfile;
      }

      console.log('✅ [scan-semantic] AI facial semantic analysis complete:', {
        face_shape: rawSemanticProfile.face_shape,
        eye_shape: rawSemanticProfile.eye_shape,
        nose_type: rawSemanticProfile.nose_type,
        lip_full_ness: rawSemanticProfile.lip_fullness, // Corrected typo
        confidence: rawSemanticProfile.confidence?.semantic
      });

    } catch (semanticError) {
      console.warn('⚠️ [scan-semantic] AI semantic analysis failed, using fallback:', semanticError);
      rawSemanticProfile = createFallbackSemanticAnalysis({
        height_cm: extracted_data.raw_measurements.height_cm,
        weight_kg: extracted_data.raw_measurements.weight_kg,
        gender: user_declared_gender,
        estimated_bmi: extracted_data.estimated_bmi,
        frontReport: frontPhoto.report,
        profileReport: profilePhoto.report
      });
    }

    // Step 2: DB-First Classification Validation
    console.log('🔍 [scan-semantic] Validating semantic profile against DB classification rules');
    const { validatedProfile, validationFlags, adjustmentsMade } = await validateSemanticWithDB(
      supabase,
      rawSemanticProfile,
      extracted_data,
      user_declared_gender
    );

    console.log('✅ [scan-semantic] DB validation results:', {
      validatedProfile: {
        obesity: validatedProfile.obesity,
        muscularity: validatedProfile.muscularity,
        level: validatedProfile.level,
        morphotype: validatedProfile.morphotype
      },
      validationFlags: validationFlags.length,
      adjustmentsMade: adjustmentsMade.length
    });

    // Step 3: Calculate final confidence
    let finalConfidence = rawSemanticProfile.confidence?.semantic || 0.5;

    // Reduce confidence based on adjustments made
    if (adjustmentsMade.length > 0) {
      const adjustmentPenalty = Math.min(0.3, adjustmentsMade.length * 0.1);
      finalConfidence = Math.max(0.1, finalConfidence - adjustmentPenalty);
    }

    // Reduce confidence if fallback was used
    if (!aiAnalysisSuccess) {
      finalConfidence = Math.max(0.1, finalConfidence * 0.6);
    }

    const response = {
      semantic_profile: validatedProfile,
      raw_semantic_profile: rawSemanticProfile,
      semantic_confidence: finalConfidence,
      semantic_validation_flags: validationFlags,
      adjustments_made: adjustmentsMade,
      ai_analysis_success: aiAnalysisSuccess,
      fallback_reason: aiAnalysisSuccess ? null : 'ai_semantic_analysis_failed'
    };

    console.log('✅ [scan-semantic] Semantic analysis completed successfully', {
      validatedProfile: {
        obesity: validatedProfile.obesity,
        muscularity: validatedProfile.muscularity,
        level: validatedProfile.level,
        morphotype: validatedProfile.morphotype
      },
      finalConfidence: finalConfidence.toFixed(3),
      validationFlags: validationFlags.length,
      adjustmentsMade: adjustmentsMade.length,
      aiSuccess: aiAnalysisSuccess
    });

    if (aiAnalysisSuccess && rawSemanticProfile?.ai_metadata?.usage) {
      const usage = rawSemanticProfile.ai_metadata.usage;
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      const costUsd = (inputTokens * 0.25 / 1000000) + (outputTokens * 2.00 / 1000000);

      const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
        userId: user_id,
        edgeFunctionName: 'scan-semantic',
        operationType: 'semantic-morphology-analysis',
        openaiModel: 'gpt-5-mini',
        openaiInputTokens: inputTokens,
        openaiOutputTokens: outputTokens,
        openaiCostUsd: costUsd,
        metadata: {
          morphotype: validatedProfile.morphotype,
          obesityLevel: validatedProfile.obesity,
          muscularityLevel: validatedProfile.muscularity,
        }
      });
    }

    return jsonResponse(response);

  } catch (error) {
    console.error('❌ [scan-semantic] Semantic analysis failed:', error);
    return jsonResponse({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

