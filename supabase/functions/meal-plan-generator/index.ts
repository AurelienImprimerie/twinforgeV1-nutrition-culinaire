import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';
import { getReproductiveHealthContext } from '../_shared/utils/reproductiveHealthContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization, Content-Type, X-Client-Info, Apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MealPlanRequest {
  user_id: string;
  session_id?: string;
  inventory_session_id?: string;
  week_number: number;
  start_date: string;
  inventory_count: number;
  has_preferences: boolean;
  batch_cooking_enabled?: boolean;
}

interface MealPlanDay {
  date: string;
  breakfast: {
    title: string;
    description: string;
    ingredients: string[];
    prep_time_min: number;
    cook_time_min: number;
    calories_est: number;
  };
  lunch: {
    title: string;
    description: string;
    ingredients: string[];
    prep_time_min: number;
    cook_time_min: number;
    calories_est: number;
  };
  dinner: {
    title: string;
    description: string;
    ingredients: string[];
    prep_time_min: number;
    cook_time_min: number;
    calories_est: number;
  };
  snack?: {
    title: string;
    description: string;
    ingredients: string[];
    prep_time_min: number;
    cook_time_min: number;
    calories_est: number;
  };
  daily_summary: string;
  total_calories: number;
}

interface MealPlan {
  week_number: number;
  start_date: string;
  days: MealPlanDay[];
  weekly_summary: string;
  nutritional_highlights: string[];
  shopping_optimization: string;
  avg_calories_per_day: number;
  ai_explanation: {
    personalizedReasoning: string;
    nutritionalStrategy: string;
    adaptationHighlights: string[];
    weeklyGoals: string[];
    complianceNotes: string[];
  };
}

function isValidUUID(value: string | undefined): boolean {
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function safeSerialize(data: any): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('MEAL_PLAN_GENERATOR Serialization error:', error);
    return 'Unable to serialize data';
  }
}

function truncatePrompt(prompt: string, maxLength: number = 100000): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  
  console.log(`MEAL_PLAN_GENERATOR Prompt too long (${prompt.length} chars), truncating to ${maxLength}`);
  return prompt.substring(0, maxLength) + '\n\n[TRUNCATED DUE TO LENGTH]';
}

function sanitizeJsonString(jsonStr: string): string {
  // Remove trailing commas before ] or }
  let sanitized = jsonStr.replace(/,(\s*[\]}])/g, '$1');

  // Fix common issues with quotes
  sanitized = sanitized.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  return sanitized;
}

function extractJsonFromResponse(content: string): string {
  console.log('MEAL_PLAN_GENERATOR Extracting JSON from response:', {
    contentLength: content.length,
    contentPreview: content.substring(0, 200)
  });

  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/i;
  const markdownMatch = content.match(jsonBlockRegex);

  if (markdownMatch && markdownMatch[1]) {
    const extractedJson = markdownMatch[1].trim();
    console.log('MEAL_PLAN_GENERATOR Found JSON in markdown block:', {
      length: extractedJson.length,
      preview: extractedJson.substring(0, 200)
    });
    return sanitizeJsonString(extractedJson);
  }

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error(`No valid JSON boundaries found in OpenAI response. First brace at: ${firstBrace}, Last brace at: ${lastBrace}`);
  }

  const extractedJson = content.substring(firstBrace, lastBrace + 1);
  console.log('MEAL_PLAN_GENERATOR Extracted JSON using brace search:', {
    length: extractedJson.length,
    preview: extractedJson.substring(0, 200)
  });

  return sanitizeJsonString(extractedJson);
}

