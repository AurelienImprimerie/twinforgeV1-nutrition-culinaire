/**
 * Semantic Analyzer
 * OpenAI Vision API integration for semantic morphological analysis
 */ /**
 * Analyze photos for semantic morphological descriptors using OpenAI Vision
 */ export async function analyzePhotosForSemantics(frontPhotoUrl, profilePhotoUrl, userMetrics) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }
  const bmi = userMetrics.weight_kg / Math.pow(userMetrics.height_cm / 100, 2);
  const prompt = buildSemanticPrompt(userMetrics, bmi);
  console.log('🔍 [semanticAnalyzer] Starting OpenAI semantic analysis', {
    frontPhotoUrl: frontPhotoUrl.substring(0, 50) + '...',
    profilePhotoUrl: profilePhotoUrl.substring(0, 50) + '...',
    userMetrics: {
      height_cm: userMetrics.height_cm,
      weight_kg: userMetrics.weight_kg,
      gender: userMetrics.gender,
      bmi: bmi.toFixed(2),
      estimated_muscle_definition_score: userMetrics.estimated_muscle_definition_score,
      estimated_muscle_volume_score: userMetrics.estimated_muscle_volume_score // Log pour vérification
    }
  });
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: frontPhotoUrl
                }
              },
              {
                type: 'image_url',
                image_url: {
                  url: profilePhotoUrl
                }
              }
            ]
          }
        ],
        max_completion_tokens: 8000 // OPTIMIZED: Reduced from 12000 to 8000 for faster responses
        // Note: GPT-5-mini supports default temperature (1) - parameter omitted to use default
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ [semanticAnalyzer] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      throw new Error(createDetailedSemanticAPIError(response.status, errorBody));
    }
    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    const finishReason = result.choices[0]?.finish_reason;

    // Check for reasoning token exhaustion
    if (!content && finishReason === 'length') {
      console.error('❌ [semanticAnalyzer] GPT-5 reasoning tokens exhausted - finish_reason: length', {
        usage: result.usage,
        reasoning_tokens: result.usage?.completion_tokens_details?.reasoning_tokens,
        completion_tokens: result.usage?.completion_tokens,
        prompt_tokens: result.usage?.prompt_tokens,
        total_tokens: result.usage?.total_tokens,
        finish_reason: finishReason,
        diagnostic: 'Reasoning tokens consumed all available completion tokens. Check prompt complexity.'
      });
      throw new Error('OpenAI semantic analysis exceeded token limit - reasoning consumed all available tokens');
    }

    if (!content) {
      console.warn('⚠️ [semanticAnalyzer] OpenAI returned empty content');
      throw new Error('OpenAI returned empty content');
    }
    const parsed = parseSemanticResponse(content);
    // Validate semantic response structure
    if (!validateSemanticResponseStructure(parsed)) {
      console.warn('⚠️ [semanticAnalyzer] Invalid semantic response structure');
      throw new Error('Invalid semantic response structure');
    }
    // Ensure measurements are included with user data as fallback
    if (!parsed.measurements) {
      parsed.measurements = createFallbackMeasurements(userMetrics);
    } else {
      // Ensure critical measurements are present
      parsed.measurements.height_cm = parsed.measurements.height_cm || userMetrics.height_cm;
      parsed.measurements.weight_kg = parsed.measurements.weight_kg || userMetrics.weight_kg;
    }
    // Calculate overall confidence
    parsed.confidence.overall = (parsed.confidence.semantic + parsed.confidence.measurements) / 2;
    // Set overall confidence to semantic confidence only
    parsed.confidence.overall = parsed.confidence.semantic;
    console.log('✅ [semanticAnalyzer] OpenAI semantic analysis successful', {
      muscularity: parsed.muscularity_level,
      adiposity: parsed.adiposity_level,
      bodyShapePrimary: parsed.body_shape_primary,
      fatDistribution: parsed.fat_distribution,
      confidence: parsed.confidence,
      morphValuesExtracted: {
        pearFigure: parsed.pearFigure,
        emaciated: parsed.emaciated,
        bodybuilderSize: parsed.bodybuilderSize,
        bigHips: parsed.bigHips,
        assLarge: parsed.assLarge
      },
      reasoning_tokens: result.usage?.completion_tokens_details?.reasoning_tokens || 0,
      completion_tokens: result.usage?.completion_tokens || 0,
      reasoning_token_percentage: result.usage?.completion_tokens > 0 ? Math.round(((result.usage?.completion_tokens_details?.reasoning_tokens || 0) / result.usage.completion_tokens) * 100) : 0
    });
    return parsed;
  } catch (fetchError) {
    console.error('❌ [semanticAnalyzer] OpenAI API request failed:', fetchError);
    throw fetchError;
  }
}
/**
 * Build semantic analysis prompt
 */ function buildSemanticPrompt(userMetrics, bmi) {
  const muscleDefinitionScore = userMetrics.estimated_muscle_definition_score !== undefined ? userMetrics.estimated_muscle_definition_score.toFixed(2) : 'N/A';
  const muscleVolumeScore = userMetrics.estimated_muscle_volume_score !== undefined ? userMetrics.estimated_muscle_volume_score.toFixed(2) : 'N/A';
  return `Expert morphologie. Analyse CORPS (skip face). ${userMetrics.height_cm}cm|${userMetrics.weight_kg}kg|${userMetrics.gender}|BMI ${bmi.toFixed(1)}. Muscle:Def ${muscleDefinitionScore}|Vol ${muscleVolumeScore}

EXTRAIS 16 keys (-3/+3): pearFigure,emaciated,bodybuilderSize,bodybuilderDetails,bigHips,assLarge,narrowWaist,superBreast,breastsSmall,pregnant,animeWaist,breastsSag,dollBody,animeProportion,animeNeck,nipples

JSON requis:
{
  "pearFigure":n,"emaciated":n,"bodybuilderSize":n,"bodybuilderDetails":n,"bigHips":n,"assLarge":n,"narrowWaist":n,"superBreast":n,"breastsSmall":n,"pregnant":n,"animeWaist":n,"breastsSag":n,"dollBody":n,"animeProportion":n,"animeNeck":n,"nipples":n,
  "muscularity_level":n(0-1),"adiposity_level":n(0-1),"body_types":["POM/POI/OVA/SAB/REC/TRI"],"body_shape_primary":"str","muscle_definition":n(0-1),"fat_distribution":"upper/lower/central/even",
  "region_scores":{"shoulders_width":n(-1/+1),"chest_depth":n,"waist_circ":n,"hips_width":n,"glutes_projection":n},
  "flags":{"clothes_baggy":bool,"arms_away_from_body":bool,"hair_volume_high":bool,"posture_good":bool,"lighting_adequate":bool},
  "confidence":{"semantic":n(0-1)}
}

ÉCHELLE: 0-0.3:Min|0.3-0.45:Ton|0.45-0.65:Mod|0.65-0.85:Dev|0.85-1:Ath. BMI normal+muscles visibles=≥0.65. Cherche séparation,vascularisation. Base sur scores pré-analysés. JSON compact.`;
}
/**
 * Parse semantic response from OpenAI
 */ function parseSemanticResponse(content) {
  let jsonContent = content.trim();
  // Clean JSON extraction
  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  const jsonStart = jsonContent.indexOf('{');
  const jsonEnd = jsonContent.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
  }
  return JSON.parse(jsonContent);
}
/**
 * Validate semantic response structure
 */ function validateSemanticResponseStructure(response) {
  const requiredFields = [
    'muscularity_level',
    'adiposity_level',
    'body_types',
    'body_shape_primary',
    'muscle_definition',
    'fat_distribution',
    'region_scores',
    'flags',
    'confidence',
    'pearFigure',
    'emaciated',
    'bodybuilderSize'
  ];
  for (const field of requiredFields){
    if (!(field in response)) {
      console.warn(`⚠️ [validateSemanticResponse] Missing required field: ${field}`);
      return false;
    }
  }
  // Validate numeric ranges
  if (response.muscularity_level < 0 || response.muscularity_level > 1 || response.adiposity_level < 0 || response.adiposity_level > 1 || response.muscle_definition < 0 || response.muscle_definition > 1) {
    console.warn('⚠️ [validateSemanticResponse] Numeric values out of range');
    return false;
  }
  // Validate morph values ranges (-3 to +3)
  const morphKeys = [
    'pearFigure',
    'emaciated',
    'bodybuilderSize',
    'bodybuilderDetails',
    'bigHips',
    'assLarge',
    'narrowWaist',
    'superBreast',
    'breastsSmall',
    'pregnant',
    'animeWaist',
    'breastsSag',
    'dollBody',
    'animeProportion',
    'animeNeck',
    'nipples'
  ];
  for (const key of morphKeys){
    if (key in response && (response[key] < -3 || response[key] > 3)) {
      console.warn(`⚠️ [validateSemanticResponse] Morph value ${key} out of range: ${response[key]}`);
      return false;
    }
  }
  // Validate body_types array
  if (!Array.isArray(response.body_types) || response.body_types.length === 0) {
    console.warn('⚠️ [validateSemanticResponse] Invalid body_types array');
    return false;
  }
  // Validate region_scores structure
  const requiredRegionScores = [
    'shoulders_width',
    'chest_depth',
    'waist_circ',
    'hips_width',
    'glutes_projection'
  ];
  for (const region of requiredRegionScores){
    if (!(region in response.region_scores) || response.region_scores[region] < -1 || response.region_scores[region] > 1) {
      console.warn(`⚠️ [validateSemanticResponse] Invalid region score: ${region}`);
      return false;
    }
  }
  return true;
}
function createFallbackMeasurements(userMetrics) {
  return {
    height_cm: userMetrics.height_cm,
    weight_kg: userMetrics.weight_kg
  };
}
function createDetailedSemanticAPIError(status, errorBody) {
  return `OpenAI API error: ${status} - ${errorBody}`;
}
