import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

interface DailySummaryRequest {
  user_id: string;
  meals: Array<{
    id: string;
    timestamp: string;
    items: Array<{
      name: string;
      calories: number;
      proteins: number;
      carbs: number;
      fats: number;
      confidence: number;
    }>;
    total_kcal: number;
    meal_type: string;
  }>;
  user_profile: {
    sex?: string;
    height_cm?: number;
    weight_kg?: number;
    target_weight_kg?: number;
    objective?: string;
    activity_level?: string;
    nutrition?: {
      diet?: string;
      allergies?: string[];
      intolerances?: string[];
      proteinTarget_g?: number;
      fastingWindow?: any;
    };
    health?: {
      conditions?: string[];
      medications?: string[];
    };
    emotions?: {
      stress?: number;
      chronotype?: string;
      sensitivities?: string[];
    };
  };
  analysis_date: string;
  model: 'gpt-5-mini';
}

interface DailySummaryResponse {
  success: boolean;
  summary: string;
  highlights: string[];
  improvements: string[];
  proactive_alerts: string[];
  overall_score: number;
  recommendations: string[];
  generated_at: string;
  model_used: 'gpt-5-mini';
  tokens_used?: {
    input: number;
    output: number;
    total: number;
    cost_estimate_usd: number;
  };
  cached?: boolean;
  error?: string;
}

interface OpenAIResponse {
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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey",
};

/**
 * Calculate token usage and cost estimation for GPT-5 models
 */
