import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Parse request body
    const { inventory_final, user_preferences, filters, user_id, existing_recipes } = await req.json();

    // Validate input
    if (!inventory_final || !Array.isArray(inventory_final) || inventory_final.length === 0) {
      return new Response(JSON.stringify({
        error: 'inventory_final array is required and cannot be empty'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!user_id) {
      return new Response(JSON.stringify({
        error: 'user_id is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const startTime = Date.now();

    console.log('RECIPE_GENERATOR', 'Starting streaming recipe generation', {
      user_id,
      inventory_count: inventory_final.length,
      has_preferences: !!user_preferences,
      has_filters: !!filters,
      timestamp: new Date().toISOString()
    });

    // Generate cache key with fitness focus
    const cacheKey = await generateCacheKey(inventory_final, user_preferences, filters, user_id, existing_recipes);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    const { data: cachedResult } = await supabase
      .from('ai_analysis_jobs')
      .select('result_payload')
      .eq('input_hash', cacheKey)
      .eq('analysis_type', 'recipe_generation')
      .gte('created_at', new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()) // 36h TTL
      .single();

    if (cachedResult?.result_payload) {
      console.log('RECIPE_GENERATOR', 'Cache hit - streaming cached recipes', {
        user_id,
        cache_key: cacheKey,
        timestamp: new Date().toISOString()
      });

      // Stream cached recipes one by one
      return streamCachedRecipes(cachedResult.result_payload.recipes, startTime);
    }

    // Check token balance before OpenAI call (estimate ~30 tokens for recipe generation)
    const estimatedTokens = 30;
    const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('RECIPE_GENERATOR', 'Insufficient tokens', {
        user_id,
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

    // Prepare ingredients list for AI
    const ingredientsList = inventory_final.map(item => `${item.name} (${item.quantity || '1'})`).join(', ');

    // Build FITNESS-FOCUSED dietary constraints
    const dietaryConstraints = [] as string[];
    const nutrition = user_preferences?.nutrition || {};
    const mealPrepPreferences = user_preferences?.meal_prep_preferences || {};
    const kitchenEquipment = user_preferences?.kitchen_equipment || {};
    const foodPreferences = user_preferences?.food_preferences || {
      cuisines: [],
      ingredients: [],
      flavors: []
    };
    const sensoryPreferences = user_preferences?.sensory_preferences || {
      spiceTolerance: 1,
      textureAversions: []
    };
    const macroTargets = user_preferences?.macro_targets || {};
    const userIdentity = user_preferences?.user_identity || {};

    console.log('RECIPE_GENERATOR', 'User preferences audit', {
      user_id,
      has_nutrition: !!nutrition,
      has_macro_targets: !!macroTargets,
      has_user_identity: !!userIdentity,
      user_objective: userIdentity.objective,
      user_sex: userIdentity.sex,
      user_activity_level: userIdentity.activity_level,
      macro_targets_kcal: macroTargets.kcal,
      protein_target: nutrition.proteinTarget_g,
      cooking_skill: mealPrepPreferences.cookingSkill,
      diet_type: nutrition.diet,
      allergies_count: nutrition.allergies?.length || 0,
      timestamp: new Date().toISOString()
    });

    // FITNESS-FOCUSED constraints
    if (nutrition.diet) {
      dietaryConstraints.push(`Régime alimentaire: ${nutrition.diet}`);
    }
    if (nutrition.allergies?.length > 0) {
      dietaryConstraints.push(`ALLERGIES CRITIQUES: ${nutrition.allergies.join(', ')} - ABSOLUMENT À ÉVITER`);
    }
    if (nutrition.intolerances?.length > 0) {
      dietaryConstraints.push(`Intolérances: ${nutrition.intolerances.join(', ')} - À éviter si possible`);
    }

    // Add graceful fallbacks for missing critical data
    if (!nutrition.allergies) {
      dietaryConstraints.push("Aucune allergie connue - Liberté totale d'ingrédients");
    }
    if (!nutrition.diet) {
      dietaryConstraints.push('Régime omnivore par défaut - Tous types de recettes autorisées');
    }

    // Build food preferences constraints
    const foodConstraints = [] as string[];
    if (foodPreferences.ingredients?.length > 0) {
      const liked = foodPreferences.ingredients.filter((p: any) => p.state === 'like').map((p: any) => p.name);
      const disliked = foodPreferences.ingredients.filter((p: any) => p.state === 'dislike').map((p: any) => p.name);
      const banned = foodPreferences.ingredients.filter((p: any) => p.state === 'ban').map((p: any) => p.name);

      if (liked.length > 0) foodConstraints.push(`Ingrédients appréciés: ${liked.join(', ')}`);
      if (disliked.length > 0) foodConstraints.push(`Ingrédients peu appréciés: ${disliked.join(', ')}`);
      if (banned.length > 0) foodConstraints.push(`Ingrédients BANNIS: ${banned.join(', ')} - NE PAS UTILISER`);
    }

    if (foodPreferences.cuisines?.length > 0) {
      const likedCuisines = foodPreferences.cuisines.filter((p: any) => p.state === 'like').map((p: any) => p.name);
      const dislikedCuisines = foodPreferences.cuisines.filter((p: any) => p.state === 'dislike').map((p: any) => p.name);
      if (likedCuisines.length > 0) foodConstraints.push(`Cuisines préférées: ${likedCuisines.join(', ')}`);
      if (dislikedCuisines.length > 0) foodConstraints.push(`Cuisines à éviter: ${dislikedCuisines.join(', ')}`);
    }

    // Build sensory constraints
    const sensoryConstraints = [] as string[];
    if (sensoryPreferences.spiceTolerance !== undefined) {
      const spiceLevel = ['aucun piment', 'piment doux', 'piment moyen', 'piment fort'][sensoryPreferences.spiceTolerance] || 'piment doux';
      sensoryConstraints.push(`Tolérance au piment: ${spiceLevel} maximum`);
    }
    if (sensoryPreferences.textureAversions?.length > 0) {
      sensoryConstraints.push(`Textures à éviter: ${sensoryPreferences.textureAversions.join(', ')}`);
    }

    // Build equipment constraints  
    const availableEquipment = kitchenEquipment ? Object.entries(kitchenEquipment)
      .filter(([key, available]) => available === true)
      .map(([key]) => {
        const equipmentLabels: Record<string,string> = {
          oven: 'four',
          stove: 'plaques de cuisson',
          microwave: 'micro-ondes',
          airFryer: 'friteuse à air',
          slowCooker: 'mijoteuse',
          blender: 'mixeur',
          foodProcessor: 'robot culinaire',
          standMixer: 'batteur',
          riceCooker: 'cuiseur à riz',
          grill: 'grill',
          steamBasket: 'panier vapeur',
          pressureCooker: 'autocuiseur'
        };
        return equipmentLabels[key as string] || (key as string);
      }).join(', ') : 'équipement de base (four, plaques)';

    // Build time constraints
    const timeConstraints = [] as string[];
    if (mealPrepPreferences.weekdayTimeMin) {
      timeConstraints.push(`Temps semaine: ${mealPrepPreferences.weekdayTimeMin} min max`);
    }
    if (mealPrepPreferences.weekendTimeMin) {
      timeConstraints.push(`Temps week-end: ${mealPrepPreferences.weekendTimeMin} min max`);
    }
    if (mealPrepPreferences.cookingSkill) {
      const skillLevel = {
        'beginner': 'débutant - recettes simples',
        'intermediate': 'intermédiaire - techniques modérées',
        'advanced': 'confirmé - techniques avancées autorisées'
      }[mealPrepPreferences.cookingSkill] || 'intermédiaire';
      timeConstraints.push(`Niveau cuisine: ${skillLevel}`);
    }

    // FITNESS-FOCUSED macro targets guidance
    const macroGuidance = [] as string[];
    if (macroTargets.kcal) macroGuidance.push(`Calories cible: ~${macroTargets.kcal} kcal/jour`);
    if (macroTargets.fiberMinG) macroGuidance.push(`Fibres minimum: ${macroTargets.fiberMinG}g`);
    if (macroTargets.sugarMaxG) macroGuidance.push(`Sucre maximum: ${macroTargets.sugarMaxG}g`);
    if (nutrition.proteinTarget_g) macroGuidance.push(`Protéines cible: ${nutrition.proteinTarget_g}g/jour`);

    // Add fallbacks for missing macro targets based on fitness goals
    if (!macroTargets.kcal && userIdentity.weight_kg && userIdentity.objective) {
      const estimatedCalories = calculateFitnessCalories(userIdentity);
      macroGuidance.push(`Calories estimées: ~${estimatedCalories} kcal/jour (basé sur votre objectif ${userIdentity.objective})`);
    }
    if (!nutrition.proteinTarget_g && userIdentity.weight_kg && userIdentity.objective) {
      const estimatedProtein = calculateFitnessProtein(userIdentity);
      macroGuidance.push(`Protéines estimées: ~${estimatedProtein}g/jour (basé sur votre objectif ${userIdentity.objective})`);
    }

    // FITNESS-FOCUSED prompt
    // Build existing recipes context for anti-repetition
    let existingRecipesContext = '';
    if (existing_recipes && existing_recipes.length > 0) {
      existingRecipesContext = `
RECETTES DÉJÀ GÉNÉRÉES (ANALYSE ANTI-RÉPÉTITION OBLIGATOIRE):
${existing_recipes.map((recipe: any, index: number) => 
  `${index + 1}. "${recipe.title}" - Ingrédients principaux: ${recipe.main_ingredients?.join(', ') || 'Non spécifiés'}`
).join('\n')}

ANALYSE CRITIQUE REQUISE:
- Identifie les PATTERNS de répétition dans les recettes ci-dessus (types de plats récurrents, ingrédients dominants, méthodes de cuisson similaires)
- Évite ABSOLUMENT de reproduire ces patterns dans tes nouvelles propositions
- Si tu détectes une tendance (ex: "trop de salades", "trop de dinde", "trop de plats froids"), compense activement avec des alternatives
- Chaque nouvelle recette doit apporter une NOUVEAUTÉ significative par rapport à l'historique

`;
    }

    const recipePrompt = `Tu es un chef cuisinier expert spécialisé dans la nutrition sportive et les objectifs fitness pour TwinForge.

RÈGLES STRICTES DE RÉPONSE:
- Réponds UNIQUEMENT avec un JSON valide
- AUCUN texte avant ou après le JSON
- AUCUN markdown (\`\`\`json)
- AUCUN commentaire ou explication
- Format exact: [{"title": "...", "description": "...", ...}]

MISSION FITNESS:
Tu crées des recettes pour UN UTILISATEUR INDIVIDUEL qui veut atteindre des OBJECTIFS FITNESS spécifiques.
Ces recettes doivent être NUTRITIONNELLEMENT OPTIMISÉES pour soutenir la performance, la récupération et la composition corporelle.

INGRÉDIENTS DISPONIBLES:
${ingredientsList}

${existingRecipesContext}CONTRAINTES FITNESS STRICTES:
CONTRAINTES FITNESS STRICTES:
- Équipement disponible: ${availableEquipment}
${dietaryConstraints.length > 0 ? `- RESTRICTIONS ALIMENTAIRES: ${dietaryConstraints.join(' | ')}` : ''}
${foodConstraints.length > 0 ? `- PRÉFÉRENCES ALIMENTAIRES: ${foodConstraints.join(' | ')}` : ''}
${sensoryConstraints.length > 0 ? `- CONTRAINTES SENSORIELLES: ${sensoryConstraints.join(' | ')}` : ''}
${timeConstraints.length > 0 ? `- CONTRAINTES DE TEMPS: ${timeConstraints.join(' | ')}` : ''}
- PORTIONS: Recettes pour 1 personne (possibilité de batch cooking individuel)
${macroGuidance.length > 0 ? `- OBJECTIFS NUTRITIONNELS: ${macroGuidance.join(' | ')}` : ''}
${filters?.max_prep_time ? `- Temps de préparation max: ${filters.max_prep_time} minutes` : ''}
${filters?.max_cook_time ? `- Temps de cuisson max: ${filters.max_cook_time} minutes` : ''}
${filters?.servings ? `- Portions minimum: ${filters.servings}` : ''}

PERSONNALISATION FITNESS AVANCÉE:
${userIdentity.sex ? `- Genre: ${userIdentity.sex === 'male' ? 'Homme' : 'Femme'} (influence les besoins nutritionnels)` : ''}
${userIdentity.activity_level ? `- Niveau d'activité: ${userIdentity.activity_level} (influence les besoins caloriques)` : ''}
${userIdentity.objective ? `- OBJECTIF FITNESS: ${getObjectiveDescription(userIdentity.objective)} (PRIORITÉ ABSOLUE)` : ''}
${userIdentity.weight_kg ? `- Poids: ${userIdentity.weight_kg}kg (pour calculs nutritionnels)` : ''}

INSTRUCTIONS FITNESS:
1. Génère EXACTEMENT 4 recettes HAUTEMENT OPTIMISÉES pour l'OBJECTIF FITNESS de l'utilisateur
${existing_recipes && existing_recipes.length > 0 ? 
`2. PRIORITÉ ABSOLUE À LA NOUVEAUTÉ : Chaque recette doit être significativement différente des 'RECETTES DÉJÀ GÉNÉRÉES' en termes de type de plat, saveurs dominantes et combinaisons d'ingrédients principaux
3. PÉNALITÉ POUR SIMILARITÉ : Si tu identifies une similarité potentielle avec l'historique, REJETTE cette idée et trouve une alternative créative
4. DIVERSITÉ STRUCTURELLE OBLIGATOIRE : Varie les types de plats parmi (salade, plat mijoté, gratin, sandwich, smoothie, bol, ragoût, wrap, curry, wok, soupe, omelette, grillades, sauté)
5. DIVERSITÉ DES MÉTHODES : Varie les méthodes de cuisson parmi (au four, à la poêle, à la vapeur, sans cuisson, grillé, mijoté, sauté, mixé, mariné)
6. RÈGLE ANTI-RÉPÉTITION : Les 4 recettes ne doivent PAS partager le même type de plat principal ou la même structure de repas
7. ` : '2. '}RESPECTE ABSOLUMENT les allergies et restrictions alimentaires
${existing_recipes && existing_recipes.length > 0 ? '8. ' : '3. '}Privilégie les ingrédients appréciés, évite ceux non aimés, BANNIS les interdits
${existing_recipes && existing_recipes.length > 0 ? '9. ' : '4. '}Adapte la complexité au niveau de cuisine de l'utilisateur (${mealPrepPreferences.cookingSkill || 'intermédiaire'})
${existing_recipes && existing_recipes.length > 0 ? '10. ' : '5. '}Respecte les contraintes de temps et d'équipement
${existing_recipes && existing_recipes.length > 0 ? '11. ' : '6. '}OPTIMISE les macronutriments pour l'objectif fitness
${existing_recipes && existing_recipes.length > 0 ? '12. ' : '7. '}Utilise INTELLIGEMMENT les ingrédients disponibles (ignore eau/emballages)
${existing_recipes && existing_recipes.length > 0 ? '13. ' : '8. '}Fournis des instructions claires adaptées au niveau
${existing_recipes && existing_recipes.length > 0 ? '14. ' : '9. '}Explique dans "reasons" pourquoi chaque recette soutient l'objectif fitness
${existing_recipes && existing_recipes.length > 0 ? '15. ' : '10. '}Assure-toi que chaque recette soit NUTRITIONNELLEMENT DENSE et SATISFAISANTE
${existing_recipes && existing_recipes.length > 0 ? '16. ' : '11. '}Équilibre: protéines de qualité, glucides complexes, lipides sains dans chaque recette
${existing_recipes && existing_recipes.length > 0 ? '17. ' : '12. '}Crée des "GROSSES RECETTES" - repas complets et nutritifs pour soutenir l'entraînement

GESTION DES DONNÉES MANQUANTES:
- Si certaines préférences manquent, utilise des valeurs par défaut orientées fitness
- Privilégie la sécurité alimentaire (allergies) même avec des données incomplètes
- Adapte la complexité selon le niveau de cuisine (intermédiaire par défaut si non spécifié)
- Utilise l'équipement de base (four, plaques) si l'équipement n'est pas spécifié
- Optimise pour la performance et la récupération si l'objectif n'est pas spécifié

Réponds UNIQUEMENT avec un JSON valide contenant un tableau de recettes au format:
[
  {
    "title": "Nom de la recette orientée fitness",
    "description": "Description axée sur les bénéfices nutritionnels et fitness",
    "ingredients": [
      {"name": "Ingrédient", "quantity": "quantité", "unit": "unité"}
    ],
    "instructions": [
      "Étape 1 détaillée avec focus nutrition",
      "Étape 2 détaillée avec techniques optimales"
    ],
    "prep_time_min": 15,
    "cook_time_min": 30,
    "servings": 1,
    "dietary_tags": ["riche en protéines", "faible en glucides"],
    "nutritional_info": {
      "calories": 450,
      "protein": 35,
      "carbs": 25,
      "fat": 20,
      "fiber": 8
    },
    "image_signature": "signature pour génération d'image",
    "reasons": ["Soutient l'objectif de perte de graisse", "Riche en protéines pour la récupération musculaire"]
  }
]`;

    console.log('RECIPE_GENERATOR', 'Starting streaming OpenAI request', {
      user_id,
      prompt_length: recipePrompt.length,
      model: 'gpt-5-mini',
      timestamp: new Date().toISOString()
    });

    // Stream recipes from OpenAI with token consumption
    return streamRecipesFromOpenAI(recipePrompt, user_id, cacheKey, supabase, startTime, inventory_final, user_preferences, filters, consumeTokensAtomic);

  } catch (error: any) {
    console.error('RECIPE_GENERATOR', 'Error in recipe generation', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

// Stream recipes from OpenAI API with SSE
async function streamRecipesFromOpenAI(prompt: string, userId: string, cacheKey: string, supabase: any, startTime: number, inventory: any[], preferences: any, filters: any, consumeTokensFn: typeof consumeTokensAtomic) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const encoder = new TextEncoder();
  let totalTokens = { input: 0, output: 0 };
  let allRecipes: any[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial skeleton count event (include both keys for FE compatibility)
        const skeletonEvent = `event: skeleton\ndata: ${JSON.stringify({ recipe_count: 4, count: 4 })}\n\n`;
        controller.enqueue(encoder.encode(skeletonEvent));

        console.log('RECIPE_GENERATOR', 'Calling OpenAI streaming API', {
          user_id: userId,
          model: 'gpt-5-mini',
          timestamp: new Date().toISOString()
        });

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [{ role: 'user', content: prompt }],
            max_completion_tokens: 15000,
            stream: true
          })
        });

        if (!openaiResponse.ok) {
          throw new Error(`OpenAI API error: ${openaiResponse.status}`);
        }

        const reader = openaiResponse.body?.getReader();
        if (!reader) {
          throw new Error('No response body from OpenAI');
        }

        let buffer = '';
        let recipeCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                
                if (content) {
                  buffer += content;
                  
                  // Try to extract complete recipes from buffer using robust parsing (object-level, array-friendly)
                  let extractionResult = extractCompleteRecipes(buffer);
                  
                  // Process extracted recipes and update buffer
                  while (extractionResult.recipes.length > 0) {
                    for (const recipe of extractionResult.recipes) {
                      // Ensure ID exists (extractor already adds, but double-guard)
                      if (!recipe.id) recipe.id = crypto.randomUUID();
                      recipeCount++;
                      allRecipes.push(recipe);
                      
                      console.log('RECIPE_GENERATOR', 'Streaming recipe', {
                        user_id: userId,
                        recipe_number: recipeCount,
                        recipe_title: recipe.title,
                        recipe_id: recipe.id,
                        timestamp: new Date().toISOString()
                      });

                      // Send recipe event immediately
                      const recipeEvent = `event: recipe\ndata: ${JSON.stringify(recipe)}\n\n`;
                      controller.enqueue(encoder.encode(recipeEvent));
                    }
                    
                    // Update buffer with remaining content and attempt further extraction
                    buffer = extractionResult.remainingBuffer;
                    extractionResult = extractCompleteRecipes(buffer);
                  }
                }

                // Track token usage (if provided late in stream)
                if (parsed.usage) {
                  totalTokens.input = parsed.usage.prompt_tokens || 0;
                  totalTokens.output = parsed.usage.completion_tokens || 0;
                }
              } catch (parseError) {
                // Ignore parsing errors for partial chunks
                continue;
              }
            }
          }
        }

        // If no recipes were extracted via streaming, try to parse the entire buffer
        if (allRecipes.length === 0) {
          console.log('RECIPE_GENERATOR', 'No streaming recipes found, parsing full buffer', {
            user_id: userId,
            buffer_length: buffer.length,
            timestamp: new Date().toISOString()
          });

          const fallbackRecipes = parseRecipesFromBuffer(buffer);
          for (const recipe of fallbackRecipes) {
            if (recipe && recipe.title) {
              // Generate unique ID for fallback recipes
              recipe.id = crypto.randomUUID();
              recipeCount++;
              allRecipes.push(recipe);
              
              const recipeEvent = `event: recipe\ndata: ${JSON.stringify(recipe)}\n\n`;
              controller.enqueue(encoder.encode(recipeEvent));
            }
          }
        }

        // If still no recipes, use fitness fallback
        if (allRecipes.length === 0) {
          console.log('RECIPE_GENERATOR', 'Using fitness fallback recipes', {
            user_id: userId,
            timestamp: new Date().toISOString()
          });

          const fallbackRecipes = generateFitnessFallbackRecipes(inventory, preferences);
          for (const recipe of fallbackRecipes) {
            // Generate unique ID for fitness fallback recipes
            recipe.id = crypto.randomUUID();
            recipeCount++;
            allRecipes.push(recipe);
            
            const recipeEvent = `event: recipe\ndata: ${JSON.stringify(recipe)}\n\n`;
            controller.enqueue(encoder.encode(recipeEvent));
          }
        }

        // Calculate costs and send completion event
        const costUsd = (totalTokens.input * 0.25 / 1000000) + (totalTokens.output * 2.00 / 1000000);
        const processingTime = Date.now() - startTime;

        const completionData = {
          recipes_count: allRecipes.length,
          processing_time_ms: processingTime,
          cost_usd: costUsd,
          input_tokens: totalTokens.input,
          output_tokens: totalTokens.output,
          model_used: 'gpt-5-mini'
        } as Record<string, unknown>;

        const completionEvent = `event: complete\ndata: ${JSON.stringify(completionData)}\n\n`;
        controller.enqueue(encoder.encode(completionEvent));

        // Cache the complete result
        await supabase.from('ai_analysis_jobs').upsert({
          user_id: userId,
          analysis_type: 'recipe_generation',
          status: 'completed',
          input_hash: cacheKey,
          request_payload: {
            inventory_count: inventory.length,
            has_preferences: !!preferences,
            has_filters: !!filters,
            model_used: 'gpt-5-mini',
            input_tokens: totalTokens.input,
            output_tokens: totalTokens.output,
            fitness_focused: true
          },
          result_payload: {
            recipes: allRecipes,
            ...completionData
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Consume tokens after successful generation
        const requestId = crypto.randomUUID();
        const tokenResult = await consumeTokensFn(supabase, {
          userId: userId,
          edgeFunctionName: 'recipe-generator',
          operationType: 'recipe_generation',
          openaiModel: 'gpt-5-mini',
          openaiInputTokens: totalTokens.input,
          openaiOutputTokens: totalTokens.output,
          openaiCostUsd: costUsd,
          metadata: {
            recipes_count: allRecipes.length,
            processing_time_ms: processingTime,
            has_preferences: !!preferences,
            has_filters: !!filters
          }
        }, requestId);

        if (!tokenResult.success) {
          console.error('❌ [RECIPE_GENERATOR] Token consumption failed', {
            userId,
            error: tokenResult.error,
            requestId
          });
        }

        console.log('RECIPE_GENERATOR', 'Streaming completed', {
          user_id: userId,
          recipes_streamed: allRecipes.length,
          processing_time_ms: processingTime,
          cost_usd: costUsd,
          tokens_consumed: totalTokens.input + totalTokens.output,
          timestamp: new Date().toISOString()
        });

        controller.close();

      } catch (error: any) {
        console.error('RECIPE_GENERATOR', 'Streaming error', {
          user_id: userId,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        const errorEvent = `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

// Stream cached recipes one by one
function streamCachedRecipes(recipes: any[], startTime: number) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send skeleton count
        const skeletonEvent = `event: skeleton\ndata: ${JSON.stringify({ recipe_count: recipes.length, count: recipes.length })}\n\n`;
        controller.enqueue(encoder.encode(skeletonEvent));

        // Stream each cached recipe with a small delay
        for (let i = 0; i < recipes.length; i++) {
          const recipe = recipes[i];
          
          // Ensure cached recipes have IDs
          if (!recipe.id) {
            recipe.id = crypto.randomUUID();
          }
          
          // Add small delay to simulate streaming
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          const recipeEvent = `event: recipe\ndata: ${JSON.stringify(recipe)}\n\n`;
          controller.enqueue(encoder.encode(recipeEvent));
        }

        // Send completion event
        const completionData = {
          recipes_count: recipes.length,
          processing_time_ms: Date.now() - startTime,
          cost_usd: 0,
          input_tokens: 0,
          output_tokens: 0,
          model_used: 'cached',
          cache_hit: true
        };

        const completionEvent = `event: complete\ndata: ${JSON.stringify(completionData)}\n\n`;
        controller.enqueue(encoder.encode(completionEvent));

        controller.close();
      } catch (error: any) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

// ===================== STREAMING JSON PARSER (FIXED) =====================
// Extract complete recipe objects from a streaming buffer **incrementally**.
// Key fix: allow extraction of complete objects **inside a JSON array** without
// waiting for the closing `]`. The previous version wrongly required
// `braceCount === 0 && bracketCount === 0` and thus buffered until the whole
// array closed, making all recipes appear at once.
function extractCompleteRecipes(buffer: string): { recipes: any[]; remainingBuffer: string } {
  const out: any[] = [];
  if (!buffer) return { recipes: out, remainingBuffer: buffer };

  // Trim leading noise until we hit either '[' or '{'
  let startIdx = buffer.search(/[\[\{]/);
  if (startIdx > 0) buffer = buffer.slice(startIdx);
  if (startIdx === -1) return { recipes: out, remainingBuffer: buffer };

  // Stateful scan
  let i = 0;
  let inString = false;
  let escapeNext = false;
  let objDepth = 0;       // counts nesting of { }
  let objStart = -1;      // where current object started
  let arrayStarted = false; // whether we've seen the opening [ at top level

  const isWhitespace = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t';
  const isRecipeLike = (v: any) => v && typeof v === 'object' && !!v.title && Array.isArray(v.ingredients);

  while (i < buffer.length) {
    const ch = buffer[i];

    if (escapeNext) { escapeNext = false; i++; continue; }
    if (inString) {
      if (ch === '\\') { escapeNext = true; i++; continue; }
      if (ch === '"') { inString = false; i++; continue; }
      i++; continue;
    }

    if (ch === '"') { inString = true; i++; continue; }

    // Mark array start (top-level '[')
    if (!arrayStarted && objDepth === 0 && ch === '[') { arrayStarted = true; i++; continue; }

    if (ch === '{') {
      if (objDepth === 0) objStart = i; // first brace of a new object
      objDepth++;
      i++;
      continue;
    }

    if (ch === '}') {
      objDepth--;
      i++;

      if (objDepth === 0 && objStart !== -1) {
        // We have a full JSON object regardless of being inside an array.
        const jsonStr = buffer.slice(objStart, i);
        try {
          const parsed = JSON.parse(jsonStr);
          if (isRecipeLike(parsed)) {
            if (!parsed.id) parsed.id = crypto.randomUUID();
            out.push(parsed);

            // Consume trailing whitespace and optional comma after object, but
            // keep a possible closing ']' in buffer for later parses.
            let j = i;
            // whitespace
            while (j < buffer.length && isWhitespace(buffer[j])) j++;
            // optional comma if still inside array
            if (arrayStarted && buffer[j] === ',') {
              j++; // skip comma
              while (j < buffer.length && isWhitespace(buffer[j])) j++;
            }

            // Drop consumed prefix and restart scanning on the shrunken buffer
            buffer = buffer.slice(j);
            i = 0;
            objStart = -1;
            // continue to scan for more objects
            continue;
          }
        } catch (_e) {
          // not a valid object yet; keep reading
        }
      }
      continue;
    }

    // We don't actually need to count '[' and ']' for object extraction now,
    // since we parse objects independently. Just advance.
    i++;
  }

  return { recipes: out, remainingBuffer: buffer };
}

// Parse recipes from complete buffer (fallback)
function parseRecipesFromBuffer(buffer: string) {
  try {
    // Clean the response by removing markdown code blocks
    let cleanedResponse = buffer;
    if (cleanedResponse.includes('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    }
    if (cleanedResponse.includes('```')) {
      cleanedResponse = cleanedResponse.replace(/```/g, '');
    }

    // Find JSON array boundaries
    const startIndex = cleanedResponse.indexOf('[');
    const endIndex = cleanedResponse.lastIndexOf(']');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonString = cleanedResponse.substring(startIndex, endIndex + 1);
      const recipes = JSON.parse(jsonString);

      if (Array.isArray(recipes)) {
        return recipes.filter((recipe: any) => 
          recipe && 
          typeof recipe === 'object' && 
          recipe.title && 
          recipe.ingredients && 
          Array.isArray(recipe.ingredients)
        );
      }
    }
  } catch (error: any) {
    console.warn('Failed to parse recipes from buffer:', error.message);
  }
  
  return [] as any[];
}

// Helper function to generate cache key with fitness focus
async function generateCacheKey(inventory: any[], preferences: any, filters: any, userId: string, existingRecipes?: any[]) {
  const data = JSON.stringify({
    inventory: inventory?.map((item: any) => ({
      name: item.name,
      quantity: item.quantity
    })) || [],
    // FITNESS-FOCUSED preferences only
    fitness_preferences: {
      nutrition: preferences?.nutrition || {},
      macro_targets: preferences?.macro_targets || {},
      user_identity: preferences?.user_identity || {},
      meal_prep_preferences: preferences?.meal_prep_preferences || {},
      kitchen_equipment: preferences?.kitchen_equipment || {},
      food_preferences: preferences?.food_preferences || {},
      sensory_preferences: preferences?.sensory_preferences || {}
    },
    filters,
    userId,
    existing_recipes: existingRecipes || [],
    version: 'streaming_v3' // bump to invalidate old caches
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to calculate fitness-based calories
function calculateFitnessCalories(userIdentity: any) {
  if (!userIdentity.weight_kg) return 2000;
  
  const baseCalories = userIdentity.weight_kg * 24; // BMR approximation
  const activityMultiplier = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'athlete': 1.9
  }[userIdentity.activity_level] || 1.55;
  
  const maintenanceCalories = baseCalories * activityMultiplier;
  
  // Adjust based on objective
  switch (userIdentity.objective) {
    case 'fat_loss':
      return Math.round(maintenanceCalories * 0.8); // 20% deficit
    case 'muscle_gain':
      return Math.round(maintenanceCalories * 1.1); // 10% surplus
    case 'recomp':
      return Math.round(maintenanceCalories); // Maintenance
    default:
      return Math.round(maintenanceCalories);
  }
}

// Helper function to calculate fitness-based protein
function calculateFitnessProtein(userIdentity: any) {
  if (!userIdentity.weight_kg) return 120;
  
  const multiplier = {
    'fat_loss': 2.2, // High protein for muscle preservation
    'muscle_gain': 2.0, // High protein for muscle building
    'recomp': 2.4 // Very high protein for body recomposition
  }[userIdentity.objective] || 1.8;
  
  return Math.round(userIdentity.weight_kg * multiplier);
}

// Helper function to get objective description
function getObjectiveDescription(objective: string) {
  const descriptions: Record<string,string> = {
    'fat_loss': 'PERTE DE GRAISSE - Déficit calorique avec préservation musculaire',
    'muscle_gain': 'PRISE DE MUSCLE - Surplus calorique avec optimisation protéique',
    'recomp': 'RECOMPOSITION CORPORELLE - Équilibre précis pour perdre du gras et gagner du muscle'
  };
  return descriptions[objective] || 'MAINTENANCE - Équilibre nutritionnel optimal';
}

// Helper function to generate fitness-focused fallback recipes
function generateFitnessFallbackRecipes(inventory: any[], preferences: any) {
  const userIdentity = preferences?.user_identity || {};
  const objective = userIdentity.objective || 'recomp';
  const availableIngredients = inventory.map((item: any) => item.name.toLowerCase());
  
  const fitnessRecipes: any[] = [];
  
  if (availableIngredients.some((ing: string) => /poulet|thon|œuf|fromage|yaourt/.test(ing))) {
    fitnessRecipes.push({
      title: "Bowl Protéiné Post-Entraînement",
      description: "Recette riche en protéines pour optimiser la récupération musculaire et soutenir vos objectifs fitness",
      ingredients: [
        { name: "Protéine disponible", quantity: "150", unit: "g" },
        { name: "Légumes colorés", quantity: "200", unit: "g" },
        { name: "Glucides complexes", quantity: "80", unit: "g" },
        { name: "Huile d'olive", quantity: "1", unit: "cuillère à soupe" }
      ],
      instructions: [
        "Préparez la source de protéines (grillée, pochée ou cuite selon préférence)",
        "Cuisez les légumes à la vapeur ou sautés pour préserver les nutriments",
        "Préparez les glucides complexes (riz, quinoa, patate douce)",
        "Assemblez dans un bowl en respectant les proportions macro",
        "Assaisonnez avec l'huile d'olive et épices au goût"
      ],
      prep_time_min: 15,
      cook_time_min: 20,
      servings: 1,
      dietary_tags: ["riche en protéines", "post-entraînement", "équilibré"],
      nutritional_info: {
        calories: objective === 'fat_loss' ? 380 : objective === 'muscle_gain' ? 520 : 450,
        protein: 35,
        carbs: objective === 'fat_loss' ? 25 : 40,
        fat: objective === 'fat_loss' ? 12 : 18,
        fiber: 8
      },
      image_signature: "high protein fitness bowl post workout",
      reasons: [
        `Optimisé pour votre objectif: ${getObjectiveDescription(objective)}`,
        "Ratio protéines/glucides idéal pour la récupération",
        "Utilise vos ingrédients disponibles de manière optimale"
      ]
    });
  }
  
  if (objective === 'fat_loss' && availableIngredients.some((ing: string) => /légume|salade|épinard/.test(ing))) {
    fitnessRecipes.push({
      title: "Salade Brûle-Graisse Haute Satiété",
      description: "Recette faible en glucides, riche en fibres et protéines pour maximiser la satiété en déficit calorique",
      ingredients: [
        { name: "Légumes verts", quantity: "300", unit: "g" },
        { name: "Protéine maigre", quantity: "120", unit: "g" },
        { name: "Avocat", quantity: "50", unit: "g" },
        { name: "Graines", quantity: "15", unit: "g" }
      ],
      instructions: [
        "Lavez et préparez une base généreuse de légumes verts",
        "Ajoutez la protéine maigre (poulet, thon, tofu selon disponibilité)",
        "Incorporez l'avocat pour les lipides sains et la satiété",
        "Parsemez de graines pour les micronutriments",
        "Assaisonnez avec vinaigre et épices (évitez les sauces caloriques)"
      ],
      prep_time_min: 10,
      cook_time_min: 5,
      servings: 1,
      dietary_tags: ["faible en glucides", "brûle-graisse", "haute satiété"],
      nutritional_info: {
        calories: 320,
        protein: 28,
        carbs: 12,
        fat: 18,
        fiber: 12
      },
      image_signature: "low carb high protein salad fat loss",
      reasons: [
        "Parfait pour la perte de graisse avec déficit calorique contrôlé",
        "Haute teneur en fibres pour la satiété",
        "Protéines complètes pour préserver la masse musculaire"
      ]
    });
  }
  
  if (objective === 'muscle_gain') {
    fitnessRecipes.push({
      title: "Power Bowl Prise de Masse",
      description: "Recette dense en calories et protéines pour soutenir la croissance musculaire",
      ingredients: [
        { name: "Protéine complète", quantity: "180", unit: "g" },
        { name: "Glucides complexes", quantity: "120", unit: "g" },
        { name: "Légumes nutritifs", quantity: "150", unit: "g" },
        { name: "Lipides sains", quantity: "30", unit: "g" }
      ],
      instructions: [
        "Préparez une portion généreuse de protéines (viande, poisson, légumineuses)",
        "Cuisez les glucides complexes (riz, pâtes complètes, quinoa)",
        "Ajoutez des légumes colorés pour les micronutriments",
        "Incorporez des lipides de qualité (huile d'olive, avocat, noix)",
        "Assemblez en respectant les ratios pour la prise de masse"
      ],
      prep_time_min: 20,
      cook_time_min: 25,
      servings: 1,
      dietary_tags: ["prise de masse", "riche en calories", "complet"],
      nutritional_info: {
        calories: 650,
        protein: 40,
        carbs: 55,
        fat: 25,
        fiber: 8
      },
      image_signature: "high calorie muscle building power bowl",
      reasons: [
        "Surplus calorique contrôlé pour la prise de masse",
        "Protéines élevées pour la synthèse musculaire",
        "Glucides complexes pour l'énergie d'entraînement"
      ]
    });
  }

  if (fitnessRecipes.length === 0) {
    fitnessRecipes.push({
      title: "Repas Équilibré Fitness",
      description: "Recette équilibrée adaptée à vos objectifs de composition corporelle",
      ingredients: [
        { name: "Protéine de qualité", quantity: "150", unit: "g" },
        { name: "Légumes de saison", quantity: "200", unit: "g" },
        { name: "Glucides adaptés", quantity: "100", unit: "g" },
        { name: "Lipides essentiels", quantity: "15", unit: "g" }
      ],
      instructions: [
        "Sélectionnez une protéine de qualité parmi vos ingrédients",
        "Préparez les légumes en préservant leurs nutriments",
        "Ajoutez des glucides selon votre objectif (plus pour prise de masse, moins pour sèche)",
        "Incorporez des lipides essentiels pour l'absorption des vitamines",
        "Équilibrez les portions selon vos besoins caloriques"
      ],
      prep_time_min: 15,
      cook_time_min: 20,
      servings: 1,
      dietary_tags: ["équilibré", "fitness", "adaptable"],
      nutritional_info: {
        calories: objective === 'fat_loss' ? 400 : objective === 'muscle_gain' ? 550 : 475,
        protein: 30,
        carbs: objective === 'fat_loss' ? 30 : 45,
        fat: objective === 'fat_loss' ? 15 : 20,
        fiber: 8
      },
      image_signature: "balanced fitness meal",
      reasons: [
        `Adapté à votre objectif: ${getObjectiveDescription(objective)}`,
        "Utilise efficacement vos ingrédients disponibles",
        "Équilibre optimal pour la performance et la récupération"
      ]
    });
  }

  return fitnessRecipes;
}
