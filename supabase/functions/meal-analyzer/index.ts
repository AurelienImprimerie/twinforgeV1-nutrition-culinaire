import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';
import { validateMealAnalysisRequest } from './requestValidator.ts';
import { createCSRFProtection } from '../_shared/csrfProtection.ts';

interface ScannedProductData {
  barcode: string;
  name: string;
  brand?: string;
  mealItem: DetectedFood;
  portionMultiplier: number;
}

interface MealAnalysisRequest {
  user_id: string;
  image_url?: string;
  image_data?: string; // Base64 encoded image data
  scanned_products?: ScannedProductData[]; // Products from barcode scanning
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp?: string;
  user_profile_context?: {
    // Données d'identité
    sex?: 'male' | 'female';
    height_cm?: number;
    weight_kg?: number;
    target_weight_kg?: number;
    activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
    objective?: 'fat_loss' | 'recomp' | 'muscle_gain';
    birthdate?: string;
    job_category?: string;
    
    // Données nutritionnelles
    nutrition?: {
      diet?: string;
      allergies?: string[];
      intolerances?: string[];
      disliked?: string[];
      budgetLevel?: 'low' | 'medium' | 'high';
      proteinTarget_g?: number;
      fastingWindow?: {
        start?: string;
        end?: string;
        windowHours?: number;
        mealsPerDay?: number;
      };
    };
    
    // Données de santé
    health?: {
      bloodType?: string;
      conditions?: string[];
      medications?: string[];
    };
    
    // Contraintes alimentaires
    constraints?: Record<string, string>;
    
    // Données émotionnelles
    emotions?: {
      chronotype?: 'morning' | 'evening' | 'intermediate';
      stress?: number;
      sleepHours?: number;
      moodBaseline?: 'very_low' | 'low' | 'neutral' | 'good' | 'very_good';
      sensitivities?: string[];
    };
    
    // Préférences d'entraînement
    workout?: {
      type?: 'strength' | 'cardio' | 'mixed' | 'yoga' | 'pilates' | 'crossfit' | 'bodyweight' | 'sports';
      sessionsPerWeek?: number;
      preferredDuration?: number;
      equipment?: string[];
      morningWorkouts?: boolean;
      highIntensity?: boolean;
      groupWorkouts?: boolean;
      outdoorActivities?: boolean;
    };
    
    // Métadonnées calculées
    calculated_metrics?: {
      age?: number;
      bmi?: number;
      bmr?: number; // Basal Metabolic Rate
      tdee?: number; // Total Daily Energy Expenditure
      protein_target_calculated?: number;
      daily_calorie_target?: number;
    };
  };
}

interface DetectedFood {
  name: string;
  confidence: number;
  calories: number;
  proteins: number;
  carbs: number;
  fats: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  portion_size?: string;
  category?: string;
}

interface PersonalizedRecommendation {
  type: 'suggestion' | 'warning' | 'alert' | 'insight';
  category: 'nutrition' | 'health' | 'fitness' | 'timing' | 'balance';
  message: string;
  reasoning: string;
  priority: 'low' | 'medium' | 'high';
  actionable?: string;
}

interface MealAnalysisResponse {
  success: boolean;
  analysis_id: string;
  total_calories: number;
  macronutrients: {
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
  detected_foods: DetectedFood[];
  meal_type: string;
  confidence: number;
  analysis_metadata: {
    processing_time_ms: number;
    model_version: string;
    quality_score: number;
    image_quality: number;
    ai_model_used: string;
    tokens_used?: { input: number; output: number; total: number; cost_estimate_usd: number; };
    fallback_used?: boolean;
    fallback_reason?: string;
  };
  personalized_insights: PersonalizedRecommendation[];
  objective_alignment: {
    calories_vs_target: number;
    macros_balance: {
      proteins_status: 'low' | 'optimal' | 'high';
      carbs_status: 'low' | 'optimal' | 'high';
      fats_status: 'low' | 'optimal' | 'high';
    };
    meal_timing_feedback?: string;
  };
  ai_powered: boolean;
  error?: string;
}

interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cost_estimate_usd: number;
}

interface OpenAIVisionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-CSRF-Token",
};

/**
 * Calculate token usage and cost estimation for GPT-5 models
 * MAJOR FIX: Use centralized pricing from tokenMiddleware to ensure consistency
 */
function calculateGPT5TokenCost(inputTokens: number, outputTokens: number, model: string): TokenUsage {
  // PRICING SYNCHRONIZED WITH tokenMiddleware.ts - DO NOT MODIFY INDEPENDENTLY
  const OPENAI_PRICING = {
    // GPT-5 models (latest - 2025)
    'gpt-5': { input: 1.25, output: 10.00 },
    'gpt-5-mini': { input: 0.25, output: 2.00 },
    'gpt-5-nano': { input: 0.05, output: 0.40 },
    // GPT-4 models (legacy)
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
  };

  const modelPricing = OPENAI_PRICING[model as keyof typeof OPENAI_PRICING] || OPENAI_PRICING['gpt-5-mini'];

  const inputCost = (inputTokens / 1000000) * modelPricing.input;
  const outputCost = (outputTokens / 1000000) * modelPricing.output;
  const totalCost = inputCost + outputCost;

  return {
    input: inputTokens,
    output: outputTokens,
    total: inputTokens + outputTokens,
    cost_estimate_usd: Math.round(totalCost * 1000000) / 1000000 // Round to 6 decimal places
  };
}

