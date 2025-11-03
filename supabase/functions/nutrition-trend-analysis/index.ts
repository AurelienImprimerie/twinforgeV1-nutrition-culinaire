import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

interface TrendAnalysisRequest {
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
      category?: string;
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
  analysis_period: '7_days' | '30_days';
  model: 'gpt-5-mini';
}

interface TrendAnalysisResponse {
  success: boolean;
  trends: Array<{
    pattern: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
    confidence: number;
    recommendations: string[];
  }>;
  strategic_advice: Array<{
    category: 'nutrition' | 'timing' | 'balance' | 'goals';
    advice: string;
    priority: 'low' | 'medium' | 'high';
    timeframe: 'immediate' | 'short_term' | 'long_term';
  }>;
  meal_classifications: Array<{
    meal_id: string;
    classification: 'balanced' | 'protein_rich' | 'needs_improvement' | 'excellent';
    reasoning: string;
    score: number;
  }>;
  diet_compliance: {
    overall_score: number;
    compliance_rate: number;
    deviations: string[];
    suggestions: string[];
  };
  generated_at: string;
  model_used: 'gpt-5-mini' | 'gpt-5-nano';
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
 * Create optimized prompt for nutrition trend analysis
 */
function createTrendAnalysisPrompt(meals: any[], userProfile: any, period: string): string {
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.total_kcal || 0), 0);
  const avgDailyCalories = Math.round(totalCalories / 7);
  
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
  
  const avgProteins = Math.round(totalMacros.proteins / 7);
  const avgCarbs = Math.round(totalMacros.carbs / 7);
  const avgFats = Math.round(totalMacros.fats / 7);

  let prompt = `Analysez ces données nutritionnelles sur ${period === '7_days' ? '7 jours' : '30 jours'} et identifiez des patterns et tendances.

DONNÉES NUTRITIONNELLES (${meals.length} repas):
- Calories moyennes/jour: ${avgDailyCalories} kcal
- Protéines moyennes/jour: ${avgProteins}g
- Glucides moyennes/jour: ${avgCarbs}g
- Lipides moyennes/jour: ${avgFats}g

HISTORIQUE DÉTAILLÉ:
${meals.map((meal, index) => `
${index + 1}. ${meal.meal_type} - ${meal.total_kcal} kcal (${new Date(meal.timestamp).toLocaleDateString('fr-FR')})
   Aliments: ${meal.items?.map((item: any) => `${item.name} (${item.calories}kcal)`).join(', ') || 'Non spécifié'}
   Macros: P:${meal.items?.reduce((sum: number, item: any) => sum + (item.proteins || 0), 0)}g, G:${meal.items?.reduce((sum: number, item: any) => sum + (item.carbs || 0), 0)}g, L:${meal.items?.reduce((sum: number, item: any) => sum + (item.fats || 0), 0)}g
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
  "trends": [
    {
      "pattern": "nom_du_pattern_identifié",
      "description": "description_détaillée_du_pattern_max_150_mots",
      "impact": "positive|negative|neutral",
      "confidence": 0.0-1.0,
      "recommendations": ["action_1", "action_2"]
    }
  ],
  "strategic_advice": [
    {
      "category": "nutrition|timing|balance|goals",
      "advice": "conseil_stratégique_actionnable_max_100_mots",
      "priority": "low|medium|high",
      "timeframe": "immediate|short_term|long_term"
    }
  ],
  "meal_classifications": [
    {
      "meal_id": "id_du_repas",
      "classification": "balanced|protein_rich|needs_improvement|excellent",
      "reasoning": "justification_de_la_classification",
      "score": score_sur_100
    }
  ],
  "diet_compliance": {
    "overall_score": score_sur_100,
    "compliance_rate": 0.0-1.0,
    "deviations": ["écart_1_si_applicable"],
    "suggestions": ["suggestion_1", "suggestion_2"]
  }
}

