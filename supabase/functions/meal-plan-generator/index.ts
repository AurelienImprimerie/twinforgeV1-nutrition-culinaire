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

async function generateSingleDayWithAI(
  userProfile: any,
  inventory: any[],
  dayNumber: number,
  date: string,
  userId: string,
  supabase: any,
  batchCookingEnabled: boolean = false,
  previousDays: MealPlanDay[] = []
): Promise<{ day: MealPlanDay; tokenUsage: { input: number; output: number; costUsd: number } }> {
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

  const previousMealsContext = previousDays.length > 0
    ? `\n\nREPAS PRÉCÉDENTS CETTE SEMAINE:\n${previousDays.map((d, i) =>
        `Jour ${i + 1} (${d.date}):\n- Petit-déjeuner: ${d.breakfast.title}\n- Déjeuner: ${d.lunch.title}\n- Dîner: ${d.dinner.title}`
      ).join('\n\n')}\n\nIMPORTANT: Évite de répéter ces plats ou combinaisons similaires.`
    : '';

  let prompt = `Tu es un expert nutritionniste et chef cuisinier. Génère les repas pour UN SEUL JOUR (jour ${dayNumber}, date ${date}).

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
- Tolérance aux épices (1-5): ${spiceTolerance}${previousMealsContext}

CONTRAINTES:
- Date: ${date} (jour ${dayNumber} de la semaine)
- Utiliser prioritairement les ingrédients de l'inventaire
- Respecter les préférences alimentaires et objectifs nutritionnels
- Équilibrer les macronutriments selon le profil
- SI des données de santé reproductive sont fournies (cycle menstruel ou ménopause), adapter les recommandations nutritionnelles en conséquence
- IMPÉRATIF: Éviter la répétition des plats des jours précédents
- IMPÉRATIF: Proposer une variété de cuisines et de types de repas
- Optimiser pour réduire le gaspillage alimentaire
${batchCookingEnabled ? '- BATCH COOKING ACTIVÉ: Proposer des recettes qui peuvent être préparées en grande quantité et réutilisées intelligemment.' : ''}

INSTRUCTIONS CRÉATIVITÉ:
- Faire preuve de CRÉATIVITÉ et de NOUVEAUTÉ
- Proposer des associations d'ingrédients originales mais équilibrées
- Varier les méthodes de cuisson
- Créer des repas visuellement attrayants et savoureux
- IMPÉRATIF: Tous les champs numériques (prep_time_min, cook_time_min, calories_est, total_calories) DOIVENT être des nombres purs sans unités

FORMAT DE RÉPONSE REQUIS (JSON strict):
{
  "date": "${date}",
  "breakfast": {
    "title": "Nom du plat",
    "description": "Description",
    "ingredients": ["ingrédient 1", "ingrédient 2"],
    "prep_time_min": 10,
    "cook_time_min": 15,
    "calories_est": 400
  },
  "lunch": { /* même format */ },
  "dinner": { /* même format */ },
  "daily_summary": "Résumé de la journée",
  "total_calories": 1600
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
    console.log('MEAL_PLAN_GENERATOR GPT-5-mini response received for day:', {
      dayNumber,
      date,
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      usage: data.usage,
      model: 'gpt-5-mini'
    });

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    console.log('MEAL_PLAN_GENERATOR Raw GPT-5-mini content for day:', {
      dayNumber,
      date,
      length: content.length,
      preview: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
      model: 'gpt-5-mini'
    });

    let day: MealPlanDay;
    try {
      const jsonString = extractJsonFromResponse(content);

      console.log('MEAL_PLAN_GENERATOR About to parse JSON for day:', {
        dayNumber,
        length: jsonString.length,
        preview: jsonString.substring(0, 200)
      });

      day = JSON.parse(jsonString);
      console.log('MEAL_PLAN_GENERATOR Successfully parsed day:', {
        dayNumber,
        date: day.date,
        hasBreakfast: !!day.breakfast,
        hasLunch: !!day.lunch,
        hasDinner: !!day.dinner,
        totalCalories: day.total_calories,
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

    return { day, tokenUsage };
  } catch (error) {
    console.error('MEAL_PLAN_GENERATOR Error in generateSingleDayWithAI:', error);
    throw error;
  }
}

async function generateWeeklySummary(
  userProfile: any,
  days: MealPlanDay[],
  weekNumber: number,
  startDate: string
): Promise<{ summary: any; tokenUsage: { input: number; output: number; costUsd: number } }> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found');
  }

  const daysText = safeSerialize(days);
  const profileText = safeSerialize(userProfile);

  const prompt = `Analyse cette semaine de repas et génère un résumé nutritionnel.

PROFIL UTILISATEUR:
${profileText}

REPAS DE LA SEMAINE:
${daysText}

Génère un résumé avec:
- weekly_summary: analyse globale
- nutritional_highlights: 3-5 points forts
- shopping_optimization: conseils d'achat
- avg_calories_per_day: moyenne calorique
- ai_explanation: explication détaillée personnalisée

Format JSON:
{
  "weekly_summary": "...",
  "nutritional_highlights": ["..."],
  "shopping_optimization": "...",
  "avg_calories_per_day": 1600,
  "ai_explanation": {
    "personalizedReasoning": "...",
    "nutritionalStrategy": "...",
    "adaptationHighlights": ["..."],
    "weeklyGoals": ["..."],
    "complianceNotes": ["..."]
  }
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    const jsonString = extractJsonFromResponse(content);
    const summary = JSON.parse(jsonString);

    const tokenUsage = {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
      costUsd: ((data.usage?.prompt_tokens || 0) * 0.25 / 1000000) + ((data.usage?.completion_tokens || 0) * 2.00 / 1000000)
    };

    return { summary, tokenUsage };
  } catch (error) {
    console.error('MEAL_PLAN_GENERATOR Error generating weekly summary:', error);
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

    // Generate cache key for meal plan
    const cacheKeyData = {
      user_id: requestData.user_id,
      week_number: requestData.week_number,
      start_date: requestData.start_date,
      inventory_session_id: requestData.inventory_session_id,
      batch_cooking_enabled: requestData.batch_cooking_enabled,
      version: 'meal_plan_v1'
    };
    const cacheKeyEncoder = new TextEncoder();
    const cacheKeyBuffer = cacheKeyEncoder.encode(JSON.stringify(cacheKeyData));
    const cacheKeyHash = await crypto.subtle.digest('SHA-256', cacheKeyBuffer);
    const cacheKey = Array.from(new Uint8Array(cacheKeyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('MEAL_PLAN_GENERATOR Cache key generated:', { cache_key: cacheKey });

    // Check cache first (7-day TTL for meal plans)
    const { data: cachedResult } = await supabase
      .from('ai_analysis_jobs')
      .select('result_payload, created_at')
      .eq('input_hash', cacheKey)
      .eq('analysis_type', 'meal_plan_generation')
      .eq('status', 'completed')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (cachedResult?.result_payload) {
      console.log('MEAL_PLAN_GENERATOR Cache hit - returning cached meal plan', {
        user_id: requestData.user_id,
        cache_key: cacheKey,
        cached_at: cachedResult.created_at,
        timestamp: new Date().toISOString()
      });

      // Consume tokens for cache hit (reduced rate - covers server costs)
      // Fixed cost: 20 tokens = 0.020$ (no OpenAI cost, just server/bandwidth/storage)
      const CACHE_HIT_COST_USD = 0.004; // Equivalent to 20 tokens at x5 margin
      const requestId = crypto.randomUUID();
      await consumeTokensAtomic(supabase, {
        userId: requestData.user_id,
        edgeFunctionName: 'meal-plan-generator',
        operationType: 'meal_plan_generation_cache',
        openaiModel: 'cached',
        openaiCostUsd: CACHE_HIT_COST_USD,
        metadata: {
          cache_hit: true,
          cache_key: cacheKey,
          week_number: requestData.week_number,
          days_count: cachedResult.result_payload.days?.length || 0
        }
      }, requestId);

      console.log('MEAL_PLAN_GENERATOR Cache hit tokens consumed', {
        user_id: requestData.user_id,
        tokens_charged: 20,
        cost_usd: CACHE_HIT_COST_USD,
        cache_key: cacheKey,
        timestamp: new Date().toISOString()
      });

      // Return cached meal plan via streaming format
      const cachedPlan = cachedResult.result_payload;
      const cachedStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          // Send progress event
          const progressChunk = `data: ${JSON.stringify({
            type: 'progress',
            data: { phase: 'cache_hit', message: 'Plan alimentaire récupéré du cache', progress: 10 }
          })}\n\n`;
          controller.enqueue(encoder.encode(progressChunk));

          // Stream each cached day
          for (const day of cachedPlan.days || []) {
            const dayChunk = `data: ${JSON.stringify({ type: 'day', data: day })}\n\n`;
            controller.enqueue(encoder.encode(dayChunk));
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Send completion with summary
          const completionChunk = `data: ${JSON.stringify({
            type: 'complete',
            data: {
              weekly_summary: cachedPlan.weekly_summary,
              nutritional_highlights: cachedPlan.nutritional_highlights,
              shopping_optimization: cachedPlan.shopping_optimization,
              avg_calories_per_day: cachedPlan.avg_calories_per_day,
              ai_explanation: cachedPlan.ai_explanation,
              cached: true
            }
          })}\n\n`;
          controller.enqueue(encoder.encode(completionChunk));
          controller.close();
        }
      });

      return new Response(cachedStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    console.log('MEAL_PLAN_GENERATOR Cache miss - proceeding with AI generation', {
      user_id: requestData.user_id,
      cache_key: cacheKey
    });

    // Check token balance before OpenAI call
    // Realistic estimate: 7 days × ~18 tokens/day + 1 summary × ~16 tokens = ~142 tokens
    // Adding 15% safety buffer to prevent negative balances
    const estimatedTokens = 150;
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let totalTokenUsage = { input: 0, output: 0, costUsd: 0 };
        const days: MealPlanDay[] = [];

        try {
          // Send initial progress event
          const progressChunk = `data: ${JSON.stringify({
            type: 'progress',
            data: {
              phase: 'initializing',
              message: 'Analyse de votre profil et inventaire...',
              progress: 5
            }
          })}\n\n`;
          controller.enqueue(encoder.encode(progressChunk));

          // Generate 7 days sequentially with real-time streaming
          for (let dayNum = 1; dayNum <= 7; dayNum++) {
            const dayDate = new Date(requestData.start_date);
            dayDate.setDate(dayDate.getDate() + (dayNum - 1));
            const dateStr = dayDate.toISOString().split('T')[0];

            // Send progress before generating each day
            const preGenChunk = `data: ${JSON.stringify({
              type: 'progress',
              data: {
                phase: 'generating',
                message: `Génération du jour ${dayNum}...`,
                progress: 5 + (dayNum - 1) * 10,
                currentDay: dayNum,
                totalDays: 7
              }
            })}\n\n`;
            controller.enqueue(encoder.encode(preGenChunk));

            console.log(`MEAL_PLAN_GENERATOR Starting generation for day ${dayNum}`, { date: dateStr });

            // Generate single day with AI
            const { day, tokenUsage } = await generateSingleDayWithAI(
              userProfile,
              inventory,
              dayNum,
              dateStr,
              requestData.user_id,
              supabase,
              requestData.batch_cooking_enabled || false,
              days
            );

            days.push(day);
            totalTokenUsage.input += tokenUsage.input;
            totalTokenUsage.output += tokenUsage.output;
            totalTokenUsage.costUsd += tokenUsage.costUsd;

            console.log(`MEAL_PLAN_GENERATOR Day ${dayNum} generated`, { date: day.date });

            // Stream the day immediately after generation
            const dayChunk = `data: ${JSON.stringify({ type: 'day', data: day })}\n\n`;
            controller.enqueue(encoder.encode(dayChunk));

            // Send heartbeat to keep connection alive
            const heartbeatChunk = `data: ${JSON.stringify({
              type: 'heartbeat',
              data: { timestamp: new Date().toISOString(), daysGenerated: dayNum }
            })}\n\n`;
            controller.enqueue(encoder.encode(heartbeatChunk));
          }

          // Generate weekly summary
          const summaryProgressChunk = `data: ${JSON.stringify({
            type: 'progress',
            data: {
              phase: 'finalizing',
              message: 'Génération du résumé hebdomadaire...',
              progress: 85
            }
          })}\n\n`;
          controller.enqueue(encoder.encode(summaryProgressChunk));

          const { summary, tokenUsage: summaryTokenUsage } = await generateWeeklySummary(
            userProfile,
            days,
            requestData.week_number,
            requestData.start_date
          );

          totalTokenUsage.input += summaryTokenUsage.input;
          totalTokenUsage.output += summaryTokenUsage.output;
          totalTokenUsage.costUsd += summaryTokenUsage.costUsd;

          // Monitor estimation vs reality for accuracy tracking
          const totalTokensActual = totalTokenUsage.input + totalTokenUsage.output;
          const estimationAccuracy = ((totalTokensActual - estimatedTokens) / estimatedTokens * 100).toFixed(1);
          const estimationStatus = Math.abs(parseFloat(estimationAccuracy)) > 20 ? '⚠️ HIGH_DISCREPANCY' : '✅ ACCEPTABLE';

          console.log('MEAL_PLAN_GENERATOR Token estimation vs reality', {
            userId: requestData.user_id,
            estimated: estimatedTokens,
            actual_input: totalTokenUsage.input,
            actual_output: totalTokenUsage.output,
            actual_total: totalTokensActual,
            actual_cost_usd: totalTokenUsage.costUsd.toFixed(6),
            discrepancy_percent: estimationAccuracy + '%',
            status: estimationStatus,
            timestamp: new Date().toISOString()
          });

          console.log('MEAL_PLAN_GENERATOR Plan generation completed', {
            userId: requestData.user_id,
            weekNumber: requestData.week_number,
            avgCaloriesPerDay: summary.avg_calories_per_day,
            hasAiExplanation: !!summary.ai_explanation,
            timestamp: new Date().toISOString()
          });

          // Send completion chunk with summary
          const completionChunk = `data: ${JSON.stringify({
            type: 'complete',
            data: {
              weekly_summary: summary.weekly_summary,
              nutritional_highlights: summary.nutritional_highlights,
              shopping_optimization: summary.shopping_optimization,
              avg_calories_per_day: summary.avg_calories_per_day,
              ai_explanation: summary.ai_explanation
            }
          })}\n\n`;
          controller.enqueue(encoder.encode(completionChunk));

          // Consume tokens after successful generation
          await consumeTokensAtomic(supabase, {
            userId: requestData.user_id,
            edgeFunctionName: 'meal-plan-generator',
            operationType: 'meal_plan_generation',
            openaiModel: 'gpt-5-mini',
            openaiInputTokens: totalTokenUsage.input,
            openaiOutputTokens: totalTokenUsage.output,
            openaiCostUsd: totalTokenUsage.costUsd,
            metadata: {
              week_number: requestData.week_number,
              start_date: requestData.start_date,
              inventory_count: inventory.length,
              has_preferences: requestData.has_preferences,
              days_generated: days.length
            }
          });

          // Save to database
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
            plan_data: {
              week_number: requestData.week_number,
              start_date: requestData.start_date,
              days,
              ...summary
            },
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

          console.log('MEAL_PLAN_GENERATOR Stream completed successfully');
          controller.close();
        } catch (error) {
          console.error('MEAL_PLAN_GENERATOR Error during streaming:', error);
          const errorChunk = `data: ${JSON.stringify({
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error',
              daysGenerated: days.length
            }
          })}\n\n`;
          controller.enqueue(encoder.encode(errorChunk));
          controller.close();
        }
      }
    });

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