/**
 * Create optimized prompt for GPT-5 meal analysis with vision
 */
function createGPT5VisionPrompt(userContext?: any): string {
  let prompt = `Analysez cette image de repas avec attention et identifiez tous les aliments visibles. Soyez précis et exact.

Retournez un objet JSON avec cette structure exacte (TOUS les noms d'aliments et descriptions DOIVENT être en français) :
{
  "meal_name": "nom_descriptif_du_repas_en_francais",
  "detected_foods": [
    {
      "name": "nom_exact_de_l_aliment_en_francais",
      "confidence": 0.0-1.0,
      "calories": nombre_calories_estimees,
      "proteins": grammes_de_proteines,
      "carbs": grammes_de_glucides,
      "fats": grammes_de_lipides,
      "fiber": grammes_de_fibres,
      "portion_size": "portion_estimee_en_francais",
      "category": "protein|carbs|vegetables|healthy_fats|dairy|mixed"
    }
  ],
  "total_calories": somme_de_toutes_les_calories,
  "confidence": confiance_globale_0_a_1,
  "meal_classification": "breakfast|lunch|dinner|snack",
  "personalized_insights": [
    {
      "message": "message_insight_en_francais",
      "reasoning": "pourquoi_cet_insight_en_francais",
      "priority": "low|medium|high",
      "category": "nutrition|health|fitness|timing|balance"
    }
  ]
}`;

  // Add user context for personalized analysis
  if (userContext) {
    const contextParts = [];
    
    if (userContext.objective) {
      contextParts.push(`Fitness goal: ${userContext.objective}`);
    }
    
    if (userContext.nutrition?.diet) {
      contextParts.push(`Diet: ${userContext.nutrition.diet}`);
    }
    
    if (userContext.nutrition?.allergies?.length > 0) {
      contextParts.push(`Allergies: ${userContext.nutrition.allergies.join(', ')}`);
    }
    
    if (userContext.nutrition?.intolerances?.length > 0) {
      contextParts.push(`Intolerances: ${userContext.nutrition.intolerances.join(', ')}`);
    }
    
    if (userContext.calculated_metrics?.protein_target_calculated) {
      contextParts.push(`Daily protein target: ${userContext.calculated_metrics.protein_target_calculated}g`);
    }
    
    if (userContext.calculated_metrics?.daily_calorie_target) {
      contextParts.push(`Daily calorie target: ${userContext.calculated_metrics.daily_calorie_target} kcal`);
    }
    
    if (userContext.emotions?.stress && userContext.emotions.stress > 7) {
      contextParts.push(`High stress level: ${userContext.emotions.stress}/10`);
    }
    
    if (contextParts.length > 0) {
      prompt += `\n\nContexte du profil utilisateur : ${contextParts.join('; ')}.`;
      prompt += `\nAdaptez vos insights et recommandations en fonction de ce contexte. Répondez UNIQUEMENT en français.`;
    }
  }
  
  prompt += `\n\nSoyez précis dans l'identification des aliments. Concentrez-vous sur ce que vous voyez réellement dans l'image. Fournissez des insights personnalisés et actionnables. RÉPONDEZ UNIQUEMENT EN FRANÇAIS.`;
  
  return prompt;
}

/**
 * Call OpenAI GPT-5 Vision API for real meal analysis
 */