INSTRUCTIONS:
- Identifiez des patterns réels dans les données
- Proposez des conseils personnalisés et actionnables
- Soyez spécifique aux objectifs et contraintes de l'utilisateur
- Classifiez chaque repas avec une justification claire
- Évaluez la conformité au régime déclaré
- RÉPONDEZ UNIQUEMENT EN FRANÇAIS`;

  return prompt;
}

/**
 * Call OpenAI API for trend analysis
 */
async function callOpenAIForTrendAnalysis(
  meals: any[], 
  userProfile: any, 
  period: string,
  model: string = 'gpt-5-mini'
): Promise<{
  result: Partial<TrendAnalysisResponse>;
  tokenUsage: { input: number; output: number; total: number; cost_estimate_usd: number };
  aiModel: string;
}> {
  const startTime = Date.now();
  
  // Get OpenAI API key from environment
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found in environment variables');
  }
  
  console.log('TREND_ANALYSIS_AI', 'Starting real OpenAI API call for trend analysis', {
    model,
    mealsCount: meals.length,
    period,
    hasUserProfile: !!userProfile,
    userObjective: userProfile?.objective,
    timestamp: new Date().toISOString()
  });
  
  // Create optimized prompt
  const prompt = createTrendAnalysisPrompt(meals, userProfile, period);
  
  console.log('TREND_ANALYSIS_AI', 'Generated prompt for trend analysis', {
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
        content: "Vous êtes un expert en nutrition et analyse de données alimentaires. Identifiez des patterns significatifs et proposez des conseils personnalisés actionnables en français."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8000,
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
      console.error('TREND_ANALYSIS_AI', 'OpenAI API request failed', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
        model,
        timestamp: new Date().toISOString()
      });
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
    }
    
    const openaiResponse: OpenAIResponse = await response.json();
    
    console.log('TREND_ANALYSIS_AI', 'Received response from OpenAI', {
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
      console.error('TREND_ANALYSIS_AI', 'OpenAI returned empty content despite successful response', {
        model,
        responseId: openaiResponse.id,
        finishReason: openaiResponse.choices[0]?.finish_reason,
        promptTokens: openaiResponse.usage.prompt_tokens,
        completionTokens: openaiResponse.usage.completion_tokens,
        totalTokens: openaiResponse.usage.total_tokens,
        maxCompletionTokens: 4000,
        tokenLimitReached: openaiResponse.usage.completion_tokens >= 4000,
        timestamp: new Date().toISOString()
      });
      throw new Error('OpenAI returned empty content - possible token limit or content filtering issue');
    }
    
    // Check if response was truncated due to token limit
    if (openaiResponse.choices[0]?.finish_reason === 'length') {
      console.warn('TREND_ANALYSIS_AI', 'OpenAI response was truncated due to token limit', {
        model,
        completionTokens: openaiResponse.usage.completion_tokens,
        maxCompletionTokens: 4000,
        contentLength: aiContent.length,
        contentPreview: aiContent.substring(0, 100),
        timestamp: new Date().toISOString()
      });
      
      // Try to salvage partial JSON if possible
      if (!aiContent.includes('}')) {
        throw new Error('Response truncated and incomplete JSON - increase max_completion_tokens further');
      }
    }
    
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(aiContent);
      
      console.log('TREND_ANALYSIS_AI', 'Successfully parsed OpenAI JSON response', {
        model,
        parsedStructure: {
          hasTrends: !!parsedAnalysis.trends,
          trendsCount: parsedAnalysis.trends?.length || 0,
          hasStrategicAdvice: !!parsedAnalysis.strategic_advice,
          adviceCount: parsedAnalysis.strategic_advice?.length || 0,
          hasMealClassifications: !!parsedAnalysis.meal_classifications,
          classificationsCount: parsedAnalysis.meal_classifications?.length || 0,
          hasDietCompliance: !!parsedAnalysis.diet_compliance,
          complianceScore: parsedAnalysis.diet_compliance?.overall_score
        },
        timestamp: new Date().toISOString()
      });
    } catch (parseError) {
      // Enhanced debugging for parsing failures
      console.error('TREND_ANALYSIS_AI', 'Failed to parse OpenAI JSON response', {
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
    
    console.log('TREND_ANALYSIS_AI', 'Token usage calculated for trend analysis', {
      model,
      inputTokens: tokenUsage.input,
      outputTokens: tokenUsage.output,
      totalTokens: tokenUsage.total,
      costUSD: tokenUsage.cost_estimate_usd,
      timestamp: new Date().toISOString()
    });
    
    // Transform OpenAI response to our expected format
    const result: Partial<TrendAnalysisResponse> = {
      trends: Array.isArray(parsedAnalysis.trends) ? parsedAnalysis.trends.map((trend: any) => ({
        pattern: trend.pattern || 'Pattern non identifié',
        description: trend.description || '',
        impact: ['positive', 'negative', 'neutral'].includes(trend.impact) ? trend.impact : 'neutral',
        confidence: typeof trend.confidence === 'number' ? 
          Math.max(0, Math.min(1, trend.confidence)) : 0.7,
        recommendations: Array.isArray(trend.recommendations) ? trend.recommendations : []
      })) : [],
      strategic_advice: Array.isArray(parsedAnalysis.strategic_advice) ? parsedAnalysis.strategic_advice.map((advice: any) => ({
        category: ['nutrition', 'timing', 'balance', 'goals'].includes(advice.category) ? advice.category : 'nutrition',
        advice: advice.advice || '',
        priority: ['low', 'medium', 'high'].includes(advice.priority) ? advice.priority : 'medium',
        timeframe: ['immediate', 'short_term', 'long_term'].includes(advice.timeframe) ? advice.timeframe : 'short_term'
      })) : [],
      meal_classifications: Array.isArray(parsedAnalysis.meal_classifications) ? parsedAnalysis.meal_classifications.map((classification: any) => ({
        meal_id: classification.meal_id || '',
        classification: ['balanced', 'protein_rich', 'needs_improvement', 'excellent'].includes(classification.classification) ? 
          classification.classification : 'balanced',
        reasoning: classification.reasoning || '',
        score: typeof classification.score === 'number' ? 
          Math.max(0, Math.min(100, classification.score)) : 70
      })) : [],
      diet_compliance: {
        overall_score: typeof parsedAnalysis.diet_compliance?.overall_score === 'number' ? 
          Math.max(0, Math.min(100, parsedAnalysis.diet_compliance.overall_score)) : 80,
        compliance_rate: typeof parsedAnalysis.diet_compliance?.compliance_rate === 'number' ? 
          Math.max(0, Math.min(1, parsedAnalysis.diet_compliance.compliance_rate)) : 0.85,
        deviations: Array.isArray(parsedAnalysis.diet_compliance?.deviations) ? 
          parsedAnalysis.diet_compliance.deviations : [],
        suggestions: Array.isArray(parsedAnalysis.diet_compliance?.suggestions) ? 
          parsedAnalysis.diet_compliance.suggestions : []
      },
      generated_at: new Date().toISOString(),
      model_used: 'gpt-5-mini',
      tokens_used: tokenUsage,
    };
    
    console.log('TREND_ANALYSIS_AI', 'Trend analysis completed successfully', {
      model,
      trendsCount: result.trends?.length || 0,
      adviceCount: result.strategic_advice?.length || 0,
      classificationsCount: result.meal_classifications?.length || 0,
      complianceScore: result.diet_compliance?.overall_score,
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
    console.error('TREND_ANALYSIS_AI', 'OpenAI API call failed for trend analysis', {
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
  period: string,
  maxRetries: number = 2
): Promise<{
  result: Partial<TrendAnalysisResponse>;
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
      console.log('TREND_ANALYSIS_RETRY', 'Attempting OpenAI trend analysis', {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        model: modelToUse,
        mealsCount: meals.length,
        timestamp: new Date().toISOString()
      });
      
      const analysisResult = await callOpenAIForTrendAnalysis(meals, userProfile, period, modelToUse);
      
      console.log('TREND_ANALYSIS_RETRY', 'OpenAI trend analysis successful', {
        attempt: attempt + 1,
        model: analysisResult.aiModel,
        tokensUsed: analysisResult.tokenUsage.total,
        costUSD: analysisResult.tokenUsage.cost_estimate_usd,
        trendsCount: analysisResult.result.trends?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      return {
        ...analysisResult,
        fallbackUsed: false
      };
      
    } catch (error) {
      lastError = error as Error;
      
      console.warn('TREND_ANALYSIS_RETRY', 'OpenAI trend analysis attempt failed', {
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
  console.error('TREND_ANALYSIS_RETRY', 'All OpenAI trend analysis attempts failed, using intelligent fallback', {
    lastError: lastError?.message || 'Unknown error',
    attemptsCount: maxRetries + 1,
    modelsAttempted: modelsToTry.slice(0, maxRetries + 1),
    timestamp: new Date().toISOString()
  });
  
  const fallbackResult = generateIntelligentTrendFallback(meals, userProfile);
  
  return {
    result: fallbackResult,
    tokenUsage: { input: 0, output: 0, total: 0, cost_estimate_usd: 0 },
    aiModel: 'intelligent-fallback',
    fallbackUsed: true,
    fallbackReason: `OpenAI trend analysis failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  };
}