function calculateGPT5TokenCost(inputTokens: number, outputTokens: number, model: string): {
  input: number;
  output: number;
  total: number;
  cost_estimate_usd: number;
} {
  // GPT-5 pricing (per million tokens)
  const pricing = {
    'gpt-5': { input: 1.25, output: 10.00 },
    'gpt-5-mini': { input: 0.25, output: 2.00 },
    'gpt-5-nano': { input: 0.05, output: 0.40 },
    // Fallback to GPT-4o pricing if model not found
    'gpt-4o': { input: 2.50, output: 10.00 },
  };
  
  const modelPricing = pricing[model as keyof typeof pricing] || pricing['gpt-5-mini'];
  
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
 * Create optimized prompt for daily nutrition summary
 */
function createDailySummaryPrompt(meals: any[], userProfile: any, analysisDate: string): string {
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.total_kcal || 0), 0);
  const totalMeals = meals.length;
  
  // Calculate macros
  const totalMacros = meals.reduce((acc, meal) => {
    const items = meal.items || [];
    items.forEach((item: any) => {
      acc.proteins += item.proteins || 0;
      acc.carbs += item.carbs || 0;
      acc.fats += item.fats || 0;
    });
    return acc;
  }, { proteins: 0, carbs: 0, fats: 0 });

  let prompt = `Analysez cette journée nutritionnelle du ${analysisDate} et générez un résumé personnalisé en français.

DONNÉES NUTRITIONNELLES:
- ${totalMeals} repas scannés
- ${totalCalories} calories totales
- Protéines: ${Math.round(totalMacros.proteins)}g
- Glucides: ${Math.round(totalMacros.carbs)}g
- Lipides: ${Math.round(totalMacros.fats)}g

REPAS DÉTAILLÉS:
${meals.map(meal => `
- ${meal.meal_type} (${meal.total_kcal} kcal) à ${new Date(meal.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
  Aliments: ${meal.items?.map((item: any) => item.name).join(', ') || 'Non spécifié'}
`).join('')}`;

  // Add user context for personalization
  if (userProfile) {
    prompt += `\n\nCONTEXTE UTILISATEUR:`;
    
    if (userProfile.objective) {
      const objectiveText = userProfile.objective === 'fat_loss' ? 'Perte de graisse' :
                           userProfile.objective === 'muscle_gain' ? 'Prise de muscle' :
                           userProfile.objective === 'recomp' ? 'Recomposition corporelle' : userProfile.objective;
      prompt += `\n- Objectif: ${objectiveText}`;
    }
    
    if (userProfile.nutrition?.diet) {
      prompt += `\n- Régime: ${userProfile.nutrition.diet}`;
    }
    
    if (userProfile.nutrition?.allergies?.length > 0) {
      prompt += `\n- Allergies: ${userProfile.nutrition.allergies.join(', ')}`;
    }
    
    if (userProfile.nutrition?.proteinTarget_g) {
      prompt += `\n- Cible protéines: ${userProfile.nutrition.proteinTarget_g}g/jour`;
    }
    
    if (userProfile.emotions?.stress && userProfile.emotions.stress > 7) {
      prompt += `\n- Niveau de stress élevé: ${userProfile.emotions.stress}/10`;
    }
    
    if (userProfile.emotions?.chronotype) {
      const chronotypeText = userProfile.emotions.chronotype === 'morning' ? 'Matinal' :
                            userProfile.emotions.chronotype === 'evening' ? 'Tardif' : 'Intermédiaire';
      prompt += `\n- Chronotype: ${chronotypeText}`;
    }
  }

  prompt += `\n\nGénérez un objet JSON avec cette structure exacte (TOUT en français):
{
  "summary": "résumé_concis_de_la_journée_nutritionnelle_max_200_mots",
  "highlights": ["point_fort_1", "point_fort_2", "point_fort_3"],
  "improvements": ["amélioration_1", "amélioration_2"],
  "proactive_alerts": ["alerte_importante_si_nécessaire"],
  "overall_score": score_sur_100,
  "recommendations": ["recommandation_actionnable_1", "recommandation_actionnable_2"]
}

INSTRUCTIONS:
- Soyez concis mais informatif
- Adaptez les conseils au profil utilisateur
- Proposez des actions concrètes et réalisables
- Identifiez les patterns positifs et les axes d'amélioration
- Donnez un score global basé sur l'équilibre nutritionnel et l'alignement avec les objectifs
- RÉPONDEZ UNIQUEMENT EN FRANÇAIS`;

  return prompt;
}

/**
 * Call OpenAI API for daily nutrition summary
 */
async function callOpenAIForDailySummary(
  meals: any[], 
  userProfile: any, 
  analysisDate: string,
  model: string = 'gpt-5-mini'
): Promise<{
  result: Partial<DailySummaryResponse>;
  tokenUsage: { input: number; output: number; total: number; cost_estimate_usd: number };
  aiModel: string;
}> {
  const startTime = Date.now();
  
  // Get OpenAI API key from environment
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found in environment variables');
  }
  
  console.log('DAILY_SUMMARY_AI', 'Starting real OpenAI API call for daily summary', {
    model,
    mealsCount: meals.length,
    analysisDate,
    hasUserProfile: !!userProfile,
    userObjective: userProfile?.objective,
    timestamp: new Date().toISOString()
  });
  
  // Create optimized prompt
  const prompt = createDailySummaryPrompt(meals, userProfile, analysisDate);
  
  console.log('DAILY_SUMMARY_AI', 'Generated prompt for daily summary', {
    model,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 300) + '...',
    timestamp: new Date().toISOString()
  });
  
  // Prepare OpenAI API request
  const requestBody = {
    model: model,
    messages: [
      {
        role: "system",
        content: "Vous êtes un expert en nutrition et coach alimentaire. Analysez les données nutritionnelles et fournissez des insights personnalisés et actionnables en français."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 6000,
  };
  
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
      console.error('DAILY_SUMMARY_AI', 'OpenAI API request failed', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
        model,
        timestamp: new Date().toISOString()
      });
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
    }
    
    const openaiResponse: OpenAIResponse = await response.json();
    
    console.log('DAILY_SUMMARY_AI', 'Received response from OpenAI', {
      model,
      responseId: openaiResponse.id,
      finishReason: openaiResponse.choices[0]?.finish_reason,
      promptTokens: openaiResponse.usage.prompt_tokens,
      completionTokens: openaiResponse.usage.completion_tokens,
      totalTokens: openaiResponse.usage.total_tokens,
      responseContentLength: openaiResponse.choices[0]?.message?.content?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    // Parse the JSON response
    const aiContent = openaiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No content in OpenAI response');
    }
    
    // Enhanced debugging for empty or invalid content
    if (aiContent.trim() === '') {
      console.error('DAILY_SUMMARY_AI', 'OpenAI returned empty content despite successful response', {
        model,
        responseId: openaiResponse.id,
        finishReason: openaiResponse.choices[0]?.finish_reason,
        promptTokens: openaiResponse.usage.prompt_tokens,
        completionTokens: openaiResponse.usage.completion_tokens,
        totalTokens: openaiResponse.usage.total_tokens,
        maxCompletionTokens: 3000,
        tokenLimitReached: openaiResponse.usage.completion_tokens >= 3000,
        timestamp: new Date().toISOString()
      });
      throw new Error('OpenAI returned empty content - possible token limit or content filtering issue');
    }
    
    // Check if response was truncated due to token limit
    if (openaiResponse.choices[0]?.finish_reason === 'length') {
      console.warn('DAILY_SUMMARY_AI', 'OpenAI response was truncated due to token limit', {
        model,
        completionTokens: openaiResponse.usage.completion_tokens,
        maxCompletionTokens: 3000,
        contentLength: aiContent.length,
        contentPreview: aiContent.substring(0, 100),
        timestamp: new Date().toISOString()
      });
      
      // Try to salvage partial JSON if possible
      if (!aiContent.includes('}')) {
        throw new Error('Response truncated and incomplete JSON - increase max_completion_tokens further');
      }
    }
    
    let parsedSummary;
    try {
      parsedSummary = JSON.parse(aiContent);
      
      console.log('DAILY_SUMMARY_AI', 'Successfully parsed OpenAI JSON response', {
        model,
        parsedStructure: {
          hasSummary: !!parsedSummary.summary,
          summaryLength: parsedSummary.summary?.length || 0,
          highlightsCount: parsedSummary.highlights?.length || 0,
          improvementsCount: parsedSummary.improvements?.length || 0,
          alertsCount: parsedSummary.proactive_alerts?.length || 0,
          hasOverallScore: !!parsedSummary.overall_score,
          overallScore: parsedSummary.overall_score,
          recommendationsCount: parsedSummary.recommendations?.length || 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (parseError) {
      // Enhanced debugging for parsing failures
      console.error('DAILY_SUMMARY_AI', 'Failed to parse OpenAI JSON response', {
        model,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        rawContentLength: aiContent.length,
        rawContentPreview: aiContent.substring(0, 200),
        rawContentSuffix: aiContent.length > 200 ? aiContent.substring(aiContent.length - 200) : '',
        isEmptyContent: aiContent.trim() === '',
        contentStartsWith: aiContent.substring(0, 50),
        contentEndsWith: aiContent.length > 50 ? aiContent.substring(aiContent.length - 50) : aiContent,
        hasJsonStructure: aiContent.includes('{') && aiContent.includes('}'),
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
    
    console.log('DAILY_SUMMARY_AI', 'Token usage calculated for daily summary', {
      model,
      inputTokens: tokenUsage.input,
      outputTokens: tokenUsage.output,
      totalTokens: tokenUsage.total,
      costUSD: tokenUsage.cost_estimate_usd,
      timestamp: new Date().toISOString()
    });
    
    // Transform OpenAI response to our expected format
    const result: Partial<DailySummaryResponse> = {
      summary: parsedSummary.summary || '',
      highlights: Array.isArray(parsedSummary.highlights) ? parsedSummary.highlights : [],
      improvements: Array.isArray(parsedSummary.improvements) ? parsedSummary.improvements : [],
      proactive_alerts: Array.isArray(parsedSummary.proactive_alerts) ? parsedSummary.proactive_alerts : [],
      overall_score: typeof parsedSummary.overall_score === 'number' ? 
        Math.max(0, Math.min(100, parsedSummary.overall_score)) : 70,
      recommendations: Array.isArray(parsedSummary.recommendations) ? parsedSummary.recommendations : [],
      generated_at: new Date().toISOString(),
      model_used: 'gpt-5-mini',
      tokens_used: tokenUsage,
    };
    
    console.log('DAILY_SUMMARY_AI', 'Daily summary analysis completed successfully', {
      model,
      summaryLength: result.summary?.length || 0,
      highlightsCount: result.highlights?.length || 0,
      alertsCount: result.proactive_alerts?.length || 0,
      overallScore: result.overall_score,
      processingTimeMs: Date.now() - startTime,
      tokenUsage,
      timestamp: new Date().toISOString()
    });
    
    return { 
      result, 
      tokenUsage, 
      aiModel: model 
    };
    
  } catch (error) {
    console.error('DAILY_SUMMARY_AI', 'OpenAI API call failed for daily summary', {
      model,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Call OpenAI API with retry logic and fallback
 */
async function callOpenAIWithRetry(
  meals: any[], 
  userProfile: any, 
  analysisDate: string,
  maxRetries: number = 2
): Promise<{
  result: Partial<DailySummaryResponse>;
  tokenUsage: { input: number; output: number; total: number; cost_estimate_usd: number };
  aiModel: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
}> {
  let lastError: Error | null = null;
  
  // Try GPT-5 models in order of preference (cost-effectiveness)
  const modelsToTry = ['gpt-5-mini', 'gpt-5-nano'];
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const modelToUse = modelsToTry[Math.min(attempt, modelsToTry.length - 1)];
    
    try {
      console.log('DAILY_SUMMARY_RETRY', 'Attempting OpenAI daily summary analysis', {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        model: modelToUse,
        mealsCount: meals.length,
        timestamp: new Date().toISOString()
      });
      
      const analysisResult = await callOpenAIForDailySummary(meals, userProfile, analysisDate, modelToUse);
      
      console.log('DAILY_SUMMARY_RETRY', 'OpenAI daily summary analysis successful', {
        attempt: attempt + 1,
        model: analysisResult.aiModel,
        tokensUsed: analysisResult.tokenUsage.total,
        costUSD: analysisResult.tokenUsage.cost_estimate_usd,
        overallScore: analysisResult.result.overall_score,
        timestamp: new Date().toISOString()
      });
      
      return {
        ...analysisResult,
        fallbackUsed: false
      };
      
    } catch (error) {
      lastError = error as Error;
      
      console.warn('DAILY_SUMMARY_RETRY', 'OpenAI daily summary analysis attempt failed', {
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
  
  // All OpenAI attempts failed, use intelligent fallback
  console.error('DAILY_SUMMARY_RETRY', 'All OpenAI daily summary attempts failed, using intelligent fallback', {
    lastError: lastError?.message || 'Unknown error',
    attemptsCount: maxRetries + 1,
    modelsAttempted: modelsToTry.slice(0, maxRetries + 1),
    timestamp: new Date().toISOString()
  });
  
  const fallbackResult = generateIntelligentFallback(meals, userProfile);
  
  return {
    result: fallbackResult,
    tokenUsage: { input: 0, output: 0, total: 0, cost_estimate_usd: 0 },
    aiModel: 'intelligent-fallback',
    fallbackUsed: true,
    fallbackReason: `OpenAI daily summary analysis failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  };
}

/**
 * Intelligent fallback when OpenAI fails - better than simulation
 */
function generateIntelligentFallback(meals: any[], userProfile: any): Partial<DailySummaryResponse> {
  console.log('DAILY_SUMMARY_FALLBACK', 'Generating intelligent fallback analysis', {
    mealsCount: meals.length,
    hasUserProfile: !!userProfile,
    timestamp: new Date().toISOString()
  });
  
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.total_kcal || 0), 0);
  const totalMeals = meals.length;
  
  // Calculate macros
  const totalMacros = meals.reduce((acc, meal) => {
    const items = meal.items || [];
    items.forEach((item: any) => {
      acc.proteins += item.proteins || 0;
      acc.carbs += item.carbs || 0;
      acc.fats += item.fats || 0;
    });
    return acc;
  }, { proteins: 0, carbs: 0, fats: 0 });
  
  let summary = '';
  const highlights: string[] = [];
  const improvements: string[] = [];
  const proactive_alerts: string[] = [];
  const recommendations: string[] = [];
  
  // Generate contextual summary
  if (totalMeals === 0) {
    summary = "Aucun repas scanné aujourd'hui. Commencez par capturer vos repas pour obtenir des insights personnalisés.";
    recommendations.push("Scannez votre prochain repas pour débuter votre suivi nutritionnel");
  } else {
    summary = `Journée nutritionnelle avec ${totalMeals} repas scannés (${totalCalories} kcal). `;
    
    // Protein analysis
    const proteinTarget = userProfile?.nutrition?.proteinTarget_g || (userProfile?.weight_kg ? userProfile.weight_kg * 1.6 : 120);
    if (totalMacros.proteins < proteinTarget * 0.8) {
      summary += "Apport en protéines insuffisant pour vos objectifs.";
      improvements.push(`Augmentez vos protéines (+${Math.round(proteinTarget - totalMacros.proteins)}g)`);
      recommendations.push("Ajoutez une source de protéines à votre prochain repas");
    } else if (totalMacros.proteins >= proteinTarget) {
      highlights.push(`Excellent apport en protéines (${Math.round(totalMacros.proteins)}g) - objectif atteint !`);
    }
    
    // Objective-based analysis
    if (userProfile?.objective === 'fat_loss' && totalCalories > 2000) {
      improvements.push("Réduisez légèrement les portions pour votre objectif de perte de graisse");
    } else if (userProfile?.objective === 'muscle_gain' && totalCalories < 2500) {
      improvements.push("Augmentez votre apport calorique pour soutenir la prise de muscle");
    }
    
    // Meal frequency analysis
    if (totalMeals < 3) {
      recommendations.push("Essayez d'atteindre 3 repas par jour pour un meilleur équilibre");
    } else {
      highlights.push("Bonne fréquence de repas maintenue");
    }
  }
  
  // Calculate score
  let score = 70; // Base score
  if (totalMacros.proteins >= (userProfile?.nutrition?.proteinTarget_g || 120) * 0.9) score += 15;
  if (totalMeals >= 3) score += 10;
  if (proactive_alerts.length === 0) score += 5;
  
  return {
    summary,
    highlights,
    improvements,
    proactive_alerts,
    overall_score: Math.min(100, score),
    recommendations,
    generated_at: new Date().toISOString(),
    model_used: 'gpt-5-mini'
  };
}

/**
 * Check cache for existing daily summary
 */
async function checkDailySummaryCache(
  supabase: any,
  userId: string,
  analysisDate: string
): Promise<DailySummaryResponse | null> {
  try {
    // Check if we have a cached summary for today
    const { data, error } = await supabase
      .from('ai_daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('analysis_date', analysisDate)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.warn('DAILY_SUMMARY_CACHE', 'Cache check failed', {
        error: error.message,
        userId,
        analysisDate,
        timestamp: new Date().toISOString()
      });
      return null;
    }
    
    if (data && data.length > 0) {
      console.log('DAILY_SUMMARY_CACHE', 'Found cached daily summary', {
        userId,
        analysisDate,
        cacheAge: Date.now() - new Date(data[0].created_at).getTime(),
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        summary: data[0].summary,
        highlights: data[0].highlights || [],
        improvements: data[0].improvements || [],
        proactive_alerts: data[0].proactive_alerts || [],
        overall_score: data[0].overall_score || 70,
        recommendations: data[0].recommendations || [],
        generated_at: data[0].created_at,
        model_used: data[0].model_used || 'gpt-5-mini',
        tokens_used: data[0].tokens_used,
        cached: true,
      };
    }
    
    return null;
  } catch (error) {
    console.warn('DAILY_SUMMARY_CACHE', 'Cache check exception', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      analysisDate,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

/**
 * Save daily summary to cache
 */
async function saveDailySummaryToCache(
  supabase: any,
  userId: string,
  analysisDate: string,
  summaryData: DailySummaryResponse
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_daily_summaries')
      .upsert({
        user_id: userId,
        analysis_date: analysisDate,
        summary: summaryData.summary,
        highlights: summaryData.highlights,
        improvements: summaryData.improvements,
        proactive_alerts: summaryData.proactive_alerts,
        overall_score: summaryData.overall_score,
        recommendations: summaryData.recommendations,
        model_used: summaryData.model_used,
        tokens_used: summaryData.tokens_used,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,analysis_date'
      });
    
    if (error) {
      console.warn('DAILY_SUMMARY_CACHE', 'Failed to save to cache', {
        error: error.message,
        userId,
        analysisDate,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('DAILY_SUMMARY_CACHE', 'Daily summary saved to cache', {
        userId,
        analysisDate,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.warn('DAILY_SUMMARY_CACHE', 'Cache save exception', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      analysisDate,
      timestamp: new Date().toISOString()
    });
  }
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
          error: 'Method not allowed. Use POST.' 
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const requestBody: DailySummaryRequest = await req.json();
    
    // Validate required fields
    if (!requestBody.user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required field: user_id' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!requestBody.meals || !Array.isArray(requestBody.meals)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing or invalid meals data'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('DAILY_NUTRITION_SUMMARY', 'Generating real AI daily summary', {
      userId: requestBody.user_id,
      mealsCount: requestBody.meals.length,
      analysisDate: requestBody.analysis_date,
      hasUserProfile: !!requestBody.user_profile,
      userObjective: requestBody.user_profile?.objective,
      userDiet: requestBody.user_profile?.nutrition?.diet,
      timestamp: new Date().toISOString()
    });

    // Initialize Supabase client for caching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TOKEN PRE-CHECK
    const estimatedTokens = 35;
    const tokenCheck = await checkTokenBalance(supabase, requestBody.user_id, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('DAILY_NUTRITION_SUMMARY', 'Insufficient tokens', {
        userId: requestBody.user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokens
      });

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokens,
        !tokenCheck.isSubscribed,
        corsHeaders
      );
    }

    // Check cache first
    const cachedSummary = await checkDailySummaryCache(
      supabase,
      requestBody.user_id,
      requestBody.analysis_date
    );
    
    if (cachedSummary) {
      console.log('DAILY_NUTRITION_SUMMARY', 'Returning cached daily summary', {
        userId: requestBody.user_id,
        analysisDate: requestBody.analysis_date,
        cacheHit: true,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify(cachedSummary),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate new AI summary
    const { result: summaryResult, tokenUsage, aiModel, fallbackUsed, fallbackReason } =
      await callOpenAIWithRetry(
        requestBody.meals,
        requestBody.user_profile,
        requestBody.analysis_date
      );

    // TOKEN CONSUMPTION - Only if not fallback
    if (!fallbackUsed && tokenUsage.total > 0) {
      const costUsd = (tokenUsage.prompt_tokens / 1000000 * 0.25) + (tokenUsage.completion_tokens / 1000000 * 2.0);

      const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
        userId: requestBody.user_id,
        edgeFunctionName: 'daily-nutrition-summary',
        operationType: 'daily_nutrition_summary',
        openaiModel: 'gpt-5-mini',
        openaiInputTokens: tokenUsage.prompt_tokens,
        openaiOutputTokens: tokenUsage.completion_tokens,
        openaiCostUsd: costUsd,
        metadata: {
          analysisDate: requestBody.analysis_date,
          mealsCount: requestBody.meals.length,
          overallScore: summaryResult.overall_score || 70
        }
      });

      console.log('💰 [DAILY_NUTRITION] Tokens consumed', {
        userId: requestBody.user_id,
        tokensUsed: tokenUsage.total,
        costUsd: costUsd.toFixed(6)
      });
    }

    // Prepare response
    const response: DailySummaryResponse = {
      success: true,
      summary: summaryResult.summary || '',
      highlights: summaryResult.highlights || [],
      improvements: summaryResult.improvements || [],
      proactive_alerts: summaryResult.proactive_alerts || [],
      overall_score: summaryResult.overall_score || 70,
      recommendations: summaryResult.recommendations || [],
      generated_at: summaryResult.generated_at || new Date().toISOString(),
      model_used: 'gpt-5-mini',
      tokens_used: tokenUsage.total > 0 ? tokenUsage : undefined,
      cached: false,
      tokens_consumed: estimatedTokens
    };

    // Save to cache for future requests (only if not fallback)
    if (!fallbackUsed) {
      await saveDailySummaryToCache(
        supabase,
        requestBody.user_id,
        requestBody.analysis_date,
        response
      );
    }

    console.log('DAILY_NUTRITION_SUMMARY', 'Real AI daily summary generated successfully', {
      userId: requestBody.user_id,
      summaryLength: response.summary.length,
      highlightsCount: response.highlights.length,
      alertsCount: response.proactive_alerts.length,
      overallScore: response.overall_score,
      aiModelUsed: aiModel,
      tokensUsed: tokenUsage.total,
      costUSD: tokenUsage.cost_estimate_usd,
      fallbackUsed,
      fallbackReason,
      timestamp: new Date().toISOString()
    });

    // Log cost tracking for monitoring
    if (tokenUsage.total > 0) {
      console.log('AI_COST_TRACKING', 'OpenAI daily summary token usage logged', {
        userId: requestBody.user_id,
        analysisDate: requestBody.analysis_date,
        model: aiModel,
        inputTokens: tokenUsage.input,
        outputTokens: tokenUsage.output,
        totalTokens: tokenUsage.total,
        costUSD: tokenUsage.cost_estimate_usd,
        timestamp: new Date().toISOString()
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
    console.error('DAILY_NUTRITION_SUMMARY', 'Critical daily summary generation failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Return intelligent fallback even on critical failure
    const fallbackResult = generateIntelligentFallback(
      requestBody?.meals || [],
      requestBody?.user_profile
    );
    
    const response: DailySummaryResponse = {
      success: true, // Still return success with fallback
      summary: fallbackResult.summary || 'Analyse indisponible temporairement.',
      highlights: fallbackResult.highlights || [],
      improvements: fallbackResult.improvements || [],
      proactive_alerts: fallbackResult.proactive_alerts || ['Service d\'IA temporairement indisponible'],
      overall_score: fallbackResult.overall_score || 70,
      recommendations: fallbackResult.recommendations || ['Réessayez plus tard pour une analyse complète'],
      generated_at: new Date().toISOString(),
      model_used: 'gpt-5-mini',
      cached: false,
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