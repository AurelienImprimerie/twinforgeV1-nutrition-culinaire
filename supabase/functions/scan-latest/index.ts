import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-environment",
  "Access-Control-Allow-Origin": "*"
};

Deno.serve(async (req) => {
  const startTime = performance.now();

  // 🔍 LOG 1: Function invocation
  console.log('🔍 [scan-latest] Function invoked', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === "OPTIONS") {
    console.log('🔍 [scan-latest] Handling OPTIONS request');
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== "GET") {
    console.error('❌ [scan-latest] Invalid method:', req.method);
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  try {
    // 🔍 LOG 2: URL parsing
    const url = new URL(req.url);
    const user_id = url.searchParams.get('user_id') || 
      (req.headers.get('authorization')?.match(/Bearer (.+)/)?.[1] ? 
        extractUserIdFromJWT(req.headers.get('authorization')) : null);

    console.log('🔍 [scan-latest] URL parsing completed', {
      fullUrl: req.url,
      searchParams: Object.fromEntries(url.searchParams.entries()),
      user_id,
      userIdLength: user_id?.length,
      userIdValid: user_id && user_id.length >= 10,
      extractedFromJWT: !url.searchParams.get('user_id')
    });

    if (!user_id) {
      console.error('❌ [scan-latest] Missing user_id parameter');
      return new Response(JSON.stringify({
        error: "user_id parameter required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // 🔍 LOG 3: Environment variables check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('🔍 [scan-latest] Environment variables check', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      supabaseUrlLength: supabaseUrl?.length,
      serviceKeyLength: supabaseServiceKey?.length,
      supabaseUrlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing'
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [scan-latest] Missing Supabase configuration', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      return new Response(JSON.stringify({
        error: "Supabase configuration missing"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // 🔍 LOG 4: Supabase client initialization
    console.log('🔍 [scan-latest] Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ [scan-latest] Supabase client initialized successfully');

    // Get latest body scan for user
    console.log('🔍 [scan-latest] Fetching latest body scan', {
      user_id,
      query: 'body_scans table with user_id filter'
    });

    const { data: latestScan, error: scanError } = await supabase
      .from('body_scans')
      .select('*')
      .eq('user_id', user_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 🔍 LOG 5: Body scan query result
    console.log('🔍 [scan-latest] Body scan query completed', {
      hasLatestScan: !!latestScan,
      scanError: scanError ? {
        message: scanError.message,
        code: scanError.code,
        details: scanError.details,
        hint: scanError.hint
      } : null,
      scanId: latestScan?.id,
      scanTimestamp: latestScan?.timestamp,
      scanMetricsKeys: latestScan?.metrics ? Object.keys(latestScan.metrics) : []
    });

    if (scanError) {
      console.error('❌ [scan-latest] Database scan query failed:', {
        error: scanError,
        user_id,
        errorCode: scanError.code,
        errorMessage: scanError.message
      });
      throw new Error(`Failed to fetch latest scan: ${scanError.message}`);
    }

    if (!latestScan) {
      console.log('🔍 [scan-latest] No scans found for user', {
        user_id
      });
      return new Response(JSON.stringify({
        scan: null,
        message: "No scans found for user"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // Get user profile for additional context
    console.log('🔍 [scan-latest] Fetching user profile', {
      user_id,
      query: 'user_profile table with user_id filter'
    });

    const { data: userProfile, error: profileError } = await supabase
      .from('user_profile')
      .select('height_cm, weight_kg, sex, display_name')
      .eq('user_id', user_id)
      .single();

    // 🔍 LOG 6: User profile query result
    console.log('🔍 [scan-latest] User profile query completed', {
      hasUserProfile: !!userProfile,
      profileError: profileError ? {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint
      } : null,
      profileKeys: userProfile ? Object.keys(userProfile) : [],
      userSex: userProfile?.sex,
      userHeight: userProfile?.height_cm,
      userWeight: userProfile?.weight_kg
    });

    if (profileError) {
      console.warn('⚠️ [scan-latest] Failed to fetch user profile (non-blocking):', {
        error: profileError,
        user_id,
        errorCode: profileError.code,
        errorMessage: profileError.message
      });
    }

    // Prepare response with scan data and user context
    console.log('🔍 [scan-latest] Preparing response data...');

    // 🔍 LOG 7: Response data preparation
    const archetypeId = latestScan.metrics?.archetype?.id || latestScan.metrics?.archetype_match?.archetype_id;
    const blendWeights = latestScan.metrics?.archetype?.blend || latestScan.metrics?.archetype_match?.blend_weights;

    // CRITICAL FIX: Robust gender detection from archetype ID with fallback
    let detectedGender = latestScan.metrics?.detected_gender;

    // Primary: Use stored detected_gender from metrics (most reliable)
    if (detectedGender) {
      console.log('🔍 [scan-latest] Using stored detected_gender from metrics', {
        detectedGender,
        source: 'metrics.detected_gender'
      });
    } else if (latestScan.metrics?.archetype_match?.archetype_id) {
      const archetypeMatchId = latestScan.metrics.archetype_match.archetype_id;
      if (archetypeMatchId.startsWith('FEM-')) {
        detectedGender = 'female';
        console.log('🔍 [scan-latest] Detected female from archetype_match.archetype_id', {
          archetypeMatchId,
          detectedGender
        });
      } else if (archetypeMatchId.startsWith('MAS-')) {
        detectedGender = 'male';
        console.log('🔍 [scan-latest] Detected male from archetype_match.archetype_id', {
          archetypeMatchId,
          detectedGender
        });
      }
    } else if (latestScan.metrics?.archetype?.id) {
      const legacyArchetypeId = latestScan.metrics.archetype.id;
      if (legacyArchetypeId.startsWith('FEM-')) {
        detectedGender = 'female';
        console.log('🔍 [scan-latest] Detected female from legacy archetype.id', {
          legacyArchetypeId,
          detectedGender
        });
      } else if (legacyArchetypeId.startsWith('MAS-')) {
        detectedGender = 'male';
        console.log('🔍 [scan-latest] Detected male from legacy archetype.id', {
          legacyArchetypeId,
          detectedGender
        });
      }
    } else if (userProfile?.sex) {
      detectedGender = userProfile.sex;
      console.log('🔍 [scan-latest] Using fallback gender from user profile', {
        fallbackGender: detectedGender,
        reason: 'no_gender_detected_from_archetype_id'
      });
    } else {
      detectedGender = 'male';
      console.log('🔍 [scan-latest] Using final fallback gender', {
        detectedGender,
        reason: 'no_gender_information_available'
      });
    }

    console.log('🔍 [scan-latest] Response data analysis', {
      scanMetrics: {
        hasMetrics: !!latestScan.metrics,
        metricsKeys: latestScan.metrics ? Object.keys(latestScan.metrics) : [],
        hasLimbMasses: !!latestScan.metrics?.limb_masses,
        hasShapeParams: !!latestScan.metrics?.shape_params,
        hasArchetypeMatch: !!latestScan.metrics?.archetype_match,
        hasConfidence: !!latestScan.metrics?.confidence
      },
      extractedData: {
        archetypeId,
        blendWeights: blendWeights ? blendWeights.length : 0,
        detectedGender,
        confidenceVision: latestScan.metrics?.confidence?.vision
      }
    });

    const response = {
      scan: {
        id: latestScan.id,
        timestamp: latestScan.timestamp,
        metrics: latestScan.metrics,
        
        // Extract archetype information for frontend access
        archetype_id: archetypeId,
        blend_weights: blendWeights,
        detected_gender: detectedGender,
        
        // ENHANCED: Extract skin tone and analysis for frontend
        skin_tone: latestScan.metrics?.skin_tone,
        skin_tone_analysis: latestScan.metrics?.skin_tone_analysis,
        
        user_context: userProfile ? {
          height_cm: userProfile.height_cm,
          weight_kg: userProfile.weight_kg,
          sex: detectedGender || userProfile.sex || 'male',
          display_name: userProfile.display_name
        } : null
      },
      ready_for_3d: !!(latestScan.metrics?.limb_masses && 
                       latestScan.metrics?.archetype_match && 
                       latestScan.metrics?.confidence?.vision > 0.7)
    };

    // 🔍 LOG 8: Final response validation
    const processingTime = performance.now() - startTime;
    console.log('✅ [scan-latest] Response prepared successfully', {
      processingTimeMs: processingTime.toFixed(2),
      responseKeys: Object.keys(response),
      scanId: response.scan.id,
      hasMetrics: !!response.scan.metrics,
      readyFor3D: response.ready_for_3d,
      archetypeId: response.scan.archetype_id,
      detectedGender: response.scan.detected_gender,
      hasSkinTone: !!response.scan.skin_tone,
      skinToneRGB: response.scan.skin_tone ? 
        `rgb(${response.scan.skin_tone.r}, ${response.scan.skin_tone.g}, ${response.scan.skin_tone.b})` : 'none',
      hasSkinToneAnalysis: !!response.scan.skin_tone_analysis,
      hasUserContext: !!response.scan.user_context,
      responseSize: JSON.stringify(response).length
    });

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error('❌ [scan-latest] Function failed', {
      processingTimeMs: processingTime.toFixed(2),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      user_id: new URL(req.url).searchParams.get('user_id')
    });

    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
      processing_time_ms: processingTime.toFixed(2)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});

/**
 * Extract user ID from JWT token
 */
function extractUserIdFromJWT(authHeader) {
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch (error) {
    console.warn('🔍 [scan-latest] Failed to extract user_id from JWT:', error);
    return null;
  }
}