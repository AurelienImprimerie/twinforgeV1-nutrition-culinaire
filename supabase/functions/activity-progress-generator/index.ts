/*
  Fonction Edge: activity-insights-generator
  Agent 3 - Génération d'insights d'activité avec gpt-5-mini
  
  Rôle: Analyser les patterns d'activité et générer des insights visuels + conseils personnalisés
  Modèle: gpt-5-mini (optimisé pour l'analyse de données et la génération d'insights)
  Fréquence: Avec mise en cache intelligente (évite les appels inutiles à OpenAI)
*/

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

// Configuration du cache par période d'analyse
const CACHE_VALIDITY_HOURS = {
  'last7Days': 24,      // Cache valide 24h pour analyse hebdomadaire
  'last30Days': 168,    // Cache valide 7 jours pour analyse mensuelle
  'last3Months': 336,   // Cache valide 14 jours pour analyse trimestrielle
  'last6Months': 720,   // Cache valide 30 jours pour analyse semestrielle
  'last1Year': 720      // Cache valide 30 jours pour analyse annuelle
};

// Seuils minimum d'activités par période
const MINIMUM_ACTIVITIES = {
  'last7Days': 1,
  'last30Days': 3,
  'last3Months': 8,
  'last6Months': 15,
  'last1Year': 25
};

function isCacheValid(cacheEntry, period) {
  if (!cacheEntry || !cacheEntry.updated_at) return false;
  
  const cacheAge = Date.now() - new Date(cacheEntry.updated_at).getTime();
  const validityMs = (CACHE_VALIDITY_HOURS[period] || 24) * 60 * 60 * 1000;
  
  return cacheAge < validityMs;
}

async function isCacheStillRelevant(cacheEntry, userId, period, supabase) {
  try {
    // Récupérer le nombre actuel d'activités pour la période
    const { startDate, endDate } = getDateRange(period);
    const { data: currentActivities, error } = await supabase
      .from('activities')
      .select('id')
      .eq('user_id', userId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);
    
    if (error) {
      console.warn('Failed to check current activities count for cache validation:', error.message);
      return true; // En cas d'erreur, on garde le cache pour éviter les appels coûteux
    }
    
    const currentCount = currentActivities?.length || 0;
    const cachedCount = cacheEntry.result_payload?.summary?.total_activities || 0;
    
    // Si +2 activités ou plus depuis le cache, considérer comme non pertinent
    const isRelevant = (currentCount - cachedCount) < 2;
    
    console.log('Cache relevance check:', {
      userId,
      period,
      currentCount,
      cachedCount,
      difference: currentCount - cachedCount,
      isRelevant,
      timestamp: new Date().toISOString()
    });
    
    return isRelevant;
  } catch (error) {
    console.warn('Error checking cache relevance:', error);
    return true; // En cas d'erreur, on garde le cache
  }
}

function getMinimumActivitiesForPeriod(period) {
  return MINIMUM_ACTIVITIES[period] || 3;
}

