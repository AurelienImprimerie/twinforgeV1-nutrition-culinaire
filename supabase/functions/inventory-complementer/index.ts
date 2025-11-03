import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FridgeItem {
  label: string;
  category: string;
  quantity: string;
  confidence?: number;
  freshness?: number;
}

interface UserProfile {
  sex?: string;
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  activity_level?: string;
  objective?: string;
  constraints?: any;
  preferences?: any;
  nutrition?: any;
  household_details?: any;
  food_preferences?: any;
  macro_targets?: any;
}

interface MealItem {
  id: string;
  meal_name?: string;
  items?: any[];
  timestamp: string;
  meal_type?: string;
}

interface ComplementRequest {
  user_id: string;
  current_inventory: FridgeItem[];
  user_profile: UserProfile;
}

interface SuggestedItem extends FridgeItem {
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

// Generate cache key including recent meals data
function generateCacheKey(user_id: string, current_inventory: FridgeItem[], user_profile: UserProfile, recentMealsData: string): string {
  const inventoryHash = JSON.stringify(current_inventory.map(item => ({ label: item.label, category: item.category })));
  const profileHash = JSON.stringify({
    sex: user_profile.sex,
    objective: user_profile.objective,
    constraints: user_profile.constraints,
    food_preferences: user_profile.food_preferences
  });
  
  return `inventory_complement_v2_${user_id}_${btoa(inventoryHash + profileHash + recentMealsData).slice(0, 32)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, current_inventory, user_profile }: ComplementRequest = await req.json()

    console.log('INVENTORY_COMPLEMENTER Starting complement analysis', {
      user_id,
      current_inventory_count: current_inventory.length,
      timestamp: new Date().toISOString()
    })

    // TOKEN PRE-CHECK
    const estimatedTokens = 35;
    const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('INVENTORY_COMPLEMENTER', 'Insufficient tokens', {
        user_id,
        currentBalance: tokenCheck.currentBalance,
        requiredTokens: estimatedTokens
      });

      return new Response(
        JSON.stringify(createInsufficientTokensResponse(
          tokenCheck.currentBalance,
          estimatedTokens,
          !tokenCheck.isSubscribed,
          corsHeaders
        )),
        {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch recent meals for the user
    const { data: recentMeals, error: mealsError } = await supabase
      .from('meals')
      .select('id, meal_name, items, timestamp, meal_type')
      .eq('user_id', user_id)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (mealsError) {
      console.warn('INVENTORY_COMPLEMENTER Failed to fetch recent meals', {
        user_id,
        error: mealsError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Process recent meals data
    const recentMealsContext = recentMeals && recentMeals.length > 0 
      ? recentMeals.map(meal => {
          const ingredients = meal.items && Array.isArray(meal.items) 
            ? meal.items.map((item: any) => item.name || item.label || item).filter(Boolean).join(', ')
            : '';
          return `- ${meal.meal_name || 'Repas'} (${meal.meal_type || 'non spécifié'}): ${ingredients}`;
        }).join('\n')
      : 'Aucun repas récent trouvé dans l\'historique.';

    const recentMealsData = recentMeals ? JSON.stringify(recentMeals.map(m => ({ 
      meal_name: m.meal_name, 
      items: m.items, 
      meal_type: m.meal_type 
    }))) : '';

    console.log('INVENTORY_COMPLEMENTER Recent meals fetched', {
      user_id,
      recent_meals_count: recentMeals?.length || 0,
      has_meal_history: (recentMeals?.length || 0) > 0,
      timestamp: new Date().toISOString()
    });

    // Analyze current inventory categories
    const categories = current_inventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Build AI prompt for nutrition expert
    const prompt = `Tu es un expert en nutrition et planification de repas. Analyse l'inventaire actuel d'un utilisateur, son profil et son historique de repas pour suggérer des aliments complémentaires.

PROFIL UTILISATEUR:
- Sexe: ${user_profile.sex || 'Non spécifié'}
- Taille: ${user_profile.height_cm || 'Non spécifiée'} cm
- Poids actuel: ${user_profile.weight_kg || 'Non spécifié'} kg
- Poids cible: ${user_profile.target_weight_kg || 'Non spécifié'} kg
- Niveau d'activité: ${user_profile.activity_level || 'Non spécifié'}
- Objectif: ${user_profile.objective || 'Non spécifié'}
- Contraintes alimentaires: ${JSON.stringify(user_profile.constraints || {})}
- Préférences alimentaires: ${JSON.stringify(user_profile.food_preferences || {})}
- Détails du foyer: ${JSON.stringify(user_profile.household_details || {})}
- Objectifs macronutriments: ${JSON.stringify(user_profile.macro_targets || {})}

INVENTAIRE ACTUEL (${current_inventory.length} éléments):
${current_inventory.map(item => `- ${item.label} (${item.category}) - ${item.quantity}`).join('\n')}

CATÉGORIES PRÉSENTES:
${Object.entries(categories).map(([cat, count]) => `- ${cat}: ${count} éléments`).join('\n')}

HISTORIQUE DES REPAS RÉCENTS (10 derniers repas):
${recentMealsContext}

MISSION:
Suggère 15 à 20 aliments complémentaires pour atteindre un total d'au moins 20 éléments (inventaire actuel + suggestions). Ces aliments doivent permettre de créer un plan de repas équilibré et varié pour une semaine complète. Prends en compte:

1. L'équilibre nutritionnel (protéines, glucides, lipides, fibres, vitamines, minéraux)
2. La variété des catégories d'aliments
3. **PRIORITÉ ABSOLUE**: Les préférences et contraintes spécifiques de l'utilisateur
4. Les objectifs fitness (perte de poids, prise de muscle, etc.)
5. La taille du foyer
6. La praticité et la conservation des aliments
7. **IMPORTANT**: Les habitudes alimentaires observées dans l'historique des repas récents
8. **IMPORTANT**: Propose des aliments qui complètent les ingrédients déjà utilisés dans les repas récents tout en apportant de la variété
9. **IMPORTANT**: Si les données utilisateur sont limitées, privilégie des aliments sains, polyvalents et facilement trouvables

CONTRAINTES:
- **OBJECTIF**: Atteindre un total d'au moins 20 éléments (${current_inventory.length} actuels + suggestions)
- Privilégie les aliments frais et de base
- Évite les doublons avec l'inventaire existant
- **PERSONNALISATION MAXIMALE**: Assure-toi que les suggestions sont parfaitement alignées avec les objectifs ET les habitudes alimentaires observées
- Propose des quantités réalistes pour une semaine
- Si l'utilisateur mange souvent certains types d'aliments, suggère des compléments qui s'accordent bien avec ces habitudes
- Introduis de la variété tout en respectant les préférences observées dans l'historique
- Si peu de données utilisateur disponibles: suggère des aliments de base sains (légumes variés, protéines maigres, céréales complètes, légumineuses, fruits)

RÉPONSE ATTENDUE:
Retourne uniquement un JSON valide avec cette structure:

\`\`\`json
[
  {
    "label": "Nom de l'aliment",
    "category": "Catégorie",
    "quantity": "Quantité estimée",
    "confidence": 0.95,
    "freshness": 90,
    "reason": "Raison détaillée de la suggestion basée sur l'inventaire ET l'historique des repas",
    "priority": "high|medium|low"
  }
]
\`\`\`

Assure-toi que le JSON est parfaitement formaté et valide.`;

    // Call OpenAI API with GPT-5-mini
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en nutrition et planification de repas. Tu réponds uniquement en JSON valide. Tu prends en compte l\'historique des repas pour suggérer des aliments complémentaires cohérents avec les habitudes alimentaires de l\'utilisateur.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_completion_tokens: 15000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content received from OpenAI');
    }

    // TOKEN CONSUMPTION
    const inputTokens = openaiData.usage?.prompt_tokens || 0;
    const outputTokens = openaiData.usage?.completion_tokens || 0;
    const costUsd = (inputTokens / 1000000 * 0.25) + (outputTokens / 1000000 * 2.0);

    const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
      userId: user_id,
      edgeFunctionName: 'inventory-complementer',
      operationType: 'inventory_complement',
      openaiModel: 'gpt-5-mini',
      openaiInputTokens: inputTokens,
      openaiOutputTokens: outputTokens,
      openaiCostUsd: costUsd,
      metadata: {
        current_inventory_count: current_inventory.length,
        recent_meals_count: recentMeals?.length || 0
      }
    });

    console.log('INVENTORY_COMPLEMENTER Raw AI response received', {
      user_id,
      raw_content_length: aiContent.length,
      raw_content_preview: aiContent.substring(0, 200),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      costUsd: costUsd.toFixed(6),
      model_used: 'gpt-5-mini',
      timestamp: new Date().toISOString()
    });

    // Extract JSON from AI response - improved parsing
    let cleanedContent = aiContent.trim();
    
    // Remove markdown code block wrappers if present
    cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    
    // Find the actual JSON array boundaries
    const startIndex = cleanedContent.indexOf('[');
    const endIndex = cleanedContent.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      throw new Error('No valid JSON array found in AI response');
    }
    
    const jsonContent = cleanedContent.substring(startIndex, endIndex + 1);
    
    console.log('INVENTORY_COMPLEMENTER JSON extraction attempt', {
      user_id,
      json_boundaries_found: startIndex !== -1 && endIndex !== -1,
      start_index: startIndex,
      end_index: endIndex,
      json_match_length: jsonContent.length,
      json_match_preview: jsonContent.substring(0, 200),
      timestamp: new Date().toISOString()
    });

    let suggestedItems: SuggestedItem[];
    try {
      suggestedItems = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('INVENTORY_COMPLEMENTER JSON parsing failed', {
        user_id,
        error: parseError.message,
        json_content: jsonContent,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate and normalize suggested items
    const normalizedItems = suggestedItems.map(item => ({
      label: item.label || 'Aliment suggéré',
      category: item.category || 'Divers',
      quantity: item.quantity || '1 unité',
      confidence: item.confidence || 0.9,
      freshness: item.freshness || 85,
      reason: item.reason || 'Complément nutritionnel recommandé',
      priority: item.priority || 'medium'
    }));

    console.log('INVENTORY_COMPLEMENTER Complement analysis completed', {
      user_id,
      current_inventory_count: current_inventory.length,
      recent_meals_count: recentMeals?.length || 0,
      suggested_items_count: normalizedItems.length,
      categories_suggested: [...new Set(normalizedItems.map(item => item.category))],
      high_priority_items: normalizedItems.filter(item => item.priority === 'high').length,
      processing_time_ms: Date.now() - new Date().getTime(),
      cost_usd: ((openaiData.usage?.prompt_tokens * 0.25 / 1000000) + (openaiData.usage?.completion_tokens * 2.00 / 1000000)).toFixed(5),
      input_tokens: openaiData.usage?.prompt_tokens,
      output_tokens: openaiData.usage?.completion_tokens,
      model_used: 'gpt-5-mini',
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        suggested_items: normalizedItems,
        tokens_consumed: estimatedTokens,
        analysis_summary: {
          current_inventory_count: current_inventory.length,
          recent_meals_count: recentMeals?.length || 0,
          suggested_items_count: normalizedItems.length,
          categories_covered: Object.keys(categories),
          categories_suggested: [...new Set(normalizedItems.map(item => item.category))],
          high_priority_suggestions: normalizedItems.filter(item => item.priority === 'high').length,
          meal_history_considered: (recentMeals?.length || 0) > 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('INVENTORY_COMPLEMENTER Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        suggested_items: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
})