async function generateMealPlanWithAI(
  userProfile: any,
  inventory: any[],
  weekNumber: number,
  startDate: string,
  userId: string,
  supabase: any,
  batchCookingEnabled: boolean = false
): Promise<{ mealPlan: MealPlan; tokenUsage: { input: number; output: number; costUsd: number } }> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  const inventoryText = safeSerialize(inventory);
  const profileText = safeSerialize(userProfile);

  const foodPreferences = userProfile.food_preferences || {};
  const sensoryPreferences = userProfile.sensory_preferences || {};
  const likedCuisines = foodPreferences.cuisines || [];
  const likedIngredients = foodPreferences.ingredients || [];
  const likedFlavors = foodPreferences.flavors || [];
  const dislikedIngredients = userProfile.nutrition?.disliked || [];
  const textureAversions = sensoryPreferences.textureAversions || [];
  const spiceTolerance = sensoryPreferences.spiceTolerance || 1;

  let prompt = `Tu es un expert nutritionniste et chef cuisinier. Génère un plan de repas personnalisé pour une semaine complète.

PROFIL UTILISATEUR:
${profileText}

INVENTAIRE DISPONIBLE:
${inventoryText}

PRÉFÉRENCES DE VARIÉTÉ:
- Cuisines appréciées: ${likedCuisines.length > 0 ? likedCuisines.join(', ') : 'Aucune préférence spécifique'}
- Ingrédients appréciés: ${likedIngredients.length > 0 ? likedIngredients.join(', ') : 'Aucune préférence spécifique'}
- Saveurs appréciées: ${likedFlavors.length > 0 ? likedFlavors.join(', ') : 'Aucune préférence spécifique'}
- Ingrédients à éviter: ${dislikedIngredients.length > 0 ? dislikedIngredients.join(', ') : 'Aucun'}
- Textures à éviter: ${textureAversions.length > 0 ? textureAversions.join(', ') : 'Aucune'}
- Tolérance aux épices (1-5): ${spiceTolerance}

CONTRAINTES:
- Semaine ${weekNumber} commençant le ${startDate}
- Utiliser prioritairement les ingrédients de l'inventaire
- Respecter les préférences alimentaires et objectifs nutritionnels
- Équilibrer les macronutriments selon le profil
- SI des données de santé reproductive sont fournies (cycle menstruel ou ménopause), adapter les recommandations nutritionnelles en conséquence
- IMPÉRATIF: Éviter la répétition des plats ou des combinaisons d'ingrédients similaires sur plusieurs jours consécutifs
- IMPÉRATIF: Proposer une variété de cuisines et de types de repas (ex: soupes, salades, plats mijotés, grillades, sautés, currys, etc.)
- Alterner entre les cuisines appréciées si plusieurs sont mentionnées
- Explorer différentes combinaisons de saveurs et techniques de cuisson
- Varier les textures et les présentations pour éviter la monotonie
- Optimiser pour réduire le gaspillage alimentaire
${batchCookingEnabled ? '- BATCH COOKING ACTIVÉ: Proposer des recettes qui peuvent être préparées en grande quantité et réutilisées intelligemment (ex: poulet rôti utilisé pour salade le lendemain, base de sauce pour plusieurs repas, légumes grillés en batch). Indiquer clairement les opportunités de batch cooking dans les recettes.' : ''}

INSTRUCTIONS CRÉATIVITÉ:
- Faire preuve de CRÉATIVITÉ et de NOUVEAUTÉ dans chaque repas
- Proposer des associations d'ingrédients originales mais équilibrées
- Varier les méthodes de cuisson (grillé, rôti, sauté, mijoté, cru, vapeur, etc.)
- Intégrer des éléments de différentes traditions culinaires
- Créer des repas visuellement attrayants et savoureux
- Éviter absolument la répétition de combinaisons d'ingrédients identiques
- IMPÉRATIF: Assurer que toutes les valeurs prep_time_min, cook_time_min, calories_est et total_calories sont des nombres entiers ou décimaux (pas de chaînes de caractères)
- IMPÉRATIF: Retourner strictement prep_time_min, cook_time_min, calories_est et total_calories comme des nombres purs (ex: 10, pas "10min" ou "10")
- CRITIQUE: Les champs prep_time_min, cook_time_min, calories_est et total_calories DOIVENT être des nombres sans unités ni caractères non-numériques
- CRITIQUE: Tout caractère non-numérique dans ces champs causera des erreurs système
- EXEMPLE CORRECT: "prep_time_min": 15, "cook_time_min": 20, "calories_est": 350
- EXEMPLE INCORRECT: "prep_time_min": "15min", "cook_time_min": "20 minutes", "calories_est": "350 kcal"

TU DOIS GÉNÉRER UN OBJET JSON UNIQUE. CE JSON DOIT CONTENIR UNE CLÉ "DAYS" QUI EST UN TABLEAU CONTENANT EXACTEMENT 7 OBJETS 'DAY', UN POUR CHAQUE JOUR DE LA SEMAINE. NE FOURNIS PAS D'EXEMPLE PARTIEL.

FORMAT DE RÉPONSE REQUIS (JSON strict):
{
  "week_number": ${weekNumber},
  "start_date": "${startDate}",
  "days": [
    // EXACTEMENT 7 objets day, un pour chaque jour de la semaine
    // Chaque objet day doit contenir: date, breakfast, lunch, dinner, snack (optionnel), daily_summary, total_calories
    // CRITIQUE: Chaque repas (breakfast, lunch, dinner, snack) DOIT avoir un champ "title" contenant le nom du plat
    // Tous les champs numériques (prep_time_min, cook_time_min, calories_est, total_calories) doivent être des nombres purs
  ],
  "weekly_summary": "Analyse globale de la semaine nutritionnelle",
  "nutritional_highlights": ["Point fort 1", "Point fort 2", "Point fort 3"],
  "shopping_optimization": "Conseils pour optimiser les achats et réduire le gaspillage",
  "avg_calories_per_day": 1600,
  "ai_explanation": {
    "personalizedReasoning": "Explication personnalisée",
    "nutritionalStrategy": "Stratégie nutritionnelle adoptée",
    "adaptationHighlights": ["Adaptation 1", "Adaptation 2", "Adaptation 3"],
    "weeklyGoals": ["Objectif 1", "Objectif 2", "Objectif 3"],
    "complianceNotes": ["Note de conformité 1", "Note de conformité 2"]
  }
}

RÉPONDS UNIQUEMENT AVEC LE JSON COMPLET. NE FOURNIS AUCUN TEXTE EXPLICATIF AVANT OU APRÈS LE JSON.`;

  // Add reproductive health context if available
  try {
    const reproductiveContext = await getReproductiveHealthContext(userId, supabase);
    if (reproductiveContext && reproductiveContext.formattedContext) {
      prompt += `\n\n${reproductiveContext.formattedContext}`;
    }
  } catch (error) {
    console.warn('MEAL_PLAN_GENERATOR', 'Failed to fetch reproductive health context', { error });
  }

  const truncatedPrompt = truncatePrompt(prompt);
  
  console.log('MEAL_PLAN_GENERATOR Prompt details:', {
    originalLength: prompt.length,
    truncatedLength: truncatedPrompt.length,
    inventoryItems: inventory.length,
    hasUserProfile: !!userProfile
  });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'user',
            content: truncatedPrompt
          }
        ],
        max_completion_tokens: 15000
      }),
    });

    console.log('MEAL_PLAN_GENERATOR OpenAI response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('MEAL_PLAN_GENERATOR OpenAI API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      throw new Error(`OpenAI API error: ${response.status}\nDetails: ${errorBody}`);
    }

    const data = await response.json();
    console.log('MEAL_PLAN_GENERATOR GPT-5-mini response received:', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      usage: data.usage,
      model: 'gpt-5-mini'
    });

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    console.log('MEAL_PLAN_GENERATOR Raw GPT-5-mini content:', {
      length: content.length,
      preview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      model: 'gpt-5-mini'
    });

    let mealPlan: MealPlan;
    try {
      const jsonString = extractJsonFromResponse(content);

      console.log('MEAL_PLAN_GENERATOR About to parse JSON string:', {
        length: jsonString.length,
        preview: jsonString.substring(0, 300)
      });

      mealPlan = JSON.parse(jsonString);
      console.log('MEAL_PLAN_GENERATOR Successfully parsed meal plan:', {
        weekNumber: mealPlan.week_number,
        daysCount: mealPlan.days?.length,
        avgCalories: mealPlan.avg_calories_per_day,
        hasAiExplanation: !!mealPlan.ai_explanation,
        model: 'gpt-5-mini'
      });
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      const positionMatch = errorMessage.match(/position (\d+)/);

      if (positionMatch) {
        const errorPos = parseInt(positionMatch[1]);
        const jsonString = extractJsonFromResponse(content);
        const contextStart = Math.max(0, errorPos - 100);
        const contextEnd = Math.min(jsonString.length, errorPos + 100);

        console.error('MEAL_PLAN_GENERATOR JSON parsing error at position:', {
          error: errorMessage,
          position: errorPos,
          contextBefore: jsonString.substring(contextStart, errorPos),
          contextAfter: jsonString.substring(errorPos, contextEnd),
          totalLength: jsonString.length
        });
      } else {
        console.error('MEAL_PLAN_GENERATOR JSON parsing error:', {
          error: errorMessage,
          contentLength: content?.length || 0,
          contentPreview: content?.substring(0, 1000) || 'No content'
        });
      }

      throw new Error(`Failed to parse OpenAI response as JSON: ${errorMessage}`);
    }

    const tokenUsage = {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
      costUsd: ((data.usage?.prompt_tokens || 0) * 0.25 / 1000000) + ((data.usage?.completion_tokens || 0) * 2.00 / 1000000)
    };

    return { mealPlan, tokenUsage };
  } catch (error) {
    console.error('MEAL_PLAN_GENERATOR Error in generateMealPlanWithAI:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  console.log('MEAL_PLAN_GENERATOR Function started', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const requestData: MealPlanRequest = await req.json();
    console.log('MEAL_PLAN_GENERATOR Request received', {
      user_id: requestData.user_id,
      session_id: requestData.session_id,
      week_number: requestData.week_number,
      start_date: requestData.start_date,
      inventory_count: requestData.inventory_count,
      has_preferences: requestData.has_preferences,
      timestamp: new Date().toISOString()
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('MEAL_PLAN_GENERATOR Supabase client initialized');

    // Check token balance before OpenAI call (estimate ~50 tokens for meal plan)
    const estimatedTokens = 50;
    const tokenCheck = await checkTokenBalance(supabase, requestData.user_id, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('MEAL_PLAN_GENERATOR', 'Insufficient tokens', {
        user_id: requestData.user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokens,
        timestamp: new Date().toISOString()
      });

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokens,
        !tokenCheck.isSubscribed,
        corsHeaders
      );
    }

    console.log('MEAL_PLAN_GENERATOR Starting meal plan generation', {
      userId: requestData.user_id,
      inventoryCount: requestData.inventory_count
    });

    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/user_profile?user_id=eq.${requestData.user_id}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    let userProfile = {};
    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      userProfile = profiles[0] || {};
    }

    console.log('MEAL_PLAN_GENERATOR Profile analysis complete');

    const inventoryResponse = await fetch(`${supabaseUrl}/rest/v1/recipe_sessions?user_id=eq.${requestData.user_id}&order=created_at.desc&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    let inventory: any[] = [];
    if (inventoryResponse.ok) {
      const sessions = await inventoryResponse.json();
      if (sessions.length > 0) {
        inventory = sessions[0].inventory_final || [];
      }
    }

    console.log('MEAL_PLAN_GENERATOR Inventory optimization complete');

    const { mealPlan, tokenUsage } = await generateMealPlanWithAI(
      userProfile,
      inventory,
      requestData.week_number,
      requestData.start_date,
      requestData.user_id,
      supabase,
      requestData.batch_cooking_enabled || false
    );

    // Consume tokens after successful generation
    const requestId = crypto.randomUUID();
    await consumeTokensAtomic(supabase, {
      userId: requestData.user_id,
      edgeFunctionName: 'meal-plan-generator',
      operationType: 'meal_plan_generation',
      openaiModel: 'gpt-5-mini',
      openaiInputTokens: tokenUsage.input,
      openaiOutputTokens: tokenUsage.output,
      openaiCostUsd: tokenUsage.costUsd,
      metadata: {
        week_number: requestData.week_number,
        start_date: requestData.start_date,
        inventory_count: inventory.length,
        has_preferences: requestData.has_preferences,
        days_generated: mealPlan.days?.length || 0
      }
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        mealPlan.days.forEach((day, index) => {
          console.log(`MEAL_PLAN_GENERATOR Day ${index + 1} generated`, { date: day.date });
          const chunk = `data: ${JSON.stringify({ type: 'day', data: day })}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        });

        console.log('MEAL_PLAN_GENERATOR Plan generation completed', {
          userId: requestData.user_id,
          weekNumber: requestData.week_number,
          avgCaloriesPerDay: mealPlan.avg_calories_per_day,
          hasAiExplanation: !!mealPlan.ai_explanation,
          timestamp: new Date().toISOString()
        });

        const completionChunk = `data: ${JSON.stringify({ 
          type: 'complete', 
          data: {
            weekly_summary: mealPlan.weekly_summary,
            nutritional_highlights: mealPlan.nutritional_highlights,
            shopping_optimization: mealPlan.shopping_optimization,
            avg_calories_per_day: mealPlan.avg_calories_per_day,
            ai_explanation: mealPlan.ai_explanation
          }
        })}\n\n`;
        controller.enqueue(encoder.encode(completionChunk));
        controller.close();
      }
    });

    console.log('MEAL_PLAN_GENERATOR Stream completed successfully');

    const startDate = new Date(requestData.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const mealPlanData = {
      user_id: requestData.user_id,
      session_id: isValidUUID(requestData.session_id) ? requestData.session_id : null,
      inventory_session_id: isValidUUID(requestData.inventory_session_id) ? requestData.inventory_session_id : null,
      week_number: requestData.week_number,
      start_date: requestData.start_date,
      end_date: endDate.toISOString().split('T')[0],
      plan_data: mealPlan,
      batch_cooking_enabled: requestData.batch_cooking_enabled || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/meal_plans`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mealPlanData)
    });

    if (saveResponse.ok) {
      console.log('MEAL_PLAN_GENERATOR Meal plan saved successfully');
    } else {
      console.error('MEAL_PLAN_GENERATOR Failed to save meal plan:', await saveResponse.text());
    }

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error) {
    console.error('MEAL_PLAN_GENERATOR Meal plan generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate meal plan',
        details: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});