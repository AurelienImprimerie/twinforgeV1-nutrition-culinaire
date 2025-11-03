/*
  Fonction Edge: biometric-insights-analyzer
  Agent 4 - Analyse des données biométriques avec gpt-5-mini

  Rôle: Analyser les patterns biométriques (HRV, zones cardiaques, récupération, VO2max)
        et générer des insights de performance et de santé
  Modèle: gpt-5-mini (optimisé pour l'analyse de données médicales et sportives)
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

// Configuration du cache par période d'analyse
const CACHE_VALIDITY_HOURS = {
  'last7Days': 24,
  'last30Days': 168,
  'last3Months': 336,
};

// Seuils minimum d'activités enrichies par période
const MINIMUM_ENRICHED_ACTIVITIES = {
  'last7Days': 2,
  'last30Days': 5,
  'last3Months': 10,
};

interface BiometricAnalysisRequest {
  userId: string;
  period?: string;
  userProfile?: any;
  clientTraceId?: string;
}

interface EnrichedActivity {
  id: string;
  type: string;
  duration_min: number;
  intensity: string;
  calories_est: number;
  timestamp: string;
  hr_avg?: number;
  hr_max?: number;
  hr_min?: number;
  hr_zone1_minutes?: number;
  hr_zone2_minutes?: number;
  hr_zone3_minutes?: number;
  hr_zone4_minutes?: number;
  hr_zone5_minutes?: number;
  hrv_pre_activity?: number;
  hrv_post_activity?: number;
  vo2max_estimated?: number;
  training_load_score?: number;
  efficiency_score?: number;
  fatigue_index?: number;
  recovery_score?: number;
  wearable_device_id?: string;
}

function getDateRange(period: string) {
  const now = new Date();
  const endDate = now.toISOString();
  let daysBack = 7;

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
    default:
      daysBack = 7;
  }

  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  return { startDate, endDate };
}

function calculateAge(birthdate?: string): number {
  if (!birthdate) return 30;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(16, Math.min(100, age));
}

function processEnrichedActivitiesForAnalysis(activities: EnrichedActivity[]): string {
  if (activities.length === 0) return 'Aucune activité enrichie disponible.';

  return activities.map((activity) => {
    const biometrics = [];
    if (activity.hr_avg) biometrics.push(`FC moy: ${activity.hr_avg}bpm`);
    if (activity.hr_max) biometrics.push(`FC max: ${activity.hr_max}bpm`);
    if (activity.hrv_pre_activity) biometrics.push(`HRV pré: ${activity.hrv_pre_activity}ms`);
    if (activity.vo2max_estimated) biometrics.push(`VO2max: ${activity.vo2max_estimated}ml/kg/min`);
    if (activity.recovery_score) biometrics.push(`Récup: ${activity.recovery_score}%`);

    const zones = [];
    if (activity.hr_zone1_minutes) zones.push(`Z1:${activity.hr_zone1_minutes}min`);
    if (activity.hr_zone2_minutes) zones.push(`Z2:${activity.hr_zone2_minutes}min`);
    if (activity.hr_zone3_minutes) zones.push(`Z3:${activity.hr_zone3_minutes}min`);
    if (activity.hr_zone4_minutes) zones.push(`Z4:${activity.hr_zone4_minutes}min`);
    if (activity.hr_zone5_minutes) zones.push(`Z5:${activity.hr_zone5_minutes}min`);

    return `${activity.type} - ${activity.duration_min}min - ${activity.intensity} - ${new Date(activity.timestamp).toLocaleDateString('fr-FR')} | ${biometrics.join(', ')} | Zones: ${zones.join(', ')}`;
  }).join('\n');
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Import Supabase dynamically
    const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');

    const {
      userId,
      period = 'last7Days',
      userProfile,
      clientTraceId,
    }: BiometricAnalysisRequest = await req.json();

    const startTime = Date.now();

    console.log('🔥 [BIOMETRIC_INSIGHTS] Starting biometric analysis', {
      userId,
      period,
      clientTraceId,
      timestamp: new Date().toISOString(),
    });

    // Validation
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TOKEN PRE-CHECK - Estimate tokens based on prompt and expected response
    const estimatedTokens = 60;
    const tokenCheck = await checkTokenBalance(supabase, userId, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('🔥 [BIOMETRIC_INSIGHTS] Insufficient tokens', {
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

    // Fetch enriched activities (only those with wearable data)
    const { startDate, endDate } = getDateRange(period);

    console.log('🔥 [BIOMETRIC_INSIGHTS] Fetching enriched activities', {
      userId,
      period,
      startDate,
      endDate,
      timestamp: new Date().toISOString(),
    });

    const { data: activities, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .not('wearable_device_id', 'is', null) // Only enriched activities
      .order('timestamp', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch enriched activities: ${fetchError.message}`);
    }

    const enrichedActivities = activities || [];
    const requiredActivities = MINIMUM_ENRICHED_ACTIVITIES[period as keyof typeof MINIMUM_ENRICHED_ACTIVITIES] || 2;

    console.log('🔥 [BIOMETRIC_INSIGHTS] Enriched activities fetched', {
      userId,
      enrichedCount: enrichedActivities.length,
      requiredActivities,
      hasSufficientData: enrichedActivities.length >= requiredActivities,
      timestamp: new Date().toISOString(),
    });

    // Check if sufficient enriched data
    if (enrichedActivities.length < requiredActivities) {
      console.log('🔥 [BIOMETRIC_INSIGHTS] Insufficient enriched data', {
        userId,
        period,
        enrichedCount: enrichedActivities.length,
        requiredActivities,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          error: 'Insufficient enriched data',
          message: `Au moins ${requiredActivities} activités avec données biométriques sont nécessaires`,
          required_enriched: requiredActivities,
          current_enriched: enrichedActivities.length,
          insufficient_data: true,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Prepare data for AI analysis
    const activitiesText = processEnrichedActivitiesForAnalysis(enrichedActivities);
    const userAge = calculateAge(userProfile?.birthdate);

    // Calculate biometric summary for context
    const avgHr = enrichedActivities
      .filter(a => a.hr_avg)
      .reduce((sum, a) => sum + (a.hr_avg || 0), 0) / enrichedActivities.filter(a => a.hr_avg).length || 0;

    const avgHrv = enrichedActivities
      .filter(a => a.hrv_pre_activity)
      .reduce((sum, a) => sum + (a.hrv_pre_activity || 0), 0) / enrichedActivities.filter(a => a.hrv_pre_activity).length || 0;

    const avgVo2max = enrichedActivities
      .filter(a => a.vo2max_estimated)
      .reduce((sum, a) => sum + (a.vo2max_estimated || 0), 0) / enrichedActivities.filter(a => a.vo2max_estimated).length || 0;

    // Optimized prompt for gpt-5-mini - Biometric analysis
    const biometricPrompt = `Tu es un expert en physiologie de l'exercice et en analyse de données biométriques pour la Forge Énergétique TwinForge.

PROFIL UTILISATEUR:
- Poids: ${userProfile?.weight_kg || 70} kg
- Genre: ${userProfile?.sex || 'Non spécifié'}
- Âge: ${userAge} ans
- Niveau d'activité: ${userProfile?.activity_level || 'Non spécifié'}
- Objectif: ${userProfile?.objective || 'Non spécifié'}

PÉRIODE D'ANALYSE: ${period === 'last7Days' ? '7 derniers jours' : period === 'last30Days' ? '30 derniers jours' : '3 derniers mois'}

RÉSUMÉ BIOMÉTRIQUE:
- Fréquence cardiaque moyenne: ${Math.round(avgHr)} bpm
- HRV moyen: ${Math.round(avgHrv)} ms
- VO2max moyen estimé: ${Math.round(avgVo2max * 10) / 10} ml/kg/min

DONNÉES D'ACTIVITÉS ENRICHIES (avec biométrie):
${activitiesText}

TÂCHE: Génère une analyse complète des patterns biométriques avec:

1. INSIGHTS BIOMÉTRIQUES (4-6 insights maximum):
   - Analyse de la variabilité de fréquence cardiaque (HRV) et implications pour la récupération
   - Tendances de VO2max et capacité aérobie
   - Distribution des zones de fréquence cardiaque et efficacité d'entraînement
   - Charge d'entraînement et risques de sur-entraînement
   - Patterns de récupération et recommandations
   - Efficacité cardiaque et progrès cardiovasculaires

2. ZONE CARDIAQUE ANALYSIS:
   - Temps passé dans chaque zone (Z1-Z5)
   - Qualité de l'entraînement selon les zones
   - Recommandations d'ajustement

3. TENDANCES DE PERFORMANCE:
   - Évolution du VO2max
   - Évolution de la HRV
   - Charge d'entraînement cumulée
   - Score de fatigue

4. RECOMMANDATIONS DE RÉCUPÉRATION:
   - Besoin de repos basé sur HRV et charge
   - Jours de récupération active suggérés
   - Intensité recommandée pour prochains entraînements

RÈGLES:
- Base tes analyses sur les données biométriques réelles
- Utilise un langage scientifique mais accessible
- Fournis des recommandations actionnables
- Alerte sur les signaux de sur-entraînement ou sous-récupération
- Sois précis dans les métriques et les tendances

RÉPONSE REQUISE (JSON uniquement):
{
  "biometric_insights": [
    {
      "type": "hrv|vo2max|zones|recovery|performance|warning",
      "title": "Titre court",
      "content": "Description détaillée avec métriques",
      "priority": "low|medium|high",
      "confidence": 0.85,
      "metric_type": "hrv|heart_rate|vo2max|zones|recovery",
      "metric_value": 50,
      "metric_trend": "improving|stable|declining",
      "icon": "Heart|Activity|TrendingUp|TrendingDown|AlertTriangle",
      "color": "#10B981|#3B82F6|#F59E0B|#EF4444",
      "actionable": true,
      "action": "Action suggérée"
    }
  ],
  "zone_distribution": {
    "zone1": { "minutes": 120, "percentage": 30, "quality": "good" },
    "zone2": { "minutes": 150, "percentage": 37.5, "quality": "excellent" },
    "zone3": { "minutes": 80, "percentage": 20, "quality": "good" },
    "zone4": { "minutes": 40, "percentage": 10, "quality": "moderate" },
    "zone5": { "minutes": 10, "percentage": 2.5, "quality": "low" }
  },
  "performance_trends": {
    "vo2max_trend": "improving",
    "vo2max_change": 2.5,
    "hrv_trend": "stable",
    "hrv_change": 3,
    "training_load_7d": 850,
    "fatigue_score": 65,
    "fitness_score": 72
  },
  "recovery_recommendations": {
    "recovery_days_needed": 2,
    "next_intensity": "low|medium|high",
    "rest_recommendation": "Description détaillée",
    "risk_level": "low|medium|high",
    "risk_factors": ["factor1", "factor2"]
  },
  "summary": {
    "avg_hr": 145,
    "avg_hrv": 55,
    "avg_vo2max": 42.5,
    "total_enriched_activities": 10,
    "data_quality_score": 85,
    "analysis_confidence": 0.9
  }
}`;

    console.log('🔥 [BIOMETRIC_INSIGHTS] Calling OpenAI API with gpt-5-mini');

    // Call OpenAI for biometric insights
    const insightsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'user',
            content: biometricPrompt,
          },
        ],
        max_completion_tokens: 3000,
        response_format: {
          type: 'json_object',
        },
      }),
    });

    if (!insightsResponse.ok) {
      const errorBody = await insightsResponse.text();
      console.error('❌ [BIOMETRIC_INSIGHTS] OpenAI API Error', {
        status: insightsResponse.status,
        statusText: insightsResponse.statusText,
        errorBody,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Biometric analysis failed: ${insightsResponse.statusText}`);
    }

    const insightsData = await insightsResponse.json();
    const insightsResult = JSON.parse(insightsData.choices?.[0]?.message?.content || '{}');

    // Calculate cost
    const inputTokens = insightsData.usage?.prompt_tokens || 0;
    const outputTokens = insightsData.usage?.completion_tokens || 0;
    const totalTokens = insightsData.usage?.total_tokens || 0;
    const costUsd = (inputTokens / 1000000) * 0.25 + (outputTokens / 1000000) * 2.0;

    // TOKEN CONSUMPTION - Use actual OpenAI usage data
    const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
      userId,
      edgeFunctionName: 'biometric-insights-analyzer',
      operationType: 'biometric_analysis',
      openaiModel: 'gpt-5-mini',
      openaiInputTokens: inputTokens,
      openaiOutputTokens: outputTokens,
      openaiCostUsd: costUsd,
      metadata: {
        period,
        enrichedActivitiesCount: enrichedActivities.length,
        insightsGenerated: insightsResult.biometric_insights?.length || 0,
        clientTraceId
      }
    });

    console.log('💰 [BIOMETRIC_INSIGHTS] Tokens consumed', {
      userId,
      inputTokens,
      outputTokens,
      costUsd: costUsd.toFixed(6)
    });

    const processingTime = Date.now() - startTime;

    console.log('✅ [BIOMETRIC_INSIGHTS] Analysis completed', {
      userId,
      clientTraceId,
      period,
      enrichedActivitiesAnalyzed: enrichedActivities.length,
      insightsGenerated: insightsResult.biometric_insights?.length || 0,
      processingTime,
      costUsd: costUsd.toFixed(6),
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      timestamp: new Date().toISOString(),
    });


    const response = {
      biometric_insights: insightsResult.biometric_insights || [],
      zone_distribution: insightsResult.zone_distribution || {},
      performance_trends: insightsResult.performance_trends || {},
      recovery_recommendations: insightsResult.recovery_recommendations || {},
      summary: insightsResult.summary || {},
      enriched_activities: enrichedActivities,
      processingTime,
      costUsd,
      confidence: 0.9,
      tokens_consumed: estimatedTokens,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('❌ [BIOMETRIC_INSIGHTS] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Biometric analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});