/**
 * Intelligent fallback for trend analysis when OpenAI fails
 */
function generateIntelligentTrendFallback(meals: any[], userProfile: any): Partial<TrendAnalysisResponse> {
  console.log('TREND_ANALYSIS_FALLBACK', 'Generating intelligent trend fallback', {
    mealsCount: meals.length,
    hasUserProfile: !!userProfile,
    timestamp: new Date().toISOString()
  });
  
  const totalCalories = meals.reduce((sum, meal) => sum + (meal.total_kcal || 0), 0);
  const avgDailyCalories = Math.round(totalCalories / 7);
  
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
  
  const avgProteins = Math.round(totalMacros.proteins / 7);
  
  const trends = [];
  const strategic_advice = [];
  const meal_classifications = [];
  
  // Protein trend analysis
  const proteinTarget = userProfile?.nutrition?.proteinTarget_g || (userProfile?.weight_kg ? userProfile.weight_kg * 1.6 : 120);
  if (avgProteins < proteinTarget * 0.8) {
    trends.push({
      pattern: 'apport_proteines_insuffisant',
      description: `Vos apports en protéines sont constamment en dessous de votre cible (${avgProteins}g/jour vs ${proteinTarget}g), ce qui pourrait affecter votre récupération et vos objectifs.`,
      impact: 'negative' as const,
      confidence: 0.85,
      recommendations: [
        'Ajoutez une source de protéines à chaque repas',
        'Considérez un shake protéiné post-entraînement'
      ]
    });
    
    strategic_advice.push({
      category: 'nutrition' as const,
      advice: 'Augmentez progressivement vos apports protéiques en ajoutant 20g de protéines par jour.',
      priority: 'high' as const,
      timeframe: 'immediate' as const
    });
  } else if (avgProteins >= proteinTarget) {
    trends.push({
      pattern: 'apport_proteines_optimal',
      description: `Excellent ! Vos apports en protéines (${avgProteins}g/jour) sont optimaux pour vos objectifs.`,
      impact: 'positive' as const,
      confidence: 0.92,
      recommendations: ['Maintenez cette excellente habitude']
    });
  }
  
  // Calorie consistency analysis
  const calorieVariation = meals.map(meal => meal.total_kcal || 0);
  const maxCalories = Math.max(...calorieVariation);
  const minCalories = Math.min(...calorieVariation.filter(cal => cal > 0));
  const variation = maxCalories - minCalories;
  
  if (variation > 800) {
    trends.push({
      pattern: 'variabilite_calorique_elevee',
      description: `Forte variabilité dans vos apports caloriques (écart de ${variation} kcal entre vos repas), ce qui peut affecter la régularité de votre progression.`,
      impact: 'negative' as const,
      confidence: 0.78,
      recommendations: [
        'Planifiez vos repas à l\'avance',
        'Visez une répartition plus équilibrée des calories'
      ]
    });
  }
  
  // Classify meals using intelligent logic
  meals.forEach(meal => {
    const mealMacros = meal.items?.reduce((acc: any, item: any) => {
      acc.proteins += item.proteins || 0;
      acc.carbs += item.carbs || 0;
      acc.fats += item.fats || 0;
      return acc;
    }, { proteins: 0, carbs: 0, fats: 0 }) || { proteins: 0, carbs: 0, fats: 0 };
    
    const totalMacros = mealMacros.proteins + mealMacros.carbs + mealMacros.fats;
    const proteinRatio = totalMacros > 0 ? mealMacros.proteins / totalMacros : 0;
    
    let classification: 'balanced' | 'protein_rich' | 'needs_improvement' | 'excellent' = 'balanced';
    let reasoning = '';
    let score = 70;
    
    if (proteinRatio > 0.4) {
      classification = 'protein_rich';
      reasoning = `Repas riche en protéines (${Math.round(proteinRatio * 100)}% des macros) - excellent pour la récupération.`;
      score = 85;
    } else if (proteinRatio > 0.25 && meal.total_kcal > 300 && meal.total_kcal < 800) {
      classification = 'excellent';
      reasoning = 'Équilibre parfait des macronutriments avec une portion adaptée.';
      score = 95;
    } else if (proteinRatio < 0.15) {
      classification = 'needs_improvement';
      reasoning = `Faible teneur en protéines (${Math.round(proteinRatio * 100)}%). Ajoutez une source de protéines.`;
      score = 55;
    } else {
      classification = 'balanced';
      reasoning = 'Repas équilibré avec une répartition correcte des macronutriments.';
      score = 75;
    }
    
    meal_classifications.push({
      meal_id: meal.id,
      classification,
      reasoning,
      score
    });
  });
  
  // Diet compliance analysis
  const diet = userProfile?.nutrition?.diet || '';
  let dietCompliance = {
    overall_score: 85,
    compliance_rate: 0.9,
    deviations: [] as string[],
    suggestions: [] as string[]
  };
  
  if (diet === 'vegetarian') {
    const animalProducts = meals.filter(meal =>
      meal.items?.some((item: any) =>
        item.name?.toLowerCase().includes('viande') ||
        item.name?.toLowerCase().includes('poisson')
      )
    );
    
    if (animalProducts.length > 0) {
      dietCompliance.overall_score = 60;
      dietCompliance.compliance_rate = (meals.length - animalProducts.length) / meals.length;
      dietCompliance.deviations.push(`${animalProducts.length} repas contiennent des produits animaux`);
      dietCompliance.suggestions.push('Vérifiez les ingrédients pour maintenir votre régime végétarien');
    }
  }
  
  return {
    trends,
    strategic_advice,
    meal_classifications,
    diet_compliance: dietCompliance,
    generated_at: new Date().toISOString(),
    model_used: 'gpt-5-mini' as const
  };
}

