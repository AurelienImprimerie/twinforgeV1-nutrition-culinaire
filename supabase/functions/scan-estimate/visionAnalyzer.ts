/**
 * Vision Analyzer
 * OpenAI Vision API integration for photo analysis
 */

/**
 * Fetch with timeout to prevent hanging requests
 */
async function fetchWithTimeout(
  input: Request | string,
  init: RequestInit = {},
  timeoutMs = 120000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Retry configuration for OpenAI API calls
 * OPTIMIZED: Reduced retries for faster failure recovery
 */
const RETRY_CONFIG = {
  maxRetries: 2, // OPTIMIZED: Reduced from 3 to 2
  initialDelayMs: 500, // OPTIMIZED: Reduced from 1000ms to 500ms
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [502, 503, 504, 429]
};

/**
 * Sleep utility for retry delays
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(status: number, error: any): boolean {
  // Retry on specific HTTP status codes
  if (RETRY_CONFIG.retryableStatusCodes.includes(status)) {
    return true;
  }

  // Retry on network errors
  if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attemptNumber: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Analyze photos using OpenAI Vision API with retry logic
 */
export async function analyzePhotosWithVision(frontPhotoUrl, profilePhotoUrl, userMetrics) {
  const traceId = userMetrics.traceId || 'unknown';
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }
  // Check if we have at least one photo
  if (!frontPhotoUrl && !profilePhotoUrl) {
    throw new Error('At least one photo URL is required');
  }
  const bmi = userMetrics.weight_kg / Math.pow(userMetrics.height_cm / 100, 2);
  console.log(`🔍 [visionAnalyzer] [${traceId}] Calling OpenAI Vision API with enhanced prompt`, {
    model: 'gpt-5-mini',
    userMetrics: {
      height_cm: userMetrics.height_cm,
      weight_kg: userMetrics.weight_kg,
      gender: userMetrics.gender,
      bmi: bmi.toFixed(2)
    },
    availablePhotos: {
      front: !!frontPhotoUrl,
      profile: !!profilePhotoUrl
    },
    traceId
  });
  // Enhanced prompt focused on keypoints and measurements extraction
  const qualityContext = buildQualityContext(userMetrics);
  const prompt = buildEnhancedAnalysisPrompt(userMetrics, bmi, qualityContext, !!frontPhotoUrl, !!profilePhotoUrl);
  // Build content array with available photos only
  const content = [
    {
      type: 'text',
      text: prompt
    }
  ];
  if (frontPhotoUrl) {
    content.push({
      type: 'image_url',
      image_url: {
        url: frontPhotoUrl
      }
    });
  }
  if (profilePhotoUrl) {
    content.push({
      type: 'image_url',
      image_url: {
        url: profilePhotoUrl
      }
    });
  }
  const callStartTime = performance.now();
  console.log(`🔍 [visionAnalyzer] [${traceId}] Starting OpenAI API call with 120s timeout and retry capability`);

  let lastError: any = null;
  let response: Response | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const attemptStartTime = performance.now();

      if (attempt > 1) {
        const retryDelay = calculateRetryDelay(attempt - 1);
        console.log(`🔄 [visionAnalyzer] [${traceId}] Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries} after ${retryDelay}ms delay`, {
          previousError: lastError?.message || 'Unknown error',
          previousStatus: lastError?.status,
          philosophy: 'exponential_backoff_retry'
        });
        await sleep(retryDelay);
      }

      response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            response_format: {
              type: "json_object"
            },
            messages: [
              {
                role: 'user',
                content: content
              }
            ],
            max_completion_tokens: 8000 // OPTIMIZED: Reduced from 12000 to 8000 for faster responses
            // Note: GPT-5-mini supports default temperature (1) - parameter omitted to use default
          })
        },
        90000 // OPTIMIZED: 90 second timeout (reduced from 120s for faster responses)
      );

      // Success - break out of retry loop
      if (response.ok) {
        const attemptDuration = performance.now() - attemptStartTime;
        if (attempt > 1) {
          console.log(`✅ [visionAnalyzer] [${traceId}] Retry succeeded on attempt ${attempt}`, {
            attemptDuration: attemptDuration.toFixed(0),
            totalAttempts: attempt,
            philosophy: 'retry_success'
          });
        }
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(response.status, null)) {
        console.log(`❌ [visionAnalyzer] [${traceId}] Non-retryable error: ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          philosophy: 'non_retryable_error'
        });
        break; // Exit retry loop for non-retryable errors
      }

      // Store error for retry
      lastError = { status: response.status, statusText: response.statusText, message: `HTTP ${response.status}` };

      // If this was the last attempt, break
      if (attempt === RETRY_CONFIG.maxRetries) {
        console.error(`❌ [visionAnalyzer] [${traceId}] All retry attempts exhausted`, {
          totalAttempts: attempt,
          lastError: lastError,
          philosophy: 'retry_exhausted'
        });
        break;
      }

    } catch (error) {
      const attemptDuration = performance.now() - attemptStartTime;
      lastError = error;

      console.error(`❌ [visionAnalyzer] [${traceId}] Attempt ${attempt} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        attemptDuration: attemptDuration.toFixed(0),
        isRetryable: isRetryableError(0, error),
        philosophy: 'attempt_failed'
      });

      // Check if error is retryable
      if (!isRetryableError(0, error)) {
        console.log(`❌ [visionAnalyzer] [${traceId}] Non-retryable error type`, {
          errorType: error?.name,
          errorMessage: error instanceof Error ? error.message : 'Unknown',
          philosophy: 'non_retryable_error_type'
        });
        throw error; // Re-throw non-retryable errors immediately
      }

      // If this was the last attempt, throw the error
      if (attempt === RETRY_CONFIG.maxRetries) {
        console.error(`❌ [visionAnalyzer] [${traceId}] All retry attempts exhausted with error`, {
          totalAttempts: attempt,
          finalError: error instanceof Error ? error.message : 'Unknown error',
          philosophy: 'retry_exhausted_with_error'
        });
        throw error;
      }
    }
  }

  // Ensure we have a response
  if (!response) {
    throw lastError || new Error('OpenAI Vision API call failed without response');
  }

  const callDuration = performance.now() - callStartTime;
  console.log(`✅ [visionAnalyzer] [${traceId}] OpenAI API call completed in ${callDuration.toFixed(0)}ms`);
  if (!response.ok) {
    const errorBody = await response.text();
    const callDuration = performance.now() - callStartTime;
    console.error('❌ [visionAnalyzer] OpenAI API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
      durationMs: callDuration.toFixed(0)
    });
    let errorMessage = createDetailedAPIError(response.status, errorBody);
    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson.error?.message) {
        errorMessage = createDetailedAPIError(response.status, errorJson.error.message);
      }
    } catch (parseError) {
      errorMessage = createDetailedAPIError(response.status, errorBody);
    }
    throw new Error(errorMessage);
  }
  const result = await response.json();
  const responseContent = result.choices[0]?.message?.content;
  const finishReason = result.choices[0]?.finish_reason;

  // Check for reasoning token exhaustion
  if (!responseContent && finishReason === 'length') {
    const reasoningTokens = result.usage?.completion_tokens_details?.reasoning_tokens || 0;
    const completionTokens = result.usage?.completion_tokens || 0;
    console.error('❌ [visionAnalyzer] GPT-5-mini reasoning tokens exhausted - finish_reason: length', {
      usage: result.usage,
      reasoning_tokens: reasoningTokens,
      completion_tokens: completionTokens,
      prompt_tokens: result.usage?.prompt_tokens,
      total_tokens: result.usage?.total_tokens,
      finish_reason: finishReason,
      reasoning_token_percentage: completionTokens > 0 ? Math.round((reasoningTokens / completionTokens) * 100) : 0,
      diagnostic: 'Reasoning tokens consumed all available completion tokens. Check prompt complexity.'
    });
    throw new Error('OpenAI Vision exceeded token limit - reasoning consumed all available tokens');
  }

  // Proactive warning if reasoning tokens are high (>70% of completion tokens)
  const reasoningTokens = result.usage?.completion_tokens_details?.reasoning_tokens || 0;
  const completionTokens = result.usage?.completion_tokens || 0;
  if (completionTokens > 0 && (reasoningTokens / completionTokens) > 0.7) {
    console.warn(`⚠️ [visionAnalyzer] [${traceId}] High reasoning token usage detected`, {
      reasoning_tokens: reasoningTokens,
      completion_tokens: completionTokens,
      reasoning_percentage: Math.round((reasoningTokens / completionTokens) * 100),
      diagnostic: 'Consider prompt optimization if this occurs frequently',
      traceId
    });
  }

  if (!responseContent) {
    console.error('❌ [visionAnalyzer] OpenAI Vision response details:', {
      choices: result.choices,
      usage: result.usage,
      finish_reason: finishReason
    });
    throw new Error('OpenAI Vision returned empty content');
  }
  try {
    const parsed = parseVisionResponse(responseContent);
    // Validate and enhance measurements
    if (parsed.measurements) {
      parsed.measurements = validateAndEnhanceMeasurements(parsed, userMetrics);
    }

    // Include usage statistics for cost tracking
    parsed.openai_usage = {
      prompt_tokens: result.usage?.prompt_tokens || 0,
      completion_tokens: result.usage?.completion_tokens || 0,
      total_tokens: result.usage?.total_tokens || 0,
      model: 'gpt-5-mini',
      completion_tokens_details: result.usage?.completion_tokens_details || {}
    };

    console.log(`✅ [visionAnalyzer] [${traceId}] Vision analysis completed successfully`, {
      confidence: parsed.confidence,
      scaleMethod: parsed.scale_method,
      measurementsKeys: Object.keys(parsed.measurements || {}),
      reasoning_tokens: result.usage?.completion_tokens_details?.reasoning_tokens || 0,
      completion_tokens: result.usage?.completion_tokens || 0,
      prompt_tokens: result.usage?.prompt_tokens || 0,
      total_tokens: result.usage?.total_tokens || 0,
      reasoning_token_percentage: result.usage?.completion_tokens > 0 ? Math.round(((result.usage?.completion_tokens_details?.reasoning_tokens || 0) / result.usage.completion_tokens) * 100) : 0,
      traceId
    });
    return parsed;
  } catch (error) {
    console.error(`❌ [visionAnalyzer] [${traceId}] Failed to parse OpenAI response:`, responseContent);
    throw new Error('Failed to parse OpenAI Vision response');
  }
}
/**
 * Build enhanced analysis prompt for better extraction
 */ function buildEnhancedAnalysisPrompt(userMetrics, bmi, qualityContext, hasFront, hasProfile) {
  const photoDescription = hasFront && hasProfile ? 'face/profil' : hasFront ? 'face' : 'profil';
  const analysisNote = hasFront && hasProfile ? '' : ' (1 photo: estimation simplifiée)';
  return `Expert morphologie. Extrais keypoints + mesures de ${photoDescription}${analysisNote}.

PROFIL: ${userMetrics.height_cm}cm | ${userMetrics.weight_kg}kg | ${userMetrics.gender} | BMI ${bmi.toFixed(1)}
${qualityContext}

EXTRAIS:
1. Keypoints épaules/taille/hanches/coudes/genoux (x,y,conf 0-1)
2. Mesures cm: taille/poitrine/hanches
3. Échelle pixel/cm via hauteur totale
4. Composition: masse grasse/musculaire
5. PEAU: Multi-zones (visage 60%, cou 25%, bras 15%)
   - Moyenne pondérée, compense éclairage
   - Formule sRGB→Linear: c≤0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4
   - Confiance >0.85 si ≥2 zones concordantes

JSON requis:
{
  "keypoints": {"front": [[x,y,c],...], "profile": [[x,y,c],...]},
  "measurements": {"waist_cm": n, "hips_cm": n, "chest_cm": n, "height_cm": n, "weight_kg": n, "estimated_body_fat_perc": n, "estimated_muscle_mass_kg": n},
  "skin_tone": {
    "schema": "v2", "space": "sRGB", "format": "rgb255",
    "rgb": {"r": 0-255, "g": 0-255, "b": 0-255},
    "hex": "#RRGGBB",
    "srgb_f32": {"r": 0-1, "g": 0-1, "b": 0-1},
    "linear_f32": {"r": 0-1, "g": 0-1, "b": 0-1},
    "confidence": 0-1,
    "zones_analyzed": ["face","neck",...],
    "lighting_compensation": "auto_adjusted",
    "undertone": "warm/cool/neutral",
    "ethnicity_hint": string
  },
  "confidence": {"vision": 0-1, "fit": 0-1},
  "quality_assessment": {"photo_quality": 0-1, "pose_quality": 0-1},
  "scale_method": string,
  "pixel_per_cm": n
}

SKIP face proportions. Coordonnées 0-1. JSON compact uniquement.`;
}
/**
 * Build quality context from photo reports
 */ function buildQualityContext(userMetrics) {
  let context = 'QUALITÉ:';
  if (userMetrics.frontReport) {
    context += ` Face:${userMetrics.frontReport.quality.blur_score > 0.6 ? 'net' : 'flou'},${(userMetrics.frontReport.quality.brightness * 100).toFixed(0)}%`;
  }
  if (userMetrics.profileReport) {
    context += ` Profil:${userMetrics.profileReport.quality.blur_score > 0.6 ? 'net' : 'flou'},${(userMetrics.profileReport.quality.brightness * 100).toFixed(0)}%`;
  }
  return context;
}
/**
 * Build analysis prompt for OpenAI Vision
 */ function buildAnalysisPrompt(userMetrics, bmi, qualityContext) {
  return `Tu es un expert en analyse morphologique pour reconstruction 3D. Extrais UNIQUEMENT les keypoints anatomiques et les mesures corporelles de ces 2 photos (face/profil).

PROFIL UTILISATEUR:
- Height: ${userMetrics.height_cm}cm
- Weight: ${userMetrics.weight_kg}kg  
- Gender: ${userMetrics.gender}
- BMI: ${bmi.toFixed(1)}

${qualityContext}

MISSION: Extraction pure de keypoints et mesures corporelles. Ne génère AUCUN paramètre morphologique (shape_params, limb_masses).

Pour chaque photo, identifie:
1. Points anatomiques clés (épaules, taille, hanches, etc.) avec coordonnées précises
2. Mesures corporelles en centimètres (tour de taille, poitrine, hanches)
3. Estimation d'échelle via taille du visage/tête
4. Validation de pose (bras dégagés, pieds visibles, alignement correct)
5. Estimation de composition corporelle (masse grasse, masse musculaire)

Retourne JSON avec:
{
  "keypoints": {
    "front": [[x,y,confidence], ...] (coordonnées normalisées 0-1),
    "profile": [[x,y,confidence], ...] (coordonnées normalisées 0-1)
  },
  "measurements": {
    "waist_cm": number (tour de taille),
    "hips_cm": number (tour de hanches),
    "chest_cm": number (tour de poitrine),
    "height_cm": number (taille estimée depuis les photos),
    "weight_kg": number (poids estimé par analyse visuelle),
    "estimated_body_fat_perc": number (pourcentage de masse grasse estimé),
    "estimated_muscle_mass_kg": number (masse musculaire estimée en kg)
  },
  "confidence": {
    "vision": number (0-1, confiance dans l'extraction des keypoints),
    "fit": number (0-1, confiance dans les mesures corporelles)
  },
  "quality_assessment": {
    "photo_quality": number (0-1, qualité globale des photos),
    "pose_quality": number (0-1, qualité de la pose pour l'analyse)
  },
  "scale_method": string ("face-heuristic", "body-proportion", "reference-object"),
  "pixel_per_cm": number (échelle pixels par centimètre)
}

FOCUS EXTRACTION PURE:
- Keypoints anatomiques précis avec coordonnées normalisées
- Mesures corporelles en centimètres (taille, poitrine, hanches)
- Estimation de composition corporelle (masse grasse/musculaire)
- Validation de qualité photo et pose
- Calcul d'échelle pixel/cm fiable

IMPORTANT:
- Extraction pure sans interprétation morphologique
- Mesures anatomiques directes depuis les photos
- Gestion des photos de qualité variable
- Estimation robuste même avec éclairage/pose imparfaits

Réponds en JSON compact uniquement.`;
}
/**
 * Parse OpenAI Vision response
 */ function parseVisionResponse(content) {
  // Clean the content to extract JSON if it's wrapped in markdown or other text
  let jsonContent = content.trim();
  // Remove markdown code blocks if present
  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  // Find JSON object boundaries if there's extra text
  const jsonStart = jsonContent.indexOf('{');
  const jsonEnd = jsonContent.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
  }
  const parsed = JSON.parse(jsonContent);
  // Ensure measurements property exists and is an object
  if (!parsed.measurements || typeof parsed.measurements !== 'object') {
    parsed.measurements = {};
  }
  return parsed;
}
/**
 * Validate and enhance measurements from vision response
 */ function validateAndEnhanceMeasurements(visionResponse, userMetrics) {
  const measurements = visionResponse.measurements || {};
  // Always include user-provided data as fallback
  measurements.height_cm = measurements.height_cm || userMetrics.height_cm;
  measurements.weight_kg = measurements.weight_kg || userMetrics.weight_kg;
  // Validate anatomical consistency
  if (measurements.hips_cm < measurements.waist_cm) {
    measurements.hips_cm = measurements.waist_cm + 5;
  }
  if (measurements.chest_cm < measurements.waist_cm - 20) {
    measurements.chest_cm = measurements.waist_cm - 10;
  }
  return measurements;
}
/**
 * Create detailed API error messages with user guidance
 */ function createDetailedAPIError(status, errorBody) {
  switch(status){
    case 400:
      return 'Format de photo non supporté par l\'IA. Utilisez des photos JPEG de bonne qualité.';
    case 401:
      return 'Problème d\'authentification avec le service IA. Réessayez dans quelques instants.';
    case 429:
      return 'Nos serveurs IA sont très sollicités. Patientez 30 secondes et réessayez.';
    case 500:
    case 502:
    case 503:
      return 'Service IA temporairement indisponible. Réessayez dans quelques minutes.';
    case 413:
      return 'Photos trop volumineuses pour l\'analyse IA. Utilisez des images plus petites.';
    default:
      if (errorBody.includes('timeout')) {
        return 'Délai d\'analyse IA dépassé. Vérifiez votre connexion et réessayez.';
      }
      if (errorBody.includes('rate limit')) {
        return 'Limite d\'utilisation IA atteinte. Patientez quelques minutes.';
      }
      return `Erreur IA (${status}). Réessayez ou contactez le support.`;
  }
}