function calculateAge(birthdate) {
  if (!birthdate) return 30;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || monthDiff === 0 && today.getDate() < birth.getDate()) {
    age--;
  }
  return Math.max(16, Math.min(100, age));
}
function getDateRange(period) {
  const now = new Date();
  const endDate = now.toISOString();
  let daysBack = 7;

  // Support toutes les périodes: 7j, 30j, 3 mois, 6 mois, 1 an
  switch (period) {
    case 'last7Days':
      daysBack = 7;
      break;
    case 'last30Days':
      daysBack = 30;
      break;
    case 'last3Months':
      daysBack = 90;
      break;
    case 'last6Months':
      daysBack = 180;
      break;
    case 'last1Year':
      daysBack = 365;
      break;
    default:
      daysBack = 7;
  }

  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  return {
    startDate,
    endDate
  };
}
function processActivitiesForAnalysis(activities) {
  if (activities.length === 0) return "Aucune activité enregistrée sur cette période.";

  // Separate enriched and manual activities
  const enrichedActivities = activities.filter(a => a.wearable_device_id || a.hr_avg);
  const manualActivities = activities.filter(a => !a.wearable_device_id && !a.hr_avg);

  let text = '';

  if (enrichedActivities.length > 0) {
    text += '=== ACTIVITÉS AVEC DONNÉES BIOMÉTRIQUES (haute fiabilité) ===\n';
    text += enrichedActivities.map((activity) => {
      const biometrics = [];
      if (activity.hr_avg) biometrics.push(`FC:${activity.hr_avg}bpm`);
      if (activity.hrv_pre_activity) biometrics.push(`HRV:${activity.hrv_pre_activity}ms`);
      if (activity.vo2max_estimated) biometrics.push(`VO2max:${activity.vo2max_estimated}`);
      const biometricsStr = biometrics.length > 0 ? ` [${biometrics.join(', ')}]` : '';
      return `${activity.type} - ${activity.duration_min}min - ${activity.intensity} - ${activity.calories_est}kcal - ${new Date(activity.timestamp).toLocaleDateString('fr-FR')}${biometricsStr}`;
    }).join('\n');
    text += '\n\n';
  }

  if (manualActivities.length > 0) {
    text += '=== ACTIVITÉS MANUELLES (estimation) ===\n';
    text += manualActivities.map((activity) =>
      `${activity.type} - ${activity.duration_min}min - ${activity.intensity} - ${activity.calories_est}kcal - ${new Date(activity.timestamp).toLocaleDateString('fr-FR')}`
    ).join('\n');
  }

  return text;
}
Deno.serve(async (req)=>{
  // Handle CORS preflight - MUST be first
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const { userId, period = 'last7Days', userProfile, clientTraceId } = await req.json();
    const startTime = Date.now();
    console.log('🔥 [ACTIVITY_INSIGHTS] Starting insights generation', {
      userId,
      period,
      clientTraceId,
      cacheStrategy: 'check_cache_first',
      userProfile: {
        weight_kg: userProfile?.weight_kg,
        sex: userProfile?.sex,
        activity_level: userProfile?.activity_level,
        objective: userProfile?.objective
      },
      timestamp: new Date().toISOString()
    });
    // Validation des données d'entrée
    if (!userId) {
      throw new Error('User ID is required');
    }
    // Initialiser Supabase client
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    // ÉTAPE 1: Vérification du cache dans ai_trend_analyses
    console.log('🔥 [ACTIVITY_INSIGHTS] Step 1: Checking cache in ai_trend_analyses', {
      userId,
      period,
      timestamp: new Date().toISOString()
    });
    
    // Mapper la période pour le cache
    const getCachePeriod = (period) => {
      switch (period) {
        case 'last7Days': return '7_days';
        case 'last30Days': return '30_days';
        case 'last3Months': return '90_days';
        case 'last6Months': return '180_days';
        case 'last1Year': return '365_days';
        default: return '7_days';
      }
    };

    const { data: cacheEntry, error: cacheError } = await supabase
      .from('ai_trend_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('analysis_period', getCachePeriod(period))
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (cacheError && cacheError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.warn('🔥 [ACTIVITY_INSIGHTS] Cache check failed, proceeding without cache', {
        error: cacheError.message,
        userId,
        period,
        timestamp: new Date().toISOString()
      });
    }
    
    // ÉTAPE 2: Utiliser le cache si valide
    let shouldRegenerate = true;
    let cachedResponse = null;
    
    if (cacheEntry && isCacheValid(cacheEntry, period)) {
      const isStillRelevant = await isCacheStillRelevant(cacheEntry, userId, period, supabase);

      if (isStillRelevant) {
        // CORRECTION CRITIQUE: Récupérer les statistiques réelles des activités pour le cache
        const { startDate, endDate } = getDateRange(period);
        const { data: currentActivities, error: activitiesError } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', userId)
          .gte('timestamp', startDate)
          .lte('timestamp', endDate);

        if (activitiesError) {
          console.warn('⚠️ [ACTIVITY_INSIGHTS] Failed to fetch current activities for cache enrichment', {
            error: activitiesError.message,
            userId,
            period,
            willUseCachedDataWithoutEnrichment: true,
            timestamp: new Date().toISOString()
          });
        }

        // Calculer les statistiques réelles actuelles
        const currentActivitiesCount = currentActivities?.length || 0;
        const totalCalories = currentActivities?.reduce((sum, a) => sum + a.calories_est, 0) || 0;
        const totalDuration = currentActivities?.reduce((sum, a) => sum + a.duration_min, 0) || 0;
        const avgDailyCalories = currentActivitiesCount > 0 ? Math.round(totalCalories / getPeriodDays(period)) : 0;

        // Calculer le type d'activité le plus fréquent
        const typeFrequency = {};
        currentActivities?.forEach(activity => {
          typeFrequency[activity.type] = (typeFrequency[activity.type] || 0) + 1;
        });
        const mostFrequentType = Object.entries(typeFrequency)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Aucun';

        console.log('✅ [ACTIVITY_INSIGHTS] Using cached insights enriched with current activity stats', {
          userId,
          period,
          cacheAge: Math.round((Date.now() - new Date(cacheEntry.updated_at).getTime()) / (1000 * 60 * 60)),
          cacheValidityHours: CACHE_VALIDITY_HOURS[period],
          dataStillRelevant: true,
          costSaved: 'OpenAI call avoided',
          enrichmentApplied: true,
          currentActivitiesCount,
          totalCalories,
          totalDuration,
          timestamp: new Date().toISOString()
        });

        // Transformer les données du cache au format attendu par le frontend
        // CORRECTION: Enrichir avec les vraies statistiques actuelles
        cachedResponse = {
          insights: cacheEntry.trends || [],
          distribution: {
            activity_types: [],
            intensity_levels: [],
            time_patterns: []
          },
          daily_trends: [],
          heatmap_data: {
            weeks: [],
            stats: {
              excellentDays: 0,
              activityRate: currentActivitiesCount > 0 ? Math.round((currentActivitiesCount / getPeriodDays(period)) * 100) : 0,
              excellenceRate: 0,
              avgCaloriesPerDay: avgDailyCalories,
              avgDurationPerDay: currentActivitiesCount > 0 ? Math.round(totalDuration / getPeriodDays(period)) : 0
            }
          },
          summary: {
            total_activities: currentActivitiesCount,
            total_calories: totalCalories,
            total_duration: totalDuration,
            avg_daily_calories: avgDailyCalories,
            most_frequent_type: mostFrequentType,
            avg_intensity: 'medium',
            consistency_score: currentActivitiesCount > 0 ? Math.min(100, Math.round((currentActivitiesCount / getMinimumActivitiesForPeriod(period)) * 100)) : 0
          },
          activities: currentActivities || [],
          current_activities: currentActivitiesCount,
          cached: true,
          cache_age_hours: Math.round((Date.now() - new Date(cacheEntry.updated_at).getTime()) / (1000 * 60 * 60)),
          generated_at: cacheEntry.updated_at
        };

        shouldRegenerate = false;
      } else {
        console.log('🔄 [ACTIVITY_INSIGHTS] Cache expired due to new activities - will regenerate', {
          userId,
          period,
          reason: 'new_activities_detected',
          timestamp: new Date().toISOString()
        });
      }
    } else if (cacheEntry) {
      console.log('🔄 [ACTIVITY_INSIGHTS] Cache found but expired - will regenerate', {
        userId,
        period,
        reason: 'cache_too_old',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('🔄 [ACTIVITY_INSIGHTS] No cache found - will generate fresh insights', {
        userId,
        period,
        reason: 'no_cache_entry',
        timestamp: new Date().toISOString()
      });
    }
    
    // Retourner la réponse mise en cache si disponible
    if (!shouldRegenerate && cachedResponse) {
      return new Response(JSON.stringify(cachedResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // ÉTAPE 3: Récupérer les activités et vérifier la suffisance des données
    // Récupérer les activités de l'utilisateur pour la période
    const { startDate, endDate } = getDateRange(period);
    console.log('🔥 [ACTIVITY_INSIGHTS] Fetching activities from database', {
      userId,
      period,
      startDate,
      endDate,
      timestamp: new Date().toISOString()
    });
    const { data: activities, error: fetchError } = await supabase.from('activities').select('*').eq('user_id', userId).gte('timestamp', startDate).lte('timestamp', endDate).order('timestamp', {
      ascending: false
    });
    if (fetchError) {
      throw new Error(`Failed to fetch activities: ${fetchError.message}`);
    }
    
    const requiredActivities = getMinimumActivitiesForPeriod(period);
    const currentActivities = activities?.length || 0;
    
    console.log('🔥 [ACTIVITY_INSIGHTS] Activities fetched - data sufficiency check', {
      userId,
      activitiesCount: currentActivities,
      requiredActivities,
      hasSufficientData: currentActivities >= requiredActivities,
      period,
      willCallOpenAI: currentActivities >= requiredActivities,
      timestamp: new Date().toISOString()
    });
    
    // ÉTAPE 4: Retourner "insufficient_data" si pas assez d'activités (SANS appeler OpenAI)
    if (currentActivities < requiredActivities) {
      console.log('🔥 [ACTIVITY_INSIGHTS] Insufficient data - returning early without OpenAI call', {
        userId,
        period,
        requiredActivities,
        currentActivities,
        costSaved: 'OpenAI call avoided due to insufficient data',
        timestamp: new Date().toISOString()
      });
      
      return new Response(JSON.stringify({
        error: 'Insufficient data',
        message: `Au moins ${requiredActivities} activités sont nécessaires pour générer des insights`,
        required_activities: requiredActivities,
        current_activities: currentActivities,
        insufficient_data: true,
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // ÉTAPE 5: Données suffisantes - procéder à l'appel OpenAI
    console.log('🔥 [ACTIVITY_INSIGHTS] Sufficient data available - proceeding with OpenAI call', {
      userId,
      period,
      activitiesCount: currentActivities,
      requiredActivities,
      costImplication: 'This will consume OpenAI credits',
      timestamp: new Date().toISOString()
    });

    // TOKEN PRE-CHECK
    const estimatedTokens = 50;
    const tokenCheck = await checkTokenBalance(supabase, userId, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('🔥 [ACTIVITY_INSIGHTS] Insufficient tokens', {
        userId,
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
    
    // Préparer les données pour l'analyse IA
    const activitiesText = processActivitiesForAnalysis(activities);
    const userAge = calculateAge(userProfile?.birthdate);
    const periodDays = period === 'last7Days' ? 7 : 30;

    // Calculate enrichment stats
    const enrichedCount = activities.filter(a => a.wearable_device_id || a.hr_avg).length;
    const enrichmentRate = Math.round((enrichedCount / activities.length) * 100);
    // Prompt optimisé pour gpt-5-mini - Génération d'insights d'activité
    const insightsPrompt = `Tu es un expert en analyse d'activités physiques pour la Forge Énergétique TwinForge.

PROFIL UTILISATEUR:
- Poids: ${userProfile?.weight_kg || 70} kg
- Taille: ${userProfile?.height_cm || 'Non spécifiée'} cm
- Genre: ${userProfile?.sex || 'Non spécifié'}
- Âge: ${userAge} ans
- Niveau d'activité: ${userProfile?.activity_level || 'Non spécifié'}
- Objectif: ${userProfile?.objective || 'Non spécifié'}

PÉRIODE D'ANALYSE: ${periodDays} derniers jours

STATISTIQUES DE DONNÉES:
- Total activités: ${activities.length}
- Activités avec biométrie: ${enrichedCount} (${enrichmentRate}%)
- Activités manuelles: ${activities.length - enrichedCount}

DONNÉES D'ACTIVITÉS:
${activitiesText}

IMPORTANT:
- Les activités avec données biométriques sont plus fiables pour l'analyse
- Accorde plus de poids aux métriques de fréquence cardiaque, HRV et VO2max dans tes insights
- Mentionne le taux d'enrichissement si élevé (c'est un point positif)

TÂCHE: Génère une analyse complète des patterns d'activité avec:

1. INSIGHTS PERSONNALISÉS (4-6 insights maximum):
   - Observations sur les patterns temporels
   - Tendances d'intensité et de régularité
   - Points forts et axes d'amélioration
   - Conseils actionnables basés sur l'objectif utilisateur

2. DISTRIBUTION DES ACTIVITÉS (pour graphiques):
   - Types d'activités dominants avec pourcentages
   - Répartition des niveaux d'intensité
   - Patterns temporels (matin/après-midi/soir)

3. TENDANCES QUOTIDIENNES (pour graphiques linéaires):
   - Évolution des calories brûlées par jour
   - Évolution de la durée d'activité par jour
   - Nombre d'activités par jour

4. DONNÉES HEATMAP (pour visualisation calendaire):
   - Score d'activité par jour (none/low/medium/high/excellent)
   - Intensité relative par jour (0-1)

5. RÉSUMÉ GLOBAL:
   - Score de consistance (0-100)
   - Type d'activité le plus fréquent
   - Intensité moyenne
   - Recommandations principales

RÈGLES:
- Utilise un langage motivant et positif
- Évite le jargon technique
- Fournis des conseils actionnables
- Base tes analyses sur les données réelles
- Sois précis dans les pourcentages et les tendances

RÉPONSE REQUISE (JSON uniquement):
{
  "insights": [
    {
      "type": "pattern|trend|recommendation|achievement",
      "title": "Titre court",
      "content": "Description détaillée",
      "priority": "low|medium|high",
      "confidence": 0.85,
      "icon": "TrendingUp|Target|Zap|Activity|BarChart3",
      "color": "#3B82F6|#06B6D4|#10B981|#F59E0B|#EF4444",
      "actionable": true,
      "action": "Action suggérée"
    }
  ],
  "distribution": {
    "activity_types": [
      {
        "name": "Cardio",
        "percentage": 60,
        "total_minutes": 180,
        "total_calories": 800,
        "color": "#3B82F6"
      }
    ],
    "intensity_levels": [
      {
        "level": "Modérée",
        "percentage": 50,
        "sessions_count": 5,
        "color": "#F59E0B"
      }
    ],
    "time_patterns": [
      {
        "period": "Matin",
        "activity_count": 4,
        "avg_calories": 200,
        "color": "#10B981"
      }
    ]
  },
  "daily_trends": [
    {
      "date": "2025-01-15",
      "total_calories": 300,
      "total_duration": 60,
      "activities_count": 2,
      "avg_intensity": 2.5,
      "dominant_type": "course"
    }
  ],
  "heatmap_data": {
    "weeks": [
      [
        {
          "date": "2025-01-13",
          "dayName": "Lundi",
          "dayNumber": 13,
          "monthName": "Janvier",
          "status": "excellent",
          "intensity": 0.8,
          "calories": 400,
          "activitiesCount": 2,
          "duration": 90
        }
      ]
    ],
    "stats": {
      "excellentDays": 3,
      "activityRate": 85,
      "excellenceRate": 60,
      "avgCaloriesPerDay": 250,
      "avgDurationPerDay": 45
    }
  },
  "summary": {
    "total_activities": 12,
    "total_calories": 2400,
    "total_duration": 480,
    "avg_daily_calories": 343,
    "most_frequent_type": "course",
    "avg_intensity": "medium",
    "consistency_score": 78
  }
}`;
    console.log('🔥 [ACTIVITY_INSIGHTS] Calling OpenAI API with gpt-5-mini');
    
    let insightsResult;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let costUsd = 0;
    
    try {
      // Appel à gpt-5-mini pour la génération d'insights
      const insightsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'user',
              content: insightsPrompt
            }
          ],
          max_completion_tokens: 3000,
          response_format: {
            type: 'json_object'
          }
        })
      });
      
      console.log('🔥 [ACTIVITY_INSIGHTS] OpenAI API response status:', insightsResponse.status);
      
      if (!insightsResponse.ok) {
        throw new Error(`OpenAI API error: ${insightsResponse.status} ${insightsResponse.statusText}`);
      }
      
      const insightsData = await insightsResponse.json();
      console.log('🔥 [ACTIVITY_INSIGHTS] OpenAI API response received:', {
        hasChoices: !!insightsData.choices,
        choicesLength: insightsData.choices?.length || 0,
        usage: insightsData.usage,
        userId,
        clientTraceId
      });
      
      insightsResult = JSON.parse(insightsData.choices?.[0]?.message?.content || '{}');

      // Calcul du coût basé sur l'usage réel d'OpenAI
      inputTokens = insightsData.usage?.prompt_tokens || 0;
      outputTokens = insightsData.usage?.completion_tokens || 0;
      totalTokens = insightsData.usage?.total_tokens || 0;
      // Pricing gpt-5-mini: $0.25/1M input tokens, $2.00/1M output tokens
      costUsd = inputTokens / 1000000 * 0.25 + outputTokens / 1000000 * 2.0;

      // TOKEN CONSUMPTION
      const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
        userId,
        edgeFunctionName: 'activity-progress-generator',
        operationType: 'activity_progress_insights',
        openaiModel: 'gpt-5-mini',
        openaiInputTokens: inputTokens,
        openaiOutputTokens: outputTokens,
        openaiCostUsd: costUsd,
        metadata: {
          period,
          activities_count: activities.length,
          enriched_count: enrichedCount,
          client_trace_id: clientTraceId
        }
      });

      console.log('💰 [ACTIVITY_INSIGHTS] Tokens consumed', {
        userId,
        inputTokens,
        outputTokens,
        costUsd: costUsd.toFixed(6)
      });
      
    } catch (openaiError) {
      console.error('🔥 [ACTIVITY_INSIGHTS] OpenAI API call failed - using fallback', {
        error: openaiError instanceof Error ? openaiError.message : 'Unknown error',
        userId,
        period,
        activitiesCount: currentActivities,
        fallbackStrategy: 'generate_basic_summary',
        timestamp: new Date().toISOString()
      });
      
      // FALLBACK INTELLIGENT: Générer une réponse basique sans IA
      const totalCalories = activities.reduce((sum, a) => sum + a.calories_est, 0);
      const totalDuration = activities.reduce((sum, a) => sum + a.duration_min, 0);
      const avgDailyCalories = Math.round(totalCalories / getPeriodDays(period));
      
      // Calculer le type d'activité le plus fréquent
      const typeFrequency = {};
      activities.forEach(activity => {
        typeFrequency[activity.type] = (typeFrequency[activity.type] || 0) + 1;
      });
      const mostFrequentType = Object.entries(typeFrequency)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Aucun';
      
      const fallbackResponse = {
        insights: [
          {
            type: 'summary',
            title: 'Résumé de votre activité',
            content: `Vous avez enregistré ${currentActivities} activités sur cette période, brûlant ${totalCalories} calories au total.`,
            priority: 'medium',
            confidence: 0.9,
            icon: 'BarChart3',
            color: '#3B82F6',
            actionable: false
          }
        ],
        distribution: {
          activity_types: [],
          intensity_levels: [],
          time_patterns: []
        },
        daily_trends: [],
        heatmap_data: {
          weeks: [],
          stats: {
            excellentDays: 0,
            activityRate: Math.round((currentActivities / getPeriodDays(period)) * 100),
            excellenceRate: 0,
            avgCaloriesPerDay: avgDailyCalories,
            avgDurationPerDay: Math.round(totalDuration / getPeriodDays(period))
          }
        },
        summary: {
          total_activities: currentActivities,
          total_calories: totalCalories,
          total_duration: totalDuration,
          avg_daily_calories: avgDailyCalories,
          most_frequent_type: mostFrequentType,
          avg_intensity: 'medium',
          consistency_score: Math.min(100, Math.round((currentActivities / requiredActivities) * 100))
        },
        fallback: true,
        fallback_reason: 'openai_api_unavailable',
        activities: activities,
        current_activities: currentActivities,
        generated_at: new Date().toISOString()
      };
      
      return new Response(JSON.stringify(fallbackResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const processingTime = Date.now() - startTime;
    console.log('✅ [ACTIVITY_INSIGHTS] Insights generation completed', {
      userId,
      clientTraceId,
      period,
      activitiesAnalyzed: activities.length,
      insightsGenerated: insightsResult.insights?.length || 0,
      processingTime,
      costUsd: costUsd.toFixed(6),
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      },
      timestamp: new Date().toISOString()
    });
    
    // ÉTAPE 6: Sauvegarder dans le cache (ai_trend_analyses) ET le tracking des coûts
    try {
      // Sauvegarder dans le cache ai_trend_analyses
      const cacheData = {
        user_id: userId,
        analysis_period: getCachePeriod(period),
        trends: insightsResult.insights || [],
        strategic_advice: insightsResult.insights?.filter(i => i.actionable) || [],
        meal_classifications: [], // Pas applicable pour les activités
        diet_compliance: {}, // Pas applicable pour les activités
        model_used: 'gpt-5-mini',
        tokens_used: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
      
      const { error: cacheInsertError } = await supabase
        .from('ai_trend_analyses')
        .upsert(cacheData, { 
          onConflict: 'user_id,analysis_period',
          ignoreDuplicates: false 
        });
      
      if (cacheInsertError) {
        console.error('🔥 [ACTIVITY_INSIGHTS] Failed to save to cache', {
          error: cacheInsertError.message,
          userId,
          period,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('💾 [ACTIVITY_INSIGHTS] Results cached successfully in ai_trend_analyses', {
          userId,
          period: getCachePeriod(period),
          insightsCount: insightsResult.insights?.length || 0,
          cacheValidUntil: new Date(Date.now() + (CACHE_VALIDITY_HOURS[period] || 24) * 60 * 60 * 1000).toISOString(),
          timestamp: new Date().toISOString()
        });
      }
      
      // Sauvegarder le tracking des coûts dans ai_analysis_jobs
      await supabase.from('ai_analysis_jobs').insert({
        user_id: userId,
        analysis_type: 'trend_analysis',
        status: 'completed',
        request_payload: {
          clientTraceId,
          period,
          activitiesCount: activities.length,
          userProfile: {
            weight_kg: userProfile?.weight_kg,
            sex: userProfile?.sex,
            activity_level: userProfile?.activity_level,
            objective: userProfile?.objective
          }
        },
        result_payload: {
          insights: insightsResult.insights,
          distribution: insightsResult.distribution,
          summary: insightsResult.summary,
          confidence: 0.85,
          processingTime,
          costUsd,
          tokenUsage: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokens
          },
          model: 'gpt-5-mini'
        }
      });
      
      console.log('💰 [ACTIVITY_INSIGHTS] Cost tracking saved to database', {
        userId,
        costUsd: costUsd.toFixed(6),
        period,
        activitiesAnalyzed: activities.length,
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      console.error('💰 [ACTIVITY_INSIGHTS] Failed to save cost tracking', {
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        userId,
        costUsd: costUsd.toFixed(6),
        timestamp: new Date().toISOString()
      });
    // Don't fail the main function if cost tracking fails
    }
    const response = {
      insights: insightsResult.insights || [],
      distribution: insightsResult.distribution || {
        activity_types: [],
        intensity_levels: [],
        time_patterns: []
      },
      daily_trends: insightsResult.daily_trends || [],
      heatmap_data: insightsResult.heatmap_data || {
        weeks: [],
        stats: {
          excellentDays: 0,
          activityRate: 0,
          excellenceRate: 0,
          avgCaloriesPerDay: 0,
          avgDurationPerDay: 0
        }
      },
      summary: insightsResult.summary || {
        total_activities: activities.length,
        total_calories: activities.reduce((sum, a) => sum + a.calories_est, 0),
        total_duration: activities.reduce((sum, a) => sum + a.duration_min, 0),
        avg_daily_calories: 0,
        most_frequent_type: 'Aucun',
        avg_intensity: 'medium',
        consistency_score: 0
      },
      activities: activities,
      current_activities: currentActivities,
      processingTime,
      costUsd,
      confidence: 0.85,
      cached: false,
      generated_at: new Date().toISOString(),
      tokens_consumed: estimatedTokens
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('❌ [ACTIVITY_INSIGHTS] Error:', error);
    return new Response(JSON.stringify({
      error: 'Activity insights generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

function getPeriodDays(period) {
  switch(period){
    case 'last7Days':
      return 7;
    case 'last30Days':
      return 30;
    case 'last3Months':
      return 90;
    case 'last6Months':
      return 180;
    case 'last1Year':
      return 365;
    default:
      return 7;
  }
}