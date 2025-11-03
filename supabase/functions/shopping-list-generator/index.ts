import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts'

// Simple logger for edge functions
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  debug: (message: string, data?: any) => {
    console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  }
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RequestPayload {
  user_id: string
  meal_plan_id: string
  generation_mode: 'user_only' | 'user_and_family'
}

interface ShoppingListResponse {
  shopping_list: Array<{
    category: string
    items: Array<{
      name: string
      quantity: string
      notes?: string
    }>
  }>
  suggestions: Array<{
    name: string
    reason: string
    category: string
  }>
  advice: string[]
  budget_estimation: {
    estimated_cost: string
    confidence_level: string
    currency: string
    notes: string[]
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { user_id, meal_plan_id, generation_mode }: RequestPayload = await req.json()
    
    logger.info('Shopping list generation started', {
      user_id,
      meal_plan_id,
      generation_mode
    });

    console.log('Shopping list generation request:', { user_id, meal_plan_id, generation_mode })

    // Generate input hash for caching
    const inputData = { user_id, meal_plan_id, generation_mode }
    const inputHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(inputData))
    ).then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''))
    
    logger.debug('Generated input hash', { hashHex: inputHash });

    // Check for existing cached result
    const { data: existingJob } = await supabase
      .from('ai_analysis_jobs')
      .select('result_payload')
      .eq('input_hash', inputHash)
      .eq('analysis_type', 'shopping_list_generation')
      .eq('status', 'completed')
      .single()

    if (existingJob?.result_payload) {
      logger.info('Found cached result');
      console.log('Returning cached shopping list result')
      return new Response(JSON.stringify(existingJob.result_payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check token balance before OpenAI call (estimate ~15 tokens)
    const estimatedTokens = 15
    const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokens)

    if (!tokenCheck.hasEnoughTokens) {
      logger.info('Insufficient tokens', {
        user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokens
      })

      return createInsufficientTokensResponse(
        tokenCheck.currentBalance,
        estimatedTokens,
        !tokenCheck.isSubscribed,
        corsHeaders
      )
    }

    // Create new AI analysis job
    const { data: jobData } = await supabase
      .from('ai_analysis_jobs')
      .insert({
        user_id,
        analysis_type: 'shopping_list_generation',
        request_payload: inputData,
        input_hash: inputHash,
        status: 'processing'
      })
      .select('id')
      .single()

    const jobId = jobData?.id
    
    logger.debug('Created AI analysis job', { job_id: jobId });

    try {
      // Fetch user profile
      logger.debug('Fetching user profile', { user_id });
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profile')
        .select('*')
        .eq('user_id', user_id)
        .single()

      if (profileError) {
        logger.error('Error fetching user profile', {
          error: profileError,
          user_id
        });
        throw new Error(`Failed to fetch user profile: ${profileError.message}`)
      }

      if (!userProfile) {
        logger.error('User profile not found', { user_id });
        throw new Error('User profile not found')
      }

      // Fetch meal plan
      logger.debug('Fetching meal plan', { meal_plan_id, user_id });
      const { data: mealPlan, error: mealPlanError } = await supabase
        .from('meal_plans')
        .select('plan_data')
        .eq('id', meal_plan_id)
        .eq('user_id', user_id)
        .single()

      if (mealPlanError) {
        logger.error('Error fetching meal plan', {
          error: mealPlanError,
          meal_plan_id,
          user_id
        });
        throw new Error(`Failed to fetch meal plan: ${mealPlanError.message}`)
      }

      if (!mealPlan) {
        logger.error('Meal plan not found', { meal_plan_id, user_id });
        throw new Error('Meal plan not found')
      }

      if (!mealPlan.plan_data) {
        logger.error('Meal plan has no plan_data', { meal_plan_id });
        throw new Error('Meal plan data is empty')
      }

      logger.debug('Fetched user profile and meal plan', {
        hasProfile: !!userProfile,
        hasMealPlan: !!mealPlan,
        mealPlanDays: mealPlan.plan_data?.days?.length || 0,
        country: userProfile.country,
        generationMode: generation_mode
      });

      console.log('SHOPPING_LIST_GENERATOR Fetched user profile and meal plan successfully', {
        userId: user_id,
        mealPlanId: meal_plan_id,
        mealPlanDaysCount: mealPlan.plan_data?.days?.length || 0
      });

      // Construct GPT-5-mini prompt
      const prompt = buildShoppingListPrompt(userProfile, mealPlan.plan_data, generation_mode)

      logger.debug('Constructed GPT-5-mini prompt', {
        prompt_length: prompt.length,
        meal_plan_days: mealPlan.plan_data?.days?.length || 0
      });

      logger.info('Calling OpenAI GPT-5-mini API', {
        model: 'gpt-5-mini',
        prompt_length: prompt.length,
        has_system_message: true,
        max_completion_tokens: 15000
      });

      console.log('SHOPPING_LIST_GENERATOR Calling OpenAI GPT-5-mini API...', {
        prompt_length: prompt.length,
        model: 'gpt-5-mini'
      });

      // Call OpenAI API with GPT-5-mini
      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert en nutrition et en planification de repas. Tu aides les utilisateurs à créer des listes de courses personnalisées et optimisées. Tu dois TOUJOURS générer des listes complètes et détaillées avec un minimum de 30-50 articles uniques, même si le plan de repas semble simple. Chaque catégorie doit contenir 8-12 articles minimum.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_completion_tokens: 15000
        }),
      })

      console.log('SHOPPING_LIST_GENERATOR OpenAI response status:', openAIResponse.status);

      if (!openAIResponse.ok) {
        const errorBody = await openAIResponse.text();
        logger.error('OpenAI API call failed', {
          status: openAIResponse.status,
          statusText: openAIResponse.statusText,
          errorBody: errorBody
        });
        console.error('SHOPPING_LIST_GENERATOR OpenAI API error details:', {
          status: openAIResponse.status,
          statusText: openAIResponse.statusText,
          body: errorBody
        });
        throw new Error(`OpenAI API error: ${openAIResponse.status}\nDetails: ${errorBody}`)
      }

      const openAIResult = await openAIResponse.json()

      // Calculate token usage and cost
      const tokenUsage = {
        input: openAIResult.usage?.prompt_tokens || 0,
        output: openAIResult.usage?.completion_tokens || 0,
        costUsd: ((openAIResult.usage?.prompt_tokens || 0) * 0.25 / 1000000) + ((openAIResult.usage?.completion_tokens || 0) * 2.00 / 1000000)
      }

      console.log('SHOPPING_LIST_GENERATOR GPT-5-mini response received:', {
        hasChoices: !!openAIResult.choices,
        choicesLength: openAIResult.choices?.length,
        usage: openAIResult.usage,
        model: 'gpt-5-mini'
      });

      logger.debug('GPT-5-mini API response received', {
        usage: openAIResult.usage,
        model: 'gpt-5-mini',
        hasChoices: !!openAIResult.choices,
        choicesCount: openAIResult.choices?.length
      });

      const aiContent = openAIResult.choices[0]?.message?.content

      if (!aiContent) {
        logger.error('No content received from OpenAI', {
          openAIResult: JSON.stringify(openAIResult)
        });
        throw new Error('No content received from OpenAI')
      }

      console.log('SHOPPING_LIST_GENERATOR OpenAI response received, parsing...', {
        contentLength: aiContent.length
      })

      // Parse AI response
      const parsedResponse = parseAIResponse(aiContent, userProfile.country || 'France')

      logger.info('AI response parsed successfully', {
        shopping_list_categories: parsedResponse.shopping_list?.length || 0,
        total_items: parsedResponse.shopping_list?.reduce((total, cat) => total + (cat.items?.length || 0), 0) || 0,
        suggestions_count: parsedResponse.suggestions?.length || 0,
        advice_count: parsedResponse.advice?.length || 0
      });

      // Consume tokens after successful generation
      const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
        userId: user_id,
        edgeFunctionName: 'shopping-list-generator',
        operationType: 'shopping_list_generation',
        openaiModel: 'gpt-5-mini',
        openaiInputTokens: tokenUsage.input,
        openaiOutputTokens: tokenUsage.output,
        openaiCostUsd: tokenUsage.costUsd,
        metadata: {
          meal_plan_id,
          generation_mode,
          items_count: parsedResponse.shopping_list?.reduce((total, cat) => total + (cat.items?.length || 0), 0) || 0,
          categories_count: parsedResponse.shopping_list?.length || 0
        }
      })

      // Update job with successful result
      await supabase
        .from('ai_analysis_jobs')
        .update({
          status: 'completed',
          result_payload: parsedResponse,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        
      logger.info('Shopping list generation completed successfully');

      console.log('Shopping list generated successfully')

      return new Response(JSON.stringify(parsedResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      console.error('Error in shopping list generation:', error)

      // Update job with error status
      if (jobId) {
        await supabase
          .from('ai_analysis_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId)
      }

      throw error
    }

  } catch (error) {
    logger.error('Shopping list generation failed', error);
    console.error('Shopping list generation error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildShoppingListPrompt(userProfile: any, mealPlan: any, generationMode: string): string {
  const isFamily = generationMode === 'user_and_family'
  const country = userProfile.country || 'France'
  
  return `
Génère une liste de courses COMPLÈTE et DÉTAILLÉE basée sur les informations suivantes :

**PROFIL UTILISATEUR :**
- Pays : ${country}
- Sexe : ${userProfile.sex || 'Non spécifié'}
- Âge : ${userProfile.birthdate ? calculateAge(userProfile.birthdate) : 'Non spécifié'} ans
- Taille : ${userProfile.height_cm || 'Non spécifié'} cm
- Poids : ${userProfile.weight_kg || 'Non spécifié'} kg
- Objectif : ${userProfile.objective || 'Non spécifié'}
- Niveau d'activité : ${userProfile.activity_level || 'Non spécifié'}
- Préférences alimentaires : ${JSON.stringify(userProfile.food_preferences || {})}
- Restrictions alimentaires : ${JSON.stringify(userProfile.constraints || {})}
- Équipement cuisine : ${JSON.stringify(userProfile.kitchen_equipment || {})}
- Détails foyer : ${JSON.stringify(userProfile.household_details || {})}

**PLAN DE REPAS :**
${JSON.stringify(mealPlan, null, 2)}

**MODE DE GÉNÉRATION :** ${isFamily ? 'Liste familiale (2-4 personnes)' : 'Liste personnelle (1 personne)'}

**INSTRUCTIONS CRITIQUES :**
1. ANALYSE CHAQUE REPAS du plan alimentaire et LISTE TOUS LES INGRÉDIENTS nécessaires
2. INCLUS les quantités précises pour ${isFamily ? '2-4 personnes' : '1 personne'}
3. AJOUTE les ingrédients de base manquants (huile, sel, poivre, épices courantes, etc.)
4. CATÉGORISE intelligemment (Fruits & Légumes, Viandes & Poissons, Produits laitiers, Épicerie, etc.)
5. GÉNÈRE une liste substantielle (minimum 30-50 articles uniques pour une semaine complète)
6. CHAQUE CATÉGORIE doit contenir 8-12 articles minimum
7. ADAPTE les quantités selon le mode familial ou personnel
8. CONSIDÈRE les besoins nutritionnels et les objectifs de l'utilisateur
9. INCLUS des articles complémentaires logiques (condiments, assaisonnements, etc.)

**CONSEILS PERSONNALISÉS REQUIS :**
- Fournis 3-5 conseils détaillés et actionnables basés sur le profil utilisateur
- Adapte les conseils selon l'objectif (perte de poids, prise de muscle, etc.)
- Inclus des astuces d'économie et d'organisation
- Personnalise selon les préférences et restrictions alimentaires

**ESTIMATION BUDGÉTAIRE OBLIGATOIRE :**
- Fournis une estimation précise en euros
- Indique le niveau de confiance (Élevé/Moyen/Faible)
- Ajoute des notes sur les variations de prix possibles
- Considère les prix moyens du pays (${country})

**EXEMPLE DE STRUCTURE ATTENDUE :**
- Fruits & Légumes : 8-12 articles
- Viandes & Poissons : 4-6 articles  
- Produits laitiers : 3-5 articles
- Épicerie : 6-10 articles
- Boulangerie : 2-3 articles
- Surgelés : 2-4 articles

**FORMAT DE RÉPONSE REQUIS (JSON strict) :**
{
  "shopping_list": [
    {
      "category": "Fruits & Légumes",
      "items": [
        {
          "name": "Tomates cerises",
          "quantity": "500g",
          "notes": "Pour les salades"
        },
        {
          "name": "Courgettes",
          "quantity": "3 pièces",
          "notes": "Pour les gratins"
        }
      ]
    },
    {
      "category": "Viandes & Poissons",
      "items": [
        {
          "name": "Blanc de poulet",
          "quantity": "600g",
          "notes": "Pour 3 repas"
        }
      ]
    }
  ],
  "suggestions": [
    {
      "name": "Huile d'olive extra vierge",
      "reason": "Indispensable pour la cuisson et les assaisonnements",
      "category": "Épicerie"
    }
  ],
  "advice": [
    "Privilégiez les produits de saison pour un meilleur goût et prix",
    "Vérifiez vos placards avant de partir pour éviter les doublons",
    "Planifiez vos courses selon vos objectifs nutritionnels"
  ],
  "budget_estimation": {
    "estimated_cost": "45-65€",
    "confidence_level": "Élevé",
    "currency": "EUR",
    "notes": ["Prix basés sur les moyennes ${country}", "Possibilité d'économies avec les promotions"]
  }
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire. La liste doit être COMPLÈTE et DÉTAILLÉE, pas minimaliste.
`
}

function calculateAge(birthdate: string): number {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

function parseAIResponse(aiContent: string, country: string): ShoppingListResponse {
  logger.debug('Raw AI response content', { 
    content_length: aiContent.length,
    content_preview: aiContent.substring(0, 500) + '...'
  });

  try {
    // Clean the response to extract JSON
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      logger.error('No JSON found in AI response', { aiContent });
      throw new Error('No JSON found in AI response')
    }
    
    const parsedResponse = JSON.parse(jsonMatch[0])
    
    // Validate shopping_list structure
    if (!Array.isArray(parsedResponse.shopping_list)) {
      logger.error('shopping_list is not an array', { shopping_list: parsedResponse.shopping_list });
      parsedResponse.shopping_list = [];
    }
    
    // Validate each category has items array
    parsedResponse.shopping_list.forEach((category: any, index: number) => {
      if (!category.category) {
        logger.warn(`Category ${index} missing name`, { category });
        category.category = `Catégorie ${index + 1}`;
      }
      if (!Array.isArray(category.items)) {
        logger.warn(`Category ${category.category} items is not an array`, { items: category.items });
        category.items = [];
      }
    });
    
    logger.debug('Parsed AI response structure', {
      shopping_list_categories: parsedResponse.shopping_list?.length || 0,
      categories_details: parsedResponse.shopping_list?.map((cat: any) => ({
        category: cat.category,
        items_count: cat.items?.length || 0
      })) || [],
      suggestions_count: parsedResponse.suggestions?.length || 0,
      advice_count: parsedResponse.advice?.length || 0,
      has_budget: !!parsedResponse.budget_estimation
    });

    // Validate and ensure required structure
    const result = {
      shopping_list: parsedResponse.shopping_list || [],
      suggestions: parsedResponse.suggestions || [],
      advice: parsedResponse.advice || [],
      budget_estimation: {
        estimated_cost: parsedResponse.budget_estimation?.estimated_cost || 'Non estimé',
        confidence_level: parsedResponse.budget_estimation?.confidence_level || 'Faible',
        currency: parsedResponse.budget_estimation?.currency || 'EUR',
        notes: parsedResponse.budget_estimation?.notes || []
      }
    };

    logger.info('Final parsed response ready', {
      total_categories: result.shopping_list.length,
      total_items: result.shopping_list.reduce((total, cat) => total + (cat.items?.length || 0), 0),
      suggestions: result.suggestions.length,
      advice: result.advice.length
    });

    return result;
  } catch (error) {
    logger.error('Error parsing AI response', { error: error.message, aiContent });
    console.error('Error parsing AI response:', error)
    
    // Return fallback structure
    return {
      shopping_list: [
        {
          category: 'Articles généraux',
          items: [
            {
              name: 'Liste générée avec succès',
              quantity: '1',
              notes: 'Erreur de parsing, veuillez réessayer'
            }
          ]
        }
      ],
      suggestions: [],
      advice: ['Une erreur est survenue lors de la génération. Veuillez réessayer.'],
      budget_estimation: {
        estimated_cost: 'Non disponible',
        confidence_level: 'Faible',
        currency: 'EUR',
        notes: ['Erreur de parsing des données']
      }
    }
  }
}