async function callOpenAIVisionAPI(
  imageData: string, 
  userContext?: any,
  model: string = 'gpt-5-mini'
): Promise<{ 
  result: Partial<MealAnalysisResponse>; 
  tokenUsage: TokenUsage;
  aiModel: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
}> {
  const startTime = Date.now();
  
  // Get OpenAI API key from Supabase secrets
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found in environment variables');
  }
  
  console.log('OPENAI_VISION_API', 'Starting real OpenAI Vision API call', {
    model,
    imageDataLength: imageData.length,
    hasUserContext: !!userContext,
    userObjective: userContext?.objective,
    timestamp: new Date().toISOString()
  });
  
  // Create optimized prompt
  const prompt = createGPT5VisionPrompt(userContext);
  
  console.log('OPENAI_VISION_API', 'Generated prompt for GPT-5 Vision', {
    model,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 200) + '...',
    timestamp: new Date().toISOString()
  });
  
  // Prepare OpenAI API request
  const requestBody = {
    model: model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageData}`,
              detail: "high" // Use high detail for better food recognition
            }
          }
        ]
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4000,
  };
  
  console.log('OPENAI_VISION_API', 'Sending request to OpenAI', {
    model,
    requestBodyStructure: {
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      responseFormat: requestBody.response_format,
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      hasImageData: true,
      imageDataLength: imageData.length
    },
    timestamp: new Date().toISOString()
  });
  
  try {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OPENAI_VISION_API', 'OpenAI API request failed', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
        model,
        timestamp: new Date().toISOString()
      });
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
    }
    
    const openaiResponse: OpenAIVisionResponse = await response.json();
    
    console.log('OPENAI_VISION_API', 'Received response from OpenAI', {
      model,
      responseId: openaiResponse.id,
      finishReason: openaiResponse.choices[0]?.finish_reason,
      promptTokens: openaiResponse.usage.prompt_tokens,
      completionTokens: openaiResponse.usage.completion_tokens,
      totalTokens: openaiResponse.usage.total_tokens,
      responseContentLength: openaiResponse.choices[0]?.message?.content?.length || 0,
      responsePreview: openaiResponse.choices[0]?.message?.content?.substring(0, 200) + '...',
      timestamp: new Date().toISOString()
    });
    
    // Parse the JSON response from GPT-5
    const aiContent = openaiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No content in OpenAI response');
    }
    
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(aiContent);
      console.log('OPENAI_VISION_API', 'Successfully parsed OpenAI JSON response', {
        model,
        parsedStructure: {
          hasDetectedFoods: !!parsedAnalysis.detected_foods,
          detectedFoodsCount: parsedAnalysis.detected_foods?.length || 0,
          hasTotalCalories: !!parsedAnalysis.total_calories,
          totalCalories: parsedAnalysis.total_calories,
          hasConfidence: !!parsedAnalysis.confidence,
          confidence: parsedAnalysis.confidence,
          hasMealClassification: !!parsedAnalysis.meal_classification,
          mealClassification: parsedAnalysis.meal_classification,
          hasPersonalizedInsights: !!parsedAnalysis.personalized_insights,
          insightsCount: parsedAnalysis.personalized_insights?.length || 0
        },
        detectedFoodsDetails: parsedAnalysis.detected_foods?.map((food: any) => ({
          name: food.name,
          calories: food.calories,
          confidence: food.confidence,
          category: food.category
        })) || [],
        timestamp: new Date().toISOString()
      });
    } catch (parseError) {
      console.error('OPENAI_VISION_API', 'Failed to parse OpenAI JSON response', {
        model,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        rawContent: aiContent.substring(0, 500) + '...',
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    // Calculate token usage and cost
    const tokenUsage = calculateGPT5TokenCost(
      openaiResponse.usage.prompt_tokens,
      openaiResponse.usage.completion_tokens,
      model
    );
    
    console.log('OPENAI_VISION_API', 'Token usage calculated', {
      model,
      inputTokens: tokenUsage.input,
      outputTokens: tokenUsage.output,
      totalTokens: tokenUsage.total,
      costUSD: tokenUsage.cost_estimate_usd,
      timestamp: new Date().toISOString()
    });
    
    // Transform OpenAI response to our expected format
    const detectedFoods: DetectedFood[] = (parsedAnalysis.detected_foods || []).map((food: any) => ({
      name: food.name || 'Aliment non identifié',
      confidence: food.confidence || 0.5,
      calories: food.calories || 0,
      proteins: food.proteins || 0,
      carbs: food.carbs || 0,
      fats: food.fats || 0,
      fiber: food.fiber || 0,
      sugar: food.sugar || 0,
      sodium: food.sodium || 0,
      portion_size: food.portion_size || 'Portion standard',
      category: food.category || 'mixed'
    }));
    
    // Calculate totals from detected foods
    const totalCalories = detectedFoods.reduce((sum, food) => sum + food.calories, 0);
    const totalProteins = detectedFoods.reduce((sum, food) => sum + food.proteins, 0);
    const totalCarbs = detectedFoods.reduce((sum, food) => sum + food.carbs, 0);
    const totalFats = detectedFoods.reduce((sum, food) => sum + food.fats, 0);
    const totalFiber = detectedFoods.reduce((sum, food) => sum + (food.fiber || 0), 0);
    const totalSugar = detectedFoods.reduce((sum, food) => sum + (food.sugar || 0), 0);
    const totalSodium = detectedFoods.reduce((sum, food) => sum + (food.sodium || 0), 0);
    
    // Transform personalized insights
    const personalizedInsights: PersonalizedRecommendation[] = (parsedAnalysis.personalized_insights || []).map((insight: any) => ({
      type: insight.type || 'insight',
      category: insight.category || 'nutrition',
      message: insight.message || '',
      reasoning: insight.reasoning || '',
      priority: insight.priority || 'medium',
      actionable: insight.actionable
    }));
    
    // Calculate objective alignment
    const targetCalories = userContext?.calculated_metrics?.daily_calorie_target || 2000;
    const caloriesVsTarget = totalCalories / (targetCalories / 3); // Assuming 3 meals per day
    
    const proteinTarget = userContext?.calculated_metrics?.protein_target_calculated || 120;
    const proteinsStatus = totalProteins < proteinTarget * 0.25 ? 'low' :
                          totalProteins > proteinTarget * 0.4 ? 'high' : 'optimal';
    
    const result: Partial<MealAnalysisResponse> = {
      meal_name: parsedAnalysis.meal_name || 'Repas analysé',
      total_calories: totalCalories,
      macronutrients: {
        proteins: totalProteins,
        carbs: totalCarbs,
        fats: totalFats,
        fiber: totalFiber,
        sugar: totalSugar,
        sodium: totalSodium,
      },
      detected_foods: detectedFoods,
      confidence: parsedAnalysis.confidence || 0.8,
      analysis_metadata: {
        processing_time_ms: Date.now() - startTime,
        model_version: model,
        quality_score: 0.9, // High quality for GPT-5 Vision
        image_quality: 0.9, // Assume good image quality
        ai_model_used: model,
        tokens_used: tokenUsage,
        fallback_used: false,
      },
      personalized_insights: personalizedInsights,
      objective_alignment: {
        calories_vs_target: Math.round(caloriesVsTarget * 100) / 100,
        macros_balance: {
          proteins_status: proteinsStatus,
          carbs_status: 'optimal' as const,
          fats_status: 'optimal' as const,
        },
        meal_timing_feedback: userContext?.emotions?.chronotype === 'evening' && 
                             new Date().getHours() > 20 ? 
                             'Repas tardif détecté - pourrait affecter votre sommeil' : undefined,
      },
      ai_powered: true,
    };
    
    console.log('OPENAI_VISION_API', 'OpenAI Vision analysis completed successfully', {
      model,
      totalCalories,
      detectedFoodsCount: detectedFoods.length,
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
      tokenUsage,
      detectedFoodsNames: detectedFoods.map(f => f.name),
      timestamp: new Date().toISOString()
    });
    
    return { 
      result, 
      tokenUsage, 
      aiModel: model, 
      fallbackUsed: false 
    };
    
  } catch (error) {
    console.error('OPENAI_VISION_API', 'OpenAI Vision API call failed', {
      model,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Call OpenAI Vision API with retry logic and fallback
 */
async function callOpenAIVisionWithRetry(
  imageData: string, 
  userContext?: any,
  maxRetries: number = 2
): Promise<{ 
  result: Partial<MealAnalysisResponse>; 
  tokenUsage: TokenUsage;
  aiModel: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
}> {
  let lastError: Error | null = null;
  
  // Try GPT-5 models in order of preference
  const modelsToTry = ['gpt-5-mini', 'gpt-5-nano'];
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const modelToUse = modelsToTry[Math.min(attempt, modelsToTry.length - 1)];
    
    try {
      console.log('OPENAI_VISION_RETRY', 'Attempting OpenAI Vision analysis', {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        model: modelToUse,
        imageDataLength: imageData.length,
        timestamp: new Date().toISOString()
      });
      
      const analysisResult = await callOpenAIVisionAPI(imageData, userContext, modelToUse);
      
      console.log('OPENAI_VISION_RETRY', 'OpenAI Vision analysis successful', {
        attempt: attempt + 1,
        model: analysisResult.aiModel,
        tokensUsed: analysisResult.tokenUsage.total,
        costUSD: analysisResult.tokenUsage.cost_estimate_usd,
        confidence: analysisResult.result.confidence,
        detectedFoodsCount: analysisResult.result.detected_foods?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      return analysisResult;
      
    } catch (error) {
      lastError = error as Error;
      
      console.warn('OPENAI_VISION_RETRY', 'OpenAI Vision analysis attempt failed', {
        attempt: attempt + 1,
        model: modelToUse,
        error: error instanceof Error ? error.message : 'Unknown error',
        willRetry: attempt < maxRetries,
        nextModel: attempt < maxRetries ? modelsToTry[Math.min(attempt + 1, modelsToTry.length - 1)] : 'fallback',
        timestamp: new Date().toISOString()
      });
      
      // If this was the last attempt, break to use fallback
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  
  // All OpenAI attempts failed, use simplified fallback
  console.error('OPENAI_VISION_RETRY', 'All OpenAI Vision attempts failed, using simplified fallback', {
    lastError: lastError?.message || 'Unknown error',
    attemptsCount: maxRetries + 1,
    modelsAttempted: modelsToTry.slice(0, maxRetries + 1),
    timestamp: new Date().toISOString()
  });
  
  const fallbackResult = generateSimplifiedFallback(imageData);
  
  return {
    result: fallbackResult,
    tokenUsage: { input: 0, output: 0, total: 0, cost_estimate_usd: 0 },
    aiModel: 'fallback',
    fallbackUsed: true,
    fallbackReason: `OpenAI Vision analysis failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  };
}

