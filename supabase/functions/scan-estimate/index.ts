import { corsHeaders, jsonResponse, serializeTokenUsage } from './response.ts';
import { validateEstimateRequest } from './requestValidator.ts';
import { analyzePhotosWithVision } from './visionAnalyzer.ts';
import { createFallbackEstimation } from './estimationFallback.ts';
import { enhanceMeasurements } from './measurementEnhancer.ts';
import { validateWithDatabase } from './databaseValidator.ts';
import { calculateGPT5TokenCost, logAICostTracking, type TokenUsage } from '../_shared/utils/costCalculator.ts';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';
/**
 * Scan Estimate Edge Function - DB-First Architecture
 * Handles photo analysis and measurement extraction with DB validation
 */ Deno.serve(async (req)=>{
  const requestStartTime = performance.now();
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // Log 1: Function Entry & Request Method Check
  console.log(`📥 [scan-estimate] [${traceId}] Function invoked. Method: ${req.method}`);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`🔍 [scan-estimate] [${traceId}] Handling OPTIONS request.`);
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  
  if (req.method !== "POST") {
    console.error(`❌ [scan-estimate] [${traceId}] Method not allowed: ${req.method}.`);
    return jsonResponse({
      error: "Method not allowed"
    }, 405);
  }
  try {
    // Log 2: Parse and Validate Request Data
    const requestData = await req.json();
    const validationError = validateEstimateRequest(requestData);
    if (validationError) {
      console.error(`❌ [scan-estimate] [${traceId}] Request validation failed: ${validationError}. Request data: ${JSON.stringify(requestData)}.`, {
        validationError
      });
      return jsonResponse({
        error: validationError
      }, 400);
    }
    const { user_id, photos, user_declared_height_cm, user_declared_weight_kg, user_declared_gender } = requestData;
    console.log(`📥 [scan-estimate] [${traceId}] Request received and validated.`, {
      user_id,
      photosCount: photos?.length,
      userMetrics: {
        height_cm: user_declared_height_cm,
        weight_kg: user_declared_weight_kg,
        gender: user_declared_gender
      },
      traceId,
      requestStartTime
    });
    // Log 3: Supabase Client Initialization
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [scan-estimate] Missing Supabase configuration:', {
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
    console.log('✅ [scan-estimate] Service client initialized', {
      clientType: 'service_role',
      philosophy: 'rls_bypass_controlled_access'
    });

    const estimatedTokensForBodyScan = 150;
    const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokensForBodyScan);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('SCAN_ESTIMATE', 'Insufficient tokens for body scan analysis', {
        traceId,
        userId: user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokensForBodyScan,
        timestamp: new Date().toISOString()
      });

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokensForBodyScan,
        !tokenCheck.isSubscribed,
        corsHeaders
      );
    }

    console.log('💰 [SCAN_ESTIMATE] Token check passed', {
      traceId,
      userId: user_id,
      currentBalance: tokenCheck.currentBalance,
      estimatedCost: estimatedTokensForBodyScan,
      timestamp: new Date().toISOString()
    });
    // Log 4: Photo Extraction & Availability Check
    const frontPhoto = photos.find((p)=>p.view === 'front');
    const profilePhoto = photos.find((p)=>p.view === 'profile');
    console.log('🔍 [scan-estimate] Photo availability and structure analysis:', {
      totalPhotos: photos.length,
      photosStructure: photos.map((p)=>({
          view: p.view,
          hasUrl: !!p.url,
          urlLength: p.url?.length,
          hasReport: !!p.report,
          reportKeys: p.report ? Object.keys(p.report) : [],
          reportStructure: p.report ? {
            hasQuality: !!p.report.quality,
            hasContent: !!p.report.content,
            hasScale: !!p.report.scale,
            qualityKeys: p.report.quality ? Object.keys(p.report.quality) : [],
            contentKeys: p.report.content ? Object.keys(p.report.content) : []
          } : null
        })),
      frontPhotoFound: !!frontPhoto,
      profilePhotoFound: !!profilePhoto,
      frontPhotoHasReport: !!frontPhoto?.report,
      profilePhotoHasReport: !!profilePhoto?.report
    });
    if (!frontPhoto && !profilePhoto) {
      console.error(`❌ [scan-estimate] [${traceId}] At least one photo (front or profile) is required.`);
      return jsonResponse({
        error: "At least one photo (front or profile) is required"
      }, 400);
    }
    // Log 5: Photo Quality Assessment
    const photo_quality_score = calculatePhotoQualityScore(frontPhoto?.report, profilePhoto?.report);
    console.log('🔍 [scan-estimate] Photo quality assessment:', {
      frontQuality: frontPhoto?.report?.quality || 'missing_report',
      profileQuality: profilePhoto?.report?.quality || 'missing_report',
      aggregatedScore: photo_quality_score,
      frontPhotoExists: !!frontPhoto,
      profilePhotoExists: !!profilePhoto,
      frontReportExists: !!frontPhoto?.report,
      profileReportExists: !!profilePhoto?.report,
      photoCompatibilityCheck: {
        frontPhotoUrl: frontPhoto?.url ? {
          isPublicUrl: frontPhoto.url.includes('supabase.co/storage'),
          urlLength: frontPhoto.url.length,
          urlPreview: frontPhoto.url.substring(0, 100) + '...'
        } : null,
        profilePhotoUrl: profilePhoto?.url ? {
          isPublicUrl: profilePhoto.url.includes('supabase.co/storage'),
          urlLength: profilePhoto.url.length,
          urlPreview: profilePhoto.url.substring(0, 100) + '...'
        } : null
      }
    });
    let extractionResult;
    let fallbackUsed = false;
    let fallbackReason = null;
    let tokenUsage: TokenUsage | null = null;
    // Log 6: OpenAI Vision Analysis Call
    const visionStartTime = performance.now();
    try {
      console.log(`🔍 [scan-estimate] [${traceId}] Starting OpenAI Vision analysis with enhanced diagnostics.`, {
        frontPhotoUrl: frontPhoto?.url,
        profilePhotoUrl: profilePhoto?.url,
        photosAccessible: 'checking_accessibility',
        userContext: {
          height_cm: user_declared_height_cm,
          weight_kg: user_declared_weight_kg,
          gender: user_declared_gender
        },
        timestampMs: visionStartTime.toFixed(0)
      });
      extractionResult = await analyzePhotosWithVision(frontPhoto?.url || null, profilePhoto?.url || null, {
        height_cm: user_declared_height_cm,
        weight_kg: user_declared_weight_kg,
        gender: user_declared_gender,
        frontReport: frontPhoto?.report || null,
        profileReport: profilePhoto?.report || null,
        traceId
      });

      const visionDuration = performance.now() - visionStartTime;
      
      // Calculate and log AI costs if OpenAI was used
      if (extractionResult.openai_usage) {
        tokenUsage = calculateGPT5TokenCost(
          extractionResult.openai_usage.prompt_tokens || 0,
          extractionResult.openai_usage.completion_tokens || 0,
          extractionResult.openai_usage.model || 'gpt-5',
          extractionResult.openai_usage.completion_tokens_details?.reasoning_tokens || 0
        );

        logAICostTracking('scan-estimate', tokenUsage, traceId);
        
        // Store AI analysis job record (non-blocking)
        // This is optional telemetry and should never block the main response
        try {
          const serializedTokenUsage = serializeTokenUsage(tokenUsage);

          const { error: jobError } = await supabase
            .from('ai_analysis_jobs')
            .insert({
              user_id,
              analysis_type: 'scan_estimate',
              status: 'completed',
              request_payload: {
                photos_count: photos.length,
                user_metrics: {
                  height_cm: user_declared_height_cm,
                  weight_kg: user_declared_weight_kg,
                  gender: user_declared_gender
                }
              },
              result_payload: {
                confidence: extractionResult.confidence,
                measurements: extractionResult.measurements,
                fallback_used: false
              },
              tokens_used: serializedTokenUsage,
              model_used: serializedTokenUsage?.model_used || 'unknown'
            });

          if (jobError) {
            const isPGRSTError = jobError.code?.startsWith('PGRST');
            console.warn(`⚠️ [scan-estimate] [${traceId}] Failed to store AI job record (non-blocking):`, {
              error: jobError,
              code: jobError.code,
              message: jobError.message,
              details: jobError.details,
              hint: jobError.hint,
              isPGRSTSchemaError: isPGRSTError,
              suggestedFix: isPGRSTError ? 'Execute "NOTIFY pgrst, \'reload schema\';" in Supabase SQL Editor or restart instance' : null
            });
          } else {
            console.log(`✅ [scan-estimate] [${traceId}] AI job record stored successfully`);
          }
        } catch (jobInsertError) {
          console.warn(`⚠️ [scan-estimate] [${traceId}] Exception inserting AI job record (non-blocking):`, {
            error: jobInsertError,
            errorType: typeof jobInsertError,
            errorMessage: jobInsertError instanceof Error ? jobInsertError.message : String(jobInsertError)
          });
        }
      }

      console.log(`✅ [scan-estimate] [${traceId}] OpenAI Vision analysis successful in ${visionDuration.toFixed(0)}ms.`);
      // Log 6.1: CRITICAL - Full extractionResult from OpenAI
      console.log(`✅ [scan-estimate] [${traceId}] Full extractionResult from OpenAI Vision: ${JSON.stringify(extractionResult, null, 2)}`);
    } catch (visionError) {
      const visionDuration = performance.now() - visionStartTime;
      const errorMessage = visionError instanceof Error ? visionError.message : String(visionError);
      const isTimeoutError = errorMessage.includes('Timeout') || errorMessage.includes('timeout');
      const isFormatError = errorMessage.includes('format') || errorMessage.includes('Format');
      const isAccessError = errorMessage.includes('invalid_image_url') || errorMessage.includes('download');
      console.warn(`⚠️ [scan-estimate] [${traceId}] OpenAI Vision failed after ${visionDuration.toFixed(0)}ms with detailed error analysis:`, {
        error: errorMessage,
        errorType: visionError instanceof Error ? visionError.name : typeof visionError,
        errorCategories: {
          isTimeoutError,
          isFormatError,
          isAccessError
        },
        photosContext: {
          frontPhotoUrl: frontPhoto?.url,
          profilePhotoUrl: profilePhoto?.url,
          frontPhotoSize: frontPhoto?.report ? 'has_report' : 'no_report',
          profilePhotoSize: profilePhoto?.report ? 'has_report' : 'no_report'
        },
        fallbackStrategy: 'applying_enhanced_fallback'
      });
      // Log 6.2: Fallback Strategy Determination
      const fallbackStrategyStartTime = performance.now();
      const fallbackStrategy = await determineFallbackStrategy(supabase, user_id, user_declared_gender);
      const fallbackStrategyDuration = performance.now() - fallbackStrategyStartTime;

      const fallbackEstimationStartTime = performance.now();
      extractionResult = await createFallbackEstimation({
        height_cm: user_declared_height_cm,
        weight_kg: user_declared_weight_kg,
        gender: user_declared_gender,
        frontReport: frontPhoto.report,
        profileReport: profilePhoto.report,
        fallbackStrategy
      });
      fallbackUsed = true;
      fallbackReason = isTimeoutError ? 'openai_timeout_error' : isFormatError ? 'openai_format_error' : isAccessError ? 'openai_access_error' : 'openai_general_error';
      
      // Store AI analysis job record for fallback (non-blocking)
      // This is optional telemetry and should never block the main response
      try {
        const fallbackTokenUsage = serializeTokenUsage({
          cost_estimate_usd: 0,
          total_tokens: 0,
          input_tokens: 0,
          output_tokens: 0,
          reasoning_tokens: 0,
          model_used: 'fallback',
          reasoning_cost_usd: 0,
          output_cost_usd: 0
        });

        const { error: jobError } = await supabase
          .from('ai_analysis_jobs')
          .insert({
            user_id,
            analysis_type: 'scan_estimate',
            status: 'completed',
            request_payload: {
              photos_count: photos.length,
              user_metrics: {
                height_cm: user_declared_height_cm,
                weight_kg: user_declared_weight_kg,
                gender: user_declared_gender
              }
            },
            result_payload: {
              confidence: extractionResult.confidence,
              measurements: extractionResult.measurements,
              fallback_used: true,
              fallback_reason: fallbackReason
            },
            error_message: errorMessage,
            tokens_used: fallbackTokenUsage,
            model_used: 'fallback'
          });

        if (jobError) {
          const isPGRSTError = jobError.code?.startsWith('PGRST');
          console.warn(`⚠️ [scan-estimate] [${traceId}] Failed to store fallback AI job record (non-blocking):`, {
            error: jobError,
            code: jobError.code,
            message: jobError.message,
            details: jobError.details,
            isPGRSTSchemaError: isPGRSTError,
            suggestedFix: isPGRSTError ? 'Execute "NOTIFY pgrst, \'reload schema\';" in Supabase SQL Editor or restart instance' : null
          });
        }
      } catch (jobInsertError) {
        console.warn(`⚠️ [scan-estimate] [${traceId}] Exception inserting fallback AI job record (non-blocking):`, {
          error: jobInsertError,
          errorType: typeof jobInsertError,
          errorMessage: jobInsertError instanceof Error ? jobInsertError.message : String(jobInsertError)
        });
      }
      
      const fallbackEstimationDuration = performance.now() - fallbackEstimationStartTime;
      console.log(`🔍 [scan-estimate] [${traceId}] Fallback estimation applied:`, {
        strategy: fallbackStrategy.type,
        confidence: extractionResult.confidence,
        fallbackReason,
        originalError: errorMessage,
        timings: {
          fallbackStrategyMs: fallbackStrategyDuration.toFixed(0),
          fallbackEstimationMs: fallbackEstimationDuration.toFixed(0),
          totalFallbackMs: (fallbackStrategyDuration + fallbackEstimationDuration).toFixed(0)
        },
        traceId
      });
    }
    // Log 7: Calculate Estimated BMI
    const bmiStartTime = performance.now();
    const estimated_bmi = calculateEstimatedBMI(extractionResult.measurements, user_declared_height_cm, user_declared_weight_kg);
    const bmiDuration = performance.now() - bmiStartTime;
    console.log(`🔍 [scan-estimate] [${traceId}] Estimated BMI calculated: ${estimated_bmi.toFixed(2)} (${bmiDuration.toFixed(0)}ms).`);

    // Log 8: Enhance Measurements Call
    const enhanceStartTime = performance.now();
    console.log(`🔍 [scan-estimate] [${traceId}] Measurements before enhancement: ${JSON.stringify(extractionResult.measurements, null, 2)}`);
    const enhancedMeasurements = enhanceMeasurements(extractionResult.measurements, {
      height_cm: user_declared_height_cm,
      weight_kg: user_declared_weight_kg,
      gender: user_declared_gender
    });
    const enhanceDuration = performance.now() - enhanceStartTime;
    console.log(`✅ [scan-estimate] [${traceId}] Measurements after enhancement: ${JSON.stringify(enhancedMeasurements, null, 2)} (${enhanceDuration.toFixed(0)}ms)`);

    // Log 9: Validate Measurements with Database
    const validationStartTime = performance.now();
    console.log(`🔍 [scan-estimate] [${traceId}] Starting DB-first validation for measurements.`);
    const bmiValidation = await validateWithDatabase(supabase, {
      estimated_bmi,
      raw_measurements: enhancedMeasurements,
      user_declared_height_cm,
      user_declared_weight_kg,
      user_declared_gender
    });
    const validationDuration = performance.now() - validationStartTime;
    console.log(`✅ [scan-estimate] [${traceId}] DB validation completed: ${JSON.stringify(bmiValidation, null, 2)} (${validationDuration.toFixed(0)}ms).`);
    // Log 10: Prepare Final Response
    const response = {
      extracted_data: {
        raw_measurements: enhancedMeasurements,
        estimated_bmi,
        processing_confidence: extractionResult.confidence.vision,
        photo_quality_score,
        skin_tone: extractSkinToneFromPhotos(photos, extractionResult.skin_tone) || extractionResult.skin_tone,
        skin_tone_analysis: extractionResult.skin_tone_analysis,
        keypoints: extractionResult.keypoints,
        scale_method: extractionResult.scale_method,
        pixel_per_cm: extractionResult.pixel_per_cm,
        fallback_used: fallbackUsed,
        fallback_reason: fallbackReason,
        bmi_validation: bmiValidation,
        ai_cost_tracking: tokenUsage ? {
          cost_estimate_usd: tokenUsage.cost_estimate_usd,
          total_tokens: tokenUsage.total_tokens,
          model_used: tokenUsage.model_used
        } : null
      },
      photos_metadata: photos,
      diagnostics: {
        photo_quality: {
          front: {
            blur_score: frontPhoto.report.quality.blur_score,
            brightness: frontPhoto.report.quality.brightness,
            pose_quality: extractionResult.quality_assessment?.pose_quality || 0.8
          },
          profile: {
            blur_score: profilePhoto.report.quality.blur_score,
            brightness: profilePhoto.report.quality.brightness,
            pose_quality: extractionResult.quality_assessment?.pose_quality || 0.8
          }
        },
        processing_notes: extractionResult.processing_notes || [],
        bmi_validation_flags: bmiValidation.flags || []
      }
    };
    const processingTime = performance.now() - requestStartTime;
    console.log(`✅ [scan-estimate] [${traceId}] Estimation completed successfully. Total processing time: ${processingTime.toFixed(0)}ms`, {
      processingTimeMs: processingTime.toFixed(2),
      traceId,
      breakdown: {
        visionAnalysisMs: typeof visionDuration !== 'undefined' ? visionDuration.toFixed(0) : 'N/A',
        bmiCalculationMs: bmiDuration.toFixed(0),
        enhancementMs: enhanceDuration.toFixed(0),
        validationMs: validationDuration.toFixed(0)
      }
    });
    console.log(`✅ [scan-estimate] [${traceId}] Final response keys: ${Object.keys(response).join(', ')}`);

    // MAJOR FIX: Always consume tokens, use estimated values if actual usage not available
    const modelUsed = tokenUsage?.model_used || 'gpt-5-mini';
    const inputTokens = tokenUsage?.input_tokens || estimatedTokensForBodyScan;
    const outputTokens = tokenUsage?.output_tokens || 200;
    const costUsd = tokenUsage?.cost_estimate_usd || calculateGPT5TokenCost(modelUsed, inputTokens, outputTokens);

    const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
      userId: user_id,
      edgeFunctionName: 'scan-estimate',
      operationType: 'body-scan-analysis-vision',
      openaiModel: modelUsed,
      openaiInputTokens: inputTokens,
      openaiOutputTokens: outputTokens,
      openaiCostUsd: costUsd,
      metadata: {
        traceId,
        frontPhotoProvided: !!frontPhoto,
        profilePhotoProvided: !!profilePhoto,
        estimatedHeight: response.estimated_metrics?.height_cm,
        estimatedWeight: response.estimated_metrics?.weight_kg,
        usedEstimatedTokens: !tokenUsage,
      }
    });

    console.log(`💰 [scan-estimate] [${traceId}] Tokens consumed`, {
      model: modelUsed,
      inputTokens,
      outputTokens,
      costUsd,
      usedActualUsage: !!tokenUsage
    });

    return jsonResponse(response);
  } catch (error) {
    // Log 11: Error Handling
    const processingTime = performance.now() - requestStartTime;
    console.error(`❌ [scan-estimate] [${traceId}] Estimation failed unexpectedly after ${processingTime.toFixed(0)}ms:`, error, {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : "No stack available",
      processingTimeMs: processingTime.toFixed(2),
      traceId
    });
    return jsonResponse({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
      traceId
    }, 500);
  }
});
/**
 * Calculate aggregated photo quality score
 */ function calculatePhotoQualityScore(frontReport, profileReport) {
  const defaultPhotoReport = {
    quality: {
      blur_score: 0.5,
      brightness: 0.5,
      exposure_ok: true,
      noise_score: 0.5
    },
    content: {
      single_person: true,
      pose_ok: true,
      face_detected: false,
      face_bbox_norm: null
    },
    scale: {
      pixel_per_cm_estimate: null,
      method: 'none'
    }
  };
  const safeFrontReport = frontReport || defaultPhotoReport;
  const safeProfileReport = profileReport || defaultPhotoReport;
  const frontQuality = safeFrontReport.quality || defaultPhotoReport.quality;
  const profileQuality = safeProfileReport.quality || defaultPhotoReport.quality;
  const frontContent = safeFrontReport.content || defaultPhotoReport.content;
  const profileContent = safeProfileReport.content || defaultPhotoReport.content;
  const frontQualityScore = (frontQuality.blur_score || 0.5) * 0.4 + (frontQuality.exposure_ok ? 1 : frontQuality.brightness || 0.5) * 0.3 + (frontContent.single_person ? 1 : 0) * 0.3;
  const profileQualityScore = (profileQuality.blur_score || 0.5) * 0.4 + (profileQuality.exposure_ok ? 1 : profileQuality.brightness || 0.5) * 0.3 + (profileContent.single_person ? 1 : 0) * 0.3;
  return (frontQualityScore + profileQualityScore) / 2;
}
/**
 * Calculate estimated BMI with fallback to declared values
 */ function calculateEstimatedBMI(measurements, declaredHeight, declaredWeight) {
  const height_cm = measurements.height_cm || declaredHeight;
  const weight_kg = measurements.weight_kg || declaredWeight;
  return weight_kg / Math.pow(height_cm / 100, 2);
}
/**
 * Determine fallback strategy based on user history and defaults
 * Optimized with parallel queries for faster fallback execution
 */ async function determineFallbackStrategy(supabase, user_id, gender) {
  const fallbackStartTime = performance.now();
  console.log('🔍 [scan-estimate] Starting fallback strategy determination');

  // Execute both queries in parallel for faster execution
  const [lastScanResult, archetypeResult] = await Promise.allSettled([
    user_id
      ? supabase.from('body_scans').select('metrics').eq('user_id', user_id).order('timestamp', {
          ascending: false
        }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('morph_archetypes').select('*').eq('gender_code', gender === 'masculine' ? 'MAS' : 'FEM').eq('level', 'Normal').eq('obesity', 'Non obèse').limit(1).maybeSingle()
  ]);

  // Check last scan result
  if (lastScanResult.status === 'fulfilled' && lastScanResult.value.data?.metrics?.raw_measurements) {
    const duration = performance.now() - fallbackStartTime;
    console.log(`🔍 [scan-estimate] Found last scan for fallback interpolation (${duration.toFixed(0)}ms)`);
    return {
      type: 'last_scan',
      data: lastScanResult.value.data.metrics
    };
  }

  if (lastScanResult.status === 'rejected') {
    console.warn('🔍 [scan-estimate] Failed to fetch last scan for fallback:', lastScanResult.reason);
  }

  // Check archetype result
  if (archetypeResult.status === 'fulfilled' && archetypeResult.value.data) {
    const duration = performance.now() - fallbackStartTime;
    console.log(`🔍 [scan-estimate] Using default archetype for fallback: ${archetypeResult.value.data.id} (${duration.toFixed(0)}ms)`);
    return {
      type: 'default_archetype',
      data: archetypeResult.value.data
    };
  }

  if (archetypeResult.status === 'rejected') {
    console.warn('🔍 [scan-estimate] Failed to fetch default archetype for fallback:', archetypeResult.reason);
  }

  // Ultimate fallback
  const duration = performance.now() - fallbackStartTime;
  console.warn(`🔍 [scan-estimate] Using ultimate fallback strategy (${duration.toFixed(0)}ms)`);
  return {
    type: 'ultimate_fallback',
    data: {
      id: `${gender === 'masculine' ? 'MAS' : 'FEM'}-FALLBACK-001`,
      name: 'Fallback Default',
      gender: gender === 'masculine' ? 'masculine' : 'feminine',
      level: 'Normal',
      obesity: 'Non obèse',
      muscularity: 'Normal',
      morphotype: 'REC',
      bmi_range: [
        18.5,
        25
      ],
      morph_values: {},
      limb_masses: {
        gate: 1.0,
        armMass: 1.0,
        calfMass: 1.0,
        neckMass: 1.0,
        thighMass: 1.0,
        torsoMass: 1.0,
        forearmMass: 1.0
      }
    }
  };
}
/**
 * Extract skin tone from photos with robust median calculation and AI validation
 * Returns unified skin tone with confidence and source metadata
 */
function extractSkinToneFromPhotos(photos, aiSkinTone = null) {
  if (!photos || !Array.isArray(photos)) {
    console.warn('🔍 [scan-estimate] Invalid photos array for skin tone extraction');
    return null;
  }

  // Collect all valid skin tones from photo reports
  const validSkinTones = [];
  for (const photo of photos) {
    if (photo && photo.report && photo.report.skin_tone) {
      const tone = photo.report.skin_tone;
      if (typeof tone.r === 'number' && typeof tone.g === 'number' && typeof tone.b === 'number') {
        validSkinTones.push({
          r: Math.max(0, Math.min(255, Math.round(tone.r))),
          g: Math.max(0, Math.min(255, Math.round(tone.g))),
          b: Math.max(0, Math.min(255, Math.round(tone.b))),
          source: `photo_${photo.view || 'unknown'}`,
          confidence: tone.confidence || 0.8,
          extraction_method: tone.extraction_method || 'photo_report'
        });
      }
    }
  }

  // Add AI skin tone to the pool if available
  if (aiSkinTone && typeof aiSkinTone.r === 'number' && typeof aiSkinTone.g === 'number' && typeof aiSkinTone.b === 'number') {
    validSkinTones.push({
      r: Math.max(0, Math.min(255, Math.round(aiSkinTone.r))),
      g: Math.max(0, Math.min(255, Math.round(aiSkinTone.g))),
      b: Math.max(0, Math.min(255, Math.round(aiSkinTone.b))),
      source: 'ai_vision',
      confidence: aiSkinTone.confidence || 0.9,
      region_used: aiSkinTone.region_used || 'face_detected'
    });
  }

  if (validSkinTones.length === 0) {
    console.log('🔍 [scan-estimate] No valid skin tones found in photo reports or AI');
    return null;
  }

  // Calculate robust median for each RGB channel
  const rs = validSkinTones.map(t => t.r).sort((a, b) => a - b);
  const gs = validSkinTones.map(t => t.g).sort((a, b) => a - b);
  const bs = validSkinTones.map(t => t.b).sort((a, b) => a - b);

  const median = (arr) => arr[Math.floor(arr.length / 2)];

  const medianSkinTone = {
    r: median(rs),
    g: median(gs),
    b: median(bs),
    confidence: Math.min(0.95, validSkinTones.reduce((sum, t) => sum + (t.confidence || 0.8), 0) / validSkinTones.length),
    source: 'unified_median',
    sources_used: validSkinTones.map(t => t.source),
    validation_status: 'pending'
  };

  // Validate coherence between sources (max RGB difference < 30)
  let maxDifference = 0;
  for (let i = 0; i < validSkinTones.length; i++) {
    for (let j = i + 1; j < validSkinTones.length; j++) {
      const diff = Math.max(
        Math.abs(validSkinTones[i].r - validSkinTones[j].r),
        Math.abs(validSkinTones[i].g - validSkinTones[j].g),
        Math.abs(validSkinTones[i].b - validSkinTones[j].b)
      );
      maxDifference = Math.max(maxDifference, diff);
    }
  }

  if (maxDifference > 30) {
    console.warn('⚠️ [scan-estimate] Skin tone divergence detected between sources:', {
      maxDifference,
      validSkinTones,
      medianSkinTone,
      threshold: 30,
      philosophy: 'skin_tone_validation_warning'
    });
    medianSkinTone.validation_status = 'divergent_sources';
    medianSkinTone.max_difference = maxDifference;
  } else {
    medianSkinTone.validation_status = 'coherent';
    medianSkinTone.max_difference = maxDifference;
  }

  console.log('✅ [scan-estimate] Unified skin tone extracted:', {
    skinTone: `rgb(${medianSkinTone.r}, ${medianSkinTone.g}, ${medianSkinTone.b})`,
    confidence: medianSkinTone.confidence.toFixed(3),
    sourcesCount: validSkinTones.length,
    validationStatus: medianSkinTone.validation_status,
    maxDifference,
    philosophy: 'robust_median_extraction'
  });

  return medianSkinTone;
}