/**
 * Check cache for existing trend analysis
 */
async function checkTrendAnalysisCache(
  supabase: any,
  userId: string,
  period: string
): Promise<TrendAnalysisResponse | null> {
  try {
    // Check if we have a cached analysis for this period
    const cacheValidHours = period === '7_days' ? 24 : 168; // 24h for weekly, 7 days for monthly
    const cacheThreshold = new Date(Date.now() - cacheValidHours * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('ai_trend_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('analysis_period', period)
      .gte('created_at', cacheThreshold.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.warn('TREND_ANALYSIS_CACHE', 'Cache check failed', {
        error: error.message,
        userId,
        period,
        timestamp: new Date().toISOString()
      });
      return null;
    }
    
    if (data && data.length > 0) {
      console.log('TREND_ANALYSIS_CACHE', 'Found cached trend analysis', {
        userId,
        period,
        cacheAge: Date.now() - new Date(data[0].created_at).getTime(),
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        trends: data[0].trends || [],
        strategic_advice: data[0].strategic_advice || [],
        meal_classifications: data[0].meal_classifications || [],
        diet_compliance: data[0].diet_compliance || {
          overall_score: 80,
          compliance_rate: 0.85,
          deviations: [],
          suggestions: []
        },
        generated_at: data[0].created_at,
        model_used: data[0].model_used || 'gpt-5-mini',
        tokens_used: data[0].tokens_used,
        cached: true,
      };
    }
    
    return null;
  } catch (error) {
    console.warn('TREND_ANALYSIS_CACHE', 'Cache check exception', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      period,
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

/**
 * Save trend analysis to cache
 */
async function saveTrendAnalysisToCache(
  supabase: any,
  userId: string,
  period: string,
  analysisData: TrendAnalysisResponse
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_trend_analyses')
      .upsert({
        user_id: userId,
        analysis_period: period,
        trends: analysisData.trends,
        strategic_advice: analysisData.strategic_advice,
        meal_classifications: analysisData.meal_classifications,
        diet_compliance: analysisData.diet_compliance,
        model_used: analysisData.model_used,
        tokens_used: analysisData.tokens_used,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,analysis_period'
      });
    
    if (error) {
      console.warn('TREND_ANALYSIS_CACHE', 'Failed to save to cache', {
        error: error.message,
        userId,
        period,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('TREND_ANALYSIS_CACHE', 'Trend analysis saved to cache', {
        userId,
        period,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.warn('TREND_ANALYSIS_CACHE', 'Cache save exception', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      period,
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
    const requestBody: TrendAnalysisRequest = await req.json();
    
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

    if (!requestBody.meals || !Array.isArray(requestBody.meals) || requestBody.meals.length < 3) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Insufficient meals data for trend analysis (minimum 3 meals required)'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('NUTRITION_TREND_ANALYSIS', 'Generating real AI trend analysis', {
      userId: requestBody.user_id,
      mealsCount: requestBody.meals.length,
      analysisPeriod: requestBody.analysis_period,
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
    const estimatedTokens = 45;
    const tokenCheck = await checkTokenBalance(supabase, requestBody.user_id, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('NUTRITION_TREND_ANALYSIS', 'Insufficient tokens', {
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
    const cachedAnalysis = await checkTrendAnalysisCache(
      supabase,
      requestBody.user_id,
      requestBody.analysis_period
    );
    
    if (cachedAnalysis) {
      console.log('NUTRITION_TREND_ANALYSIS', 'Returning cached trend analysis', {
        userId: requestBody.user_id,
        analysisPeriod: requestBody.analysis_period,
        cacheHit: true,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify(cachedAnalysis),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate new AI trend analysis
    const { result: analysisResult, tokenUsage, aiModel, fallbackUsed, fallbackReason } =
      await callOpenAIWithRetry(
        requestBody.meals,
        requestBody.user_profile,
        requestBody.analysis_period
      );

    // TOKEN CONSUMPTION - Only if not fallback
    if (!fallbackUsed && tokenUsage.total > 0) {
      const costUsd = (tokenUsage.prompt_tokens / 1000000 * 0.25) + (tokenUsage.completion_tokens / 1000000 * 2.0);

      const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
        userId: requestBody.user_id,
        edgeFunctionName: 'nutrition-trend-analysis',
        operationType: 'nutrition_trend_analysis',
        openaiModel: 'gpt-5-mini',
        openaiInputTokens: tokenUsage.prompt_tokens,
        openaiOutputTokens: tokenUsage.completion_tokens,
        openaiCostUsd: costUsd,
        metadata: {
          analysisPeriod: requestBody.analysis_period,
          mealsCount: requestBody.meals.length,
          trendsCount: analysisResult.trends?.length || 0
        }
      });

      console.log('💰 [NUTRITION_TREND] Tokens consumed', {
        userId: requestBody.user_id,
        tokensUsed: tokenUsage.total,
        costUsd: costUsd.toFixed(6)
      });
    }

    // Prepare response
    const response: TrendAnalysisResponse = {
      success: true,
      trends: analysisResult.trends || [],
      strategic_advice: analysisResult.strategic_advice || [],
      meal_classifications: analysisResult.meal_classifications || [],
      diet_compliance: analysisResult.diet_compliance || {
        overall_score: 80,
        compliance_rate: 0.85,
        deviations: [],
        suggestions: []
      },
      generated_at: analysisResult.generated_at || new Date().toISOString(),
      model_used: 'gpt-5-mini',
      tokens_used: tokenUsage.total > 0 ? tokenUsage : undefined,
      cached: false,
      tokens_consumed: estimatedTokens
    };

    // Save to cache for future requests (only if not fallback)
    if (!fallbackUsed) {
      await saveTrendAnalysisToCache(
        supabase,
        requestBody.user_id,
        requestBody.analysis_period,
        response
      );
    }

    console.log('NUTRITION_TREND_ANALYSIS', 'Real AI trend analysis generated successfully', {
      userId: requestBody.user_id,
      trendsCount: response.trends.length,
      adviceCount: response.strategic_advice.length,
      classificationsCount: response.meal_classifications.length,
      dietComplianceScore: response.diet_compliance.overall_score,
      aiModelUsed: aiModel,
      tokensUsed: tokenUsage.total,
      costUSD: tokenUsage.cost_estimate_usd,
      fallbackUsed,
      fallbackReason,
      timestamp: new Date().toISOString()
    });

    // Log cost tracking for monitoring
    if (tokenUsage.total > 0) {
      console.log('AI_COST_TRACKING', 'OpenAI trend analysis token usage logged', {
        userId: requestBody.user_id,
        analysisPeriod: requestBody.analysis_period,
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
    console.error('NUTRITION_TREND_ANALYSIS', 'Critical trend analysis generation failure', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Return intelligent fallback even on critical failure
    const fallbackResult = generateIntelligentTrendFallback(
      requestBody?.meals || [],
      requestBody?.user_profile
    );
    
    const response: TrendAnalysisResponse = {
      success: true, // Still return success with fallback
      trends: fallbackResult.trends || [],
      strategic_advice: fallbackResult.strategic_advice || [],
      meal_classifications: fallbackResult.meal_classifications || [],
      diet_compliance: fallbackResult.diet_compliance || {
        overall_score: 70,
        compliance_rate: 0.8,
        deviations: ['Service d\'IA temporairement indisponible'],
        suggestions: ['Réessayez plus tard pour une analyse complète']
      },
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