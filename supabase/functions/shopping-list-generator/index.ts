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
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { user_id, meal_plan_id, generation_mode }: RequestPayload = await req.json()

    logger.info('Shopping list generation started', {
      user_id,
      meal_plan_id,
      generation_mode
    });

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
      return new Response(JSON.stringify(existingJob.result_payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check token balance before OpenAI call
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
        max_completion_tokens: 8000
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
              content: 'Tu es un expert en nutrition et en planification de repas. Tu aides les utilisateurs à créer des listes de courses personnalisées et optimisées.\n\nRÈGLES ABSOLUES JSON:\n1. Réponds UNIQUEMENT avec du JSON valide et bien formé\n2. N\'ajoute AUCUN texte avant ou après le JSON\n3. Utilise UNIQUEMENT des caractères ASCII standard (a-z, A-Z, 0-9, et ponctuation de base)\n4. REMPLACE tous les accents: é→e, è→e, ê→e, à→a, ù→u, ô→o, ç→c, œ→oe\n5. N\'utilise QUE des apostrophes simples \' (pas \' ou \')\n6. N\'utilise QUE des tirets simples - (pas — ou –)\n7. N\'utilise QUE des guillemets doubles " standard (pas " ou ")\n8. Vérifie que TOUS les objets et tableaux sont correctement fermés\n9. PAS de virgules après le dernier élément d\'un tableau ou objet\n10. Maximum 30 articles au total pour garantir un JSON compact et valide\n\nSTRUCTURE REQUISE:\n- 4-6 catégories maximum\n- 5-8 articles par catégorie\n- Total: environ 25-35 articles\n\nCARACTÈRES INTERDITS:\nœ, é, è, ê, à, ù, ô, ç, —, –, \', \', ", "\n\nFormat JSON strict à suivre:\n{\n  "shopping_list": [\n    {\n      "category": "Nom categorie",\n      "items": [\n        {"name": "Item", "quantity": "1kg", "notes": "Note"}\n      ]\n    }\n  ],\n  "suggestions": [],\n  "advice": [],\n  "budget_estimation": {\n    "estimated_cost": "40-60 EUR",\n    "confidence_level": "Moyen",\n    "currency": "EUR",\n    "notes": []\n  }\n}'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_completion_tokens: 8000
        }),
      })

      if (!openAIResponse.ok) {
        const errorBody = await openAIResponse.text();
        logger.error('OpenAI API call failed', {
          status: openAIResponse.status,
          statusText: openAIResponse.statusText,
          errorBody: errorBody
        });
        throw new Error(`OpenAI API error: ${openAIResponse.status}\nDetails: ${errorBody}`)
      }

      const openAIResult = await openAIResponse.json()

      logger.info('[OPENAI_RESPONSE] Received response from OpenAI', {
        status: openAIResponse.status,
        hasChoices: !!openAIResult.choices,
        choicesCount: openAIResult.choices?.length || 0,
        hasUsage: !!openAIResult.usage
      });

      // Calculate token usage and cost
      const tokenUsage = {
        input: openAIResult.usage?.prompt_tokens || 0,
        output: openAIResult.usage?.completion_tokens || 0,
        costUsd: ((openAIResult.usage?.prompt_tokens || 0) * 0.25 / 1000000) + ((openAIResult.usage?.completion_tokens || 0) * 2.00 / 1000000)
      }

      logger.debug('[OPENAI_TOKENS] Token usage', {
        input_tokens: tokenUsage.input,
        output_tokens: tokenUsage.output,
        total_tokens: tokenUsage.input + tokenUsage.output,
        cost_usd: tokenUsage.costUsd
      });

      const aiContent = openAIResult.choices[0]?.message?.content

      if (!aiContent) {
        logger.error('[OPENAI_ERROR] No content received from OpenAI', {
          openAIResult: JSON.stringify(openAIResult)
        });
        throw new Error('No content received from OpenAI')
      }

      logger.info('[OPENAI_CONTENT] Received AI content', {
        contentLength: aiContent.length,
        contentPreview: aiContent.substring(0, 300) + '...'
      });

      // Parse AI response
      logger.info('[PARSING_START] Starting to parse AI response');
      const parsedResponse = parseAIResponse(aiContent, userProfile.country || 'France');
      logger.info('[PARSING_COMPLETE] AI response parsed');

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

      return new Response(JSON.stringify(parsedResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      console.error('Error in shopping list generation:', error)

      // Update job with error status
      if (jobId) {
        try {
          await supabase
            .from('ai_analysis_jobs')
            .update({
              status: 'failed',
              error_message: error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId)
        } catch (dbError) {
          console.error('Failed to update job status:', dbError)
        }
      }

      // Return error response with CORS headers instead of throwing
      return new Response(JSON.stringify({
        error: error.message,
        details: 'Error during shopping list generation'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    logger.error('Shopping list generation failed', error);
    console.error('Shopping list generation error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error',
      details: 'Error in request processing'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildShoppingListPrompt(userProfile: any, mealPlan: any, generationMode: string): string {
  const isFamily = generationMode === 'user_and_family'
  const country = userProfile.country || 'France'

  // Extract only essential meal data to reduce prompt size
  const simplifiedMeals = mealPlan.days?.map((day: any) => ({
    day: day.day_number,
    meals: [
      day.breakfast?.name,
      day.lunch?.name,
      day.dinner?.name
    ].filter(Boolean)
  })) || [];

  return `
Genere une liste de courses pour ${isFamily ? '2-4 personnes' : '1 personne'} en ${country}.

REPAS:
${JSON.stringify(simplifiedMeals)}

RESTRICTIONS:
${userProfile.constraints?.allergies?.join(', ') || 'Aucune'}

INSTRUCTIONS:
1. Liste les ingredients de TOUS les repas
2. Quantites pour ${isFamily ? '2-4 pers' : '1 pers'}
3. 25-35 articles total
4. Budget realiste pour ${country}
5. JSON valide uniquement, AUCUN accent ni caractere special

Reponds uniquement avec le JSON.
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

/**
 * Parse budget string like "60-85 EUR" or "45-65€" to extract min/max
 */
function parseBudgetString(budgetStr: string): { minCents: number; maxCents: number; avgCents: number } {
  const defaultResult = { minCents: 0, maxCents: 0, avgCents: 0 };

  if (!budgetStr || budgetStr === 'Non estimé') {
    return defaultResult;
  }

  try {
    // Remove currency symbols and trim
    const cleaned = budgetStr.replace(/EUR|€|\$/gi, '').trim();

    // Match patterns like "60-85" or "45-65"
    const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);

    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      const avg = (min + max) / 2;

      // Convert to cents (multiply by 100)
      return {
        minCents: Math.round(min * 100),
        maxCents: Math.round(max * 100),
        avgCents: Math.round(avg * 100)
      };
    }

    // If no range, try to match a single number
    const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (singleMatch) {
      const value = parseFloat(singleMatch[1]);
      const cents = Math.round(value * 100);
      return { minCents: cents, maxCents: cents, avgCents: cents };
    }

    return defaultResult;
  } catch (error) {
    logger.error('[PARSE_BUDGET_ERROR] Failed to parse budget string', {
      budgetStr,
      error: error.message
    });
    return defaultResult;
  }
}

/**
 * Comprehensive JSON sanitization to fix common AI-generated JSON issues
 */
function sanitizeJSON(jsonString: string): string {
  try {
    // Step 1: Replace problematic Unicode characters
    jsonString = jsonString
      .replace(/\u2013/g, '-')      // en-dash
      .replace(/\u2014/g, '-')      // em-dash
      .replace(/\u2018/g, "'")      // left single quote
      .replace(/\u2019/g, "'")      // right single quote
      .replace(/\u201C/g, '"')      // left double quote
      .replace(/\u201D/g, '"')      // right double quote
      .replace(/\u0153/g, 'oe')     // œ ligature
      .replace(/\u00E9/g, 'e')      // é
      .replace(/\u00E8/g, 'e')      // è
      .replace(/\u00EA/g, 'e')      // ê
      .replace(/\u00E0/g, 'a')      // à
      .replace(/\u00F9/g, 'u')      // ù
      .replace(/\u00FB/g, 'u')      // û
      .replace(/\u00EE/g, 'i')      // î
      .replace(/\u00EF/g, 'i')      // ï
      .replace(/\u00F4/g, 'o')      // ô
      .replace(/\u00E7/g, 'c');     // ç

    // Step 2: Remove control characters except whitespace
    jsonString = jsonString.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, ' ');

    // Step 3: Fix trailing commas before closing brackets/braces
    jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');

    // Step 4: Ensure proper string escaping
    jsonString = jsonString.replace(/([^\\])\n/g, '$1\\n');
    jsonString = jsonString.replace(/([^\\])\r/g, '$1\\r');
    jsonString = jsonString.replace(/([^\\])\t/g, '$1\\t');

    return jsonString;
  } catch (err) {
    logger.error('[SANITIZE_ERROR] Error during JSON sanitization', { error: err.message });
    return jsonString;
  }
}

/**
 * Attempt to repair truncated JSON by completing missing closing brackets
 */
function attemptJSONRepair(jsonString: string): string {
  try {
    // Count opening and closing braces/brackets
    const openBraces = (jsonString.match(/\{/g) || []).length;
    const closeBraces = (jsonString.match(/\}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/\]/g) || []).length;

    logger.debug('[JSON_REPAIR] Analyzing JSON structure', {
      openBraces,
      closeBraces,
      openBrackets,
      closeBrackets
    });

    let repaired = jsonString;

    // Add missing closing brackets
    for (let i = 0; i < (openBrackets - closeBrackets); i++) {
      repaired += ']';
    }

    // Add missing closing braces
    for (let i = 0; i < (openBraces - closeBraces); i++) {
      repaired += '}';
    }

    if (repaired !== jsonString) {
      logger.info('[JSON_REPAIR] JSON repaired', {
        addedBrackets: openBrackets - closeBrackets,
        addedBraces: openBraces - closeBraces
      });
    }

    return repaired;
  } catch (err) {
    logger.error('[JSON_REPAIR_ERROR] Error during JSON repair', { error: err.message });
    return jsonString;
  }
}

function parseAIResponse(aiContent: string, country: string): ShoppingListResponse {
  logger.debug('[PARSE_START] Starting to parse AI response', {
    content_length: aiContent.length,
    content_preview: aiContent.substring(0, 500) + '...',
    content_last_500: aiContent.substring(Math.max(0, aiContent.length - 500))
  });

  try {
    // Step 1: Extract JSON from markdown code blocks or plain text
    let jsonString = aiContent.trim();

    // Remove markdown code blocks if present
    if (jsonString.startsWith('```')) {
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1].trim();
        logger.debug('[PARSE_MARKDOWN] Extracted JSON from markdown code block');
      }
    }

    // Extract first complete JSON object
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('[PARSE_ERROR] No JSON found in AI response', {
        aiContentLength: aiContent.length,
        firstChars: aiContent.substring(0, 200)
      });
      throw new Error('No JSON found in AI response');
    }

    jsonString = jsonMatch[0];

    logger.debug('[PARSE_JSON_MATCH] JSON pattern found', {
      matchLength: jsonString.length,
      matchPreview: jsonString.substring(0, 500) + '...'
    });

    // Step 2: Sanitize the JSON string
    jsonString = sanitizeJSON(jsonString);

    // Step 3: Attempt initial parse
    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(jsonString);
      logger.info('[PARSE_SUCCESS] JSON parsed successfully on first attempt');
    } catch (firstError) {
      logger.warn('[PARSE_RETRY] First parse failed, attempting repair', {
        error: firstError.message
      });

      // Step 4: Try to repair truncated JSON
      const repairedJSON = attemptJSONRepair(jsonString);

      try {
        parsedResponse = JSON.parse(repairedJSON);
        logger.info('[PARSE_SUCCESS] JSON parsed successfully after repair');
      } catch (secondError) {
        logger.error('[PARSE_ERROR] JSON parsing failed even after repair', {
          originalError: firstError.message,
          repairError: secondError.message,
          jsonLength: repairedJSON.length,
          jsonPreview: repairedJSON.substring(0, 300),
          jsonEnd: repairedJSON.substring(Math.max(0, repairedJSON.length - 300))
        });
        throw secondError;
      }
    }

    logger.info('[PARSE_SUCCESS] JSON parsed successfully', {
      hasShoppingList: !!parsedResponse.shopping_list,
      shoppingListLength: Array.isArray(parsedResponse.shopping_list) ? parsedResponse.shopping_list.length : 'N/A',
      hasSuggestions: !!parsedResponse.suggestions,
      hasAdvice: !!parsedResponse.advice,
      hasBudget: !!parsedResponse.budget_estimation
    });

    // Validate shopping_list structure
    if (!Array.isArray(parsedResponse.shopping_list)) {
      logger.error('[PARSE_ERROR] shopping_list is not an array');
      parsedResponse.shopping_list = [];
    }

    // Validate each category has items array
    parsedResponse.shopping_list.forEach((category: any, index: number) => {
      if (!category.category) {
        category.category = `Catégorie ${index + 1}`;
      }
      if (!Array.isArray(category.items)) {
        logger.warn(`[PARSE_WARNING] Category ${category.category} items is not an array`);
        category.items = [];
      }
    });

    // Parse budget estimation string to extract min/max/avg
    const budgetString = parsedResponse.budget_estimation?.estimated_cost || 'Non estimé';
    const parsedBudget = parseBudgetString(budgetString);

    logger.info('[PARSE_BUDGET] Budget parsed', {
      original: budgetString,
      minCents: parsedBudget.minCents,
      maxCents: parsedBudget.maxCents,
      avgCents: parsedBudget.avgCents,
      minEur: (parsedBudget.minCents / 100).toFixed(2),
      maxEur: (parsedBudget.maxCents / 100).toFixed(2),
      avgEur: (parsedBudget.avgCents / 100).toFixed(2)
    });

    // Validate and ensure required structure
    const result = {
      shopping_list: parsedResponse.shopping_list || [],
      suggestions: parsedResponse.suggestions || [],
      advice: parsedResponse.advice || [],
      budget_estimation: {
        estimated_cost: budgetString,
        confidence_level: parsedResponse.budget_estimation?.confidence_level || 'Faible',
        currency: parsedResponse.budget_estimation?.currency || 'EUR',
        notes: parsedResponse.budget_estimation?.notes || [],
        minCents: parsedBudget.minCents,
        maxCents: parsedBudget.maxCents,
        avgCents: parsedBudget.avgCents
      }
    };

    const totalItems = result.shopping_list.reduce((total, cat) => total + (cat.items?.length || 0), 0);

    logger.info('[PARSE_FINAL] Final parsed response ready', {
      total_categories: result.shopping_list.length,
      total_items: totalItems,
      suggestions: result.suggestions.length,
      advice: result.advice.length,
      budget: result.budget_estimation.estimated_cost,
      budget_cents: {
        min: parsedBudget.minCents,
        max: parsedBudget.maxCents,
        avg: parsedBudget.avgCents
      }
    });

    if (totalItems === 0) {
      logger.error('[PARSE_CRITICAL] ZERO items in final result!');
    } else if (totalItems < 10) {
      logger.warn(`[PARSE_WARNING] Only ${totalItems} items generated - expected 25-35`);
    }

    return result;
  } catch (error) {
    logger.error('[PARSE_ERROR] Error parsing AI response', {
      error: error.message,
      errorStack: error.stack,
      aiContentLength: aiContent?.length || 0
    });

    // Return fallback structure with clear error indication
    return {
      shopping_list: [
        {
          category: 'Erreur de Génération',
          items: [
            {
              name: 'La liste n\'a pas pu être générée correctement',
              quantity: '1',
              notes: `Erreur: ${error.message}. Veuillez réessayer.`
            }
          ]
        }
      ],
      suggestions: [],
      advice: [
        'Une erreur est survenue lors de la génération.',
        'Veuillez réessayer ou contacter le support si le problème persiste.',
        `Détails technique: ${error.message}`
      ],
      budget_estimation: {
        estimated_cost: 'Non disponible',
        confidence_level: 'Faible',
        currency: 'EUR',
        notes: ['Erreur de parsing des données', `Erreur: ${error.message}`]
      }
    }
  }
}