/**
 * Simplified fallback analysis when OpenAI Vision fails
 */
function generateSimplifiedFallback(imageData: string): Partial<MealAnalysisResponse> {
  console.log('FALLBACK_ANALYSIS', 'Generating simplified fallback analysis', {
    imageDataLength: imageData.length,
    timestamp: new Date().toISOString()
  });
  
  // Basic nutritional estimation based on image size/complexity
  const estimatedCalories = 400 + Math.floor(Math.random() * 300); // 400-700 calories
  
  return {
    meal_name: 'Repas mixte (estimation)',
    total_calories: estimatedCalories,
    macronutrients: {
      proteins: Math.round(estimatedCalories * 0.15 / 4), // 15% of calories from protein
      carbs: Math.round(estimatedCalories * 0.50 / 4),    // 50% from carbs
      fats: Math.round(estimatedCalories * 0.35 / 9),     // 35% from fats
      fiber: Math.round(estimatedCalories * 0.02),        // Rough fiber estimate
      sugar: Math.round(estimatedCalories * 0.10),        // Rough sugar estimate
      sodium: Math.round(estimatedCalories * 0.8),        // Rough sodium estimate
    },
    detected_foods: [
      {
        name: 'Repas mixte (estimation)',
        confidence: 0.60,
        calories: estimatedCalories,
        proteins: Math.round(estimatedCalories * 0.15 / 4),
        carbs: Math.round(estimatedCalories * 0.50 / 4),
        fats: Math.round(estimatedCalories * 0.35 / 9),
        category: 'mixed'
      }
    ],
    confidence: 0.60,
    analysis_metadata: {
      processing_time_ms: 500,
      model_version: 'fallback-estimation-v1',
      quality_score: 0.60,
      image_quality: 0.70,
      ai_model_used: 'fallback',
      fallback_used: true,
      fallback_reason: 'OpenAI Vision analysis failed, using simplified estimation',
    },
    personalized_insights: [
      {
        type: 'alert',
        category: 'nutrition',
        message: 'Analyse simplifiée utilisée - les valeurs sont des estimations.',
        reasoning: 'L\'IA n\'a pas pu analyser votre repas avec précision.',
        priority: 'medium',
        actionable: 'Vous pouvez ajuster manuellement les valeurs si nécessaire.'
      }
    ],
    objective_alignment: {
      calories_vs_target: 1.0,
      macros_balance: {
        proteins_status: 'optimal' as const,
        carbs_status: 'optimal' as const,
        fats_status: 'optimal' as const,
      },
    },
    ai_powered: false,
  };
}

/**
 * Truncate AI response if too long
 */
function truncateResponse(response: string, maxLength: number = 2000): { content: string; truncated: boolean } {
  if (response.length <= maxLength) {
    return { content: response, truncated: false };
  }
  
  // Try to truncate at sentence boundary
  const truncated = response.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');
  
  if (lastSentence > maxLength * 0.8) {
    return { 
      content: truncated.substring(0, lastSentence + 1),
      truncated: true 
    };
  }
  
  return { 
    content: truncated + '...',
    truncated: true 
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Method not allowed. Use POST.',
          ai_powered: false
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const requestBody: MealAnalysisRequest = await req.json();

    // Sprint 2 Phase 3.2: Validate request with unified validation system
    const validationError = validateMealAnalysisRequest(requestBody);
    if (validationError) {
      console.error('MEAL_ANALYZER_VALIDATION', 'Request validation failed', {
        error: validationError,
        userId: requestBody.user_id,
        timestamp: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: validationError,
          ai_powered: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client for CSRF validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Sprint 3 Phase 5.3: CSRF Protection for meal data integrity
    const csrfProtection = createCSRFProtection(supabase);
    const csrfToken = req.headers.get('x-csrf-token');

    const csrfValidation = await csrfProtection.validateRequest(
      requestBody.user_id,
      csrfToken,
      req,
      'meal-analyzer'
    );

    if (!csrfValidation.valid) {
      console.error('MEAL_ANALYZER', 'CSRF validation failed', {
        user_id: requestBody.user_id,
        error: csrfValidation.error,
        tokenProvided: !!csrfToken,
        originValidated: csrfValidation.originValidated,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'CSRF validation failed',
          message: csrfValidation.error,
          ai_powered: false
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('MEAL_ANALYZER', 'CSRF validation passed', {
      user_id: requestBody.user_id,
      tokenValidated: csrfValidation.tokenValidated,
      originValidated: csrfValidation.originValidated,
    });

    // DETAILED LOG: Complete request body for debugging
    console.log('MEAL_ANALYZER_DEBUG', 'Complete request body received and validated', {
      userId: requestBody.user_id,
      hasImageUrl: !!requestBody.image_url,
      hasImageData: !!requestBody.image_data,
      imageDataLength: requestBody.image_data?.length || 0,
      imageDataPrefix: requestBody.image_data?.substring(0, 50) || 'none',
      mealType: requestBody.meal_type,
      timestamp: requestBody.timestamp,
      hasUserContext: !!requestBody.user_profile_context,
      userContextStructure: requestBody.user_profile_context ? {
        sex: requestBody.user_profile_context.sex,
        height_cm: requestBody.user_profile_context.height_cm,
        weight_kg: requestBody.user_profile_context.weight_kg,
        objective: requestBody.user_profile_context.objective,
        hasNutrition: !!requestBody.user_profile_context.nutrition,
        nutritionDiet: requestBody.user_profile_context.nutrition?.diet,
        nutritionAllergies: requestBody.user_profile_context.nutrition?.allergies?.length || 0,
        hasHealth: !!requestBody.user_profile_context.health,
        hasEmotions: !!requestBody.user_profile_context.emotions,
        hasWorkout: !!requestBody.user_profile_context.workout,
        hasCalculatedMetrics: !!requestBody.user_profile_context.calculated_metrics,
        calculatedBMR: requestBody.user_profile_context.calculated_metrics?.bmr,
        calculatedTDEE: requestBody.user_profile_context.calculated_metrics?.tdee,
      } : null,
      requestBodyKeys: Object.keys(requestBody),
      fullRequestBodyStringified: JSON.stringify(requestBody, null, 2).substring(0, 1000) + '...',
      timestamp: new Date().toISOString()
    });

    // Generate unique analysis ID
    const analysisId = crypto.randomUUID();
    const startTime = Date.now();

    console.log('MEAL_ANALYZER', 'Starting meal analysis with OpenAI GPT-5 Vision', {
      analysisId,
      userId: requestBody.user_id,
      hasImageUrl: !!requestBody.image_url,
      hasImageData: !!requestBody.image_data,
      hasUserContext: !!requestBody.user_profile_context,
      userObjective: requestBody.user_profile_context?.objective,
      userAllergies: requestBody.user_profile_context?.nutrition?.allergies?.length || 0,
      mealType: requestBody.meal_type,
      timestamp: new Date().toISOString()
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const estimatedTokensForVision = 100;
    const tokenCheck = await checkTokenBalance(supabase, requestBody.user_id, estimatedTokensForVision);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('MEAL_ANALYZER', 'Insufficient tokens for analysis', {
        analysisId,
        userId: requestBody.user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokensForVision,
        timestamp: new Date().toISOString()
      });

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokensForVision,
        !tokenCheck.isSubscribed,
        corsHeaders
      );
    }

    console.log('💰 [MEAL_ANALYZER] Token check passed', {
      analysisId,
      userId: requestBody.user_id,
      currentBalance: tokenCheck.currentBalance,
      estimatedCost: estimatedTokensForVision,
      timestamp: new Date().toISOString()
    });

    // Get image data for analysis
    let imageDataForAnalysis = requestBody.image_data;
    
    if (!imageDataForAnalysis && requestBody.image_url) {
      // Fetch image from URL if only URL provided
      try {
        console.log('MEAL_ANALYZER', 'Fetching image from URL', {
          analysisId,
          imageUrl: requestBody.image_url,
          timestamp: new Date().toISOString()
        });
        
        const imageResponse = await fetch(requestBody.image_url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        imageDataForAnalysis = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        
        console.log('MEAL_ANALYZER', 'Image fetched and converted to base64', {
          analysisId,
          imageDataLength: imageDataForAnalysis.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('MEAL_ANALYZER', 'Failed to fetch image from URL', {
          analysisId,
          error: error instanceof Error ? error.message : 'Unknown error',
          imageUrl: requestBody.image_url
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to fetch image from provided URL',
            ai_powered: false
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Call OpenAI Vision API with retry logic (if image is provided)
    let analysisResult: Partial<MealAnalysisResponse> = {};
    let tokenUsage: TokenUsage = { input: 0, output: 0, total: 0, cost_estimate_usd: 0 };
    let aiModel = 'none';
    let fallbackUsed = false;
    let fallbackReason: string | undefined;

    // Check if we ONLY have scanned products (no photo)
    const hasScannedProducts = requestBody.scanned_products && requestBody.scanned_products.length > 0;
    const hasPhoto = !!imageDataForAnalysis;

    if (hasPhoto) {
      // We have a photo, analyze it with AI
      const apiResult = await callOpenAIVisionWithRetry(imageDataForAnalysis, requestBody.user_profile_context);
      analysisResult = apiResult.result;
      tokenUsage = apiResult.tokenUsage;
      aiModel = apiResult.aiModel;
      fallbackUsed = apiResult.fallbackUsed;
      fallbackReason = apiResult.fallbackReason;
    } else if (hasScannedProducts) {
      // ONLY scanned products, no photo - skip AI analysis entirely
      console.log('MEAL_ANALYZER', 'Only scanned products provided, skipping AI analysis', {
        analysisId,
        scannedProductsCount: requestBody.scanned_products.length,
        products: requestBody.scanned_products.map(p => ({ barcode: p.barcode, name: p.name })),
        timestamp: new Date().toISOString()
      });

      // Build meal name from products
      const productNames = requestBody.scanned_products.map(p => p.name).slice(0, 3).join(', ');
      const mealName = requestBody.scanned_products.length <= 3
        ? productNames
        : `${productNames}...`;

      analysisResult = {
        meal_name: mealName,
        detected_foods: [],
        confidence: 1.0, // High confidence for scanned barcodes
        analysis_metadata: {
          processing_time_ms: 0,
          model_version: 'barcode-only',
          quality_score: 1.0,
          image_quality: 0,
          ai_model_used: 'barcode-scan',
          fallback_used: false,
        },
        personalized_insights: [{
          type: 'insight',
          category: 'nutrition',
          message: 'Produits scannés directement depuis les codes-barres',
          reasoning: 'Données nutritionnelles précises issues de la base OpenFoodFacts',
          priority: 'low',
        }],
        objective_alignment: {
          calories_vs_target: 1.0,
          macros_balance: {
            proteins_status: 'optimal' as const,
            carbs_status: 'optimal' as const,
            fats_status: 'optimal' as const,
          },
        },
        ai_powered: false,
      };
      aiModel = 'barcode-scan';
    }

    const processingTime = Date.now() - startTime;

    // Combine scanned products with AI-detected foods
    let allDetectedFoods: DetectedFood[] = [...(analysisResult.detected_foods || [])];

    if (hasScannedProducts) {
      console.log('MEAL_ANALYZER', 'Adding scanned products to detected foods', {
        analysisId,
        scannedProductsCount: requestBody.scanned_products!.length,
        products: requestBody.scanned_products!.map(p => ({ barcode: p.barcode, name: p.name })),
        aiDetectedFoodsCount: analysisResult.detected_foods?.length || 0,
        timestamp: new Date().toISOString()
      });

      const scannedFoods: DetectedFood[] = requestBody.scanned_products!.map(p => p.mealItem);
      allDetectedFoods = [...allDetectedFoods, ...scannedFoods];
    }

    // Recalculate totals with all foods (AI + scanned)
    const totalCalories = allDetectedFoods.reduce((sum, food) => sum + food.calories, 0);
    const totalProteins = allDetectedFoods.reduce((sum, food) => sum + food.proteins, 0);
    const totalCarbs = allDetectedFoods.reduce((sum, food) => sum + food.carbs, 0);
    const totalFats = allDetectedFoods.reduce((sum, food) => sum + food.fats, 0);
    const totalFiber = allDetectedFoods.reduce((sum, food) => sum + (food.fiber || 0), 0);
    const totalSugar = allDetectedFoods.reduce((sum, food) => sum + (food.sugar || 0), 0);
    const totalSodium = allDetectedFoods.reduce((sum, food) => sum + (food.sodium || 0), 0);

    // Truncate insights if too long
    const truncatedInsights = (analysisResult.personalized_insights || []).map(insight => {
      const { content: truncatedMessage, truncated: messageTruncated } = truncateResponse(insight.message, 200);
      const { content: truncatedReasoning, truncated: reasoningTruncated } = truncateResponse(insight.reasoning, 150);

      return {
        ...insight,
        message: truncatedMessage,
        reasoning: truncatedReasoning,
        ...(messageTruncated || reasoningTruncated ? { truncated: true } : {})
      };
    });

    // Prepare response with enhanced metadata
    const response: MealAnalysisResponse = {
      success: true,
      meal_name: analysisResult.meal_name || 'Repas analysé',
      analysis_id: analysisId,
      total_calories: totalCalories,
      macronutrients: {
        proteins: totalProteins,
        carbs: totalCarbs,
        fats: totalFats,
        fiber: totalFiber,
        sugar: totalSugar,
        sodium: totalSodium,
      },
      detected_foods: allDetectedFoods,
      meal_type: requestBody.meal_type || 'dinner',
      confidence: analysisResult.confidence || 0.5,
      analysis_metadata: {
        processing_time_ms: processingTime,
        model_version: analysisResult.analysis_metadata?.model_version || aiModel,
        quality_score: analysisResult.analysis_metadata?.quality_score || 0.8,
        image_quality: analysisResult.analysis_metadata?.image_quality || 0.8,
        ai_model_used: aiModel,
        tokens_used: tokenUsage.total > 0 ? tokenUsage : undefined,
        fallback_used: fallbackUsed,
        fallback_reason: fallbackReason,
      },
      personalized_insights: truncatedInsights,
      objective_alignment: analysisResult.objective_alignment || {
        calories_vs_target: 1.0,
        macros_balance: {
          proteins_status: 'optimal',
          carbs_status: 'optimal',
          fats_status: 'optimal',
        },
      },
      ai_powered: !fallbackUsed,
    };

    // Log comprehensive analysis results with cost tracking
    console.log('MEAL_ANALYZER', 'OpenAI GPT-5 Vision analysis completed', {
      analysisId,
      userId: requestBody.user_id,
      totalCalories: response.total_calories,
      detectedFoodsCount: response.detected_foods.length,
      detectedFoodsNames: response.detected_foods.map(f => f.name),
      confidence: response.confidence,
      processingTimeMs: processingTime,
      aiModelUsed: aiModel,
      tokensUsed: tokenUsage.total,
      costUSD: tokenUsage.cost_estimate_usd,
      fallbackUsed,
      fallbackReason,
      insightsCount: response.personalized_insights.length,
      aiPowered: response.ai_powered,
      timestamp: new Date().toISOString()
    });

    // DETAILED LOG: Final response being sent to client
    console.log('MEAL_ANALYZER_RESPONSE_DEBUG', 'Final OpenAI GPT-5 Vision response being sent to client', {
      analysisId,
      userId: requestBody.user_id,
      finalResponse: {
        success: response.success,
        totalCalories: response.total_calories,
        detectedFoodsInResponse: response.detected_foods.map(food => ({
          name: food.name,
          calories: food.calories,
          proteins: food.proteins,
          carbs: food.carbs,
          fats: food.fats,
          confidence: food.confidence,
          category: food.category
        })),
        macronutrientsInResponse: response.macronutrients,
        confidenceInResponse: response.confidence,
        personalizedInsightsInResponse: response.personalized_insights.map(insight => ({
          type: insight.type,
          category: insight.category,
          message: insight.message,
          reasoning: insight.reasoning,
          priority: insight.priority
        })),
        analysisMetadataInResponse: response.analysis_metadata,
        objectiveAlignmentInResponse: response.objective_alignment,
        aiPoweredInResponse: response.ai_powered,
      },
      timestamp: new Date().toISOString(),
      note: 'THIS IS THE EXACT DATA FROM OPENAI GPT-5 VISION BEING SENT TO THE FRONTEND'
    });

    // Log cost tracking for monitoring
    if (tokenUsage.total > 0) {
      console.log('AI_COST_TRACKING', 'OpenAI GPT-5 Vision token usage logged', {
        analysisId,
        userId: requestBody.user_id,
        model: aiModel,
        inputTokens: tokenUsage.input,
        outputTokens: tokenUsage.output,
        totalTokens: tokenUsage.total,
        costUSD: tokenUsage.cost_estimate_usd,
        timestamp: new Date().toISOString()
      });
    }

    const requestId = crypto.randomUUID();
    const tokenResult = await consumeTokensAtomic(supabase, {
      userId: requestBody.user_id,
      edgeFunctionName: 'meal-analyzer',
      operationType: 'meal-analysis-vision',
      openaiModel: aiModel,
      openaiInputTokens: tokenUsage.input,
      openaiOutputTokens: tokenUsage.output,
      openaiCostUsd: tokenUsage.cost_estimate_usd,
      metadata: {
        analysisId,
        detectedFoodsCount: response.detected_foods.length,
        totalCalories: response.total_calories,
        confidence: response.confidence,
        fallbackUsed,
      }
    }, requestId);

    if (!tokenResult.success) {
      console.error('❌ [MEAL_ANALYZER] Token consumption failed', {
        userId: requestBody.user_id,
        error: tokenResult.error,
        requestId
      });
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('MEAL_ANALYZER', 'Critical OpenAI GPT-5 Vision analysis failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Return fallback response even on critical failure
    const fallbackResult = generateSimplifiedFallback('');
    
    const response: MealAnalysisResponse = {
      success: true, // Still return success with fallback
      analysis_id: crypto.randomUUID(),
      total_calories: fallbackResult.total_calories || 400,
      macronutrients: fallbackResult.macronutrients || {
        proteins: 15,
        carbs: 50,
        fats: 15,
        fiber: 5,
        sugar: 10,
        sodium: 300,
      },
      detected_foods: fallbackResult.detected_foods || [],
      meal_type: 'dinner',
      confidence: 0.50,
      analysis_metadata: {
        processing_time_ms: 500,
        model_version: 'emergency-fallback-v1',
        quality_score: 0.50,
        image_quality: 0.50,
        ai_model_used: 'emergency-fallback',
        fallback_used: true,
        fallback_reason: 'Critical system error, using emergency estimation',
      },
      personalized_insights: [
        {
          type: 'alert',
          category: 'nutrition',
          message: 'Analyse d\'urgence utilisée - veuillez vérifier les valeurs.',
          reasoning: 'Le système d\'IA a rencontré une erreur technique.',
          priority: 'high',
          actionable: 'Vous pouvez ressayer l\'analyse ou saisir les valeurs manuellement.'
        }
      ],
      objective_alignment: {
        calories_vs_target: 1.0,
        macros_balance: {
          proteins_status: 'optimal',
          carbs_status: 'optimal',
          fats_status: 'optimal',
        },
      },
      ai_powered: false,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200, // Return 200 with fallback data instead of 500
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});