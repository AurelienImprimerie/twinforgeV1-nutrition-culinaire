import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import { createHash } from 'node:crypto';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

/**
 * GPT-5 Mini pricing for cost calculation and logging
 */
const GPT5_MINI_PRICING = {
  inputTokensPerDollar: 1000000 / 0.15,  // ~6.67M tokens per $1 for input
  outputTokensPerDollar: 1000000 / 0.60, // ~1.67M tokens per $1 for output
  avgInputOutputRatio: 0.3 // Assume 30% of tokens are output
};

/**
 * Calculate cost from tokens for logging purposes
 */
function calculateCostFromTokens(totalTokens: number): number {
  const inputTokens = Math.round(totalTokens * (1 - GPT5_MINI_PRICING.avgInputOutputRatio));
  const outputTokens = Math.round(totalTokens * GPT5_MINI_PRICING.avgInputOutputRatio);
  
  const inputCost = inputTokens / GPT5_MINI_PRICING.inputTokensPerDollar;
  const outputCost = outputTokens / GPT5_MINI_PRICING.outputTokensPerDollar;
  
  return inputCost + outputCost;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey",
};

interface FastingSession {
  id: string;
  start_time: string;
  end_time: string | null;
  target_hours: number;
  actual_duration_hours: number | null;
  protocol_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  notes: string | null;
}

interface UserProfile {
  weight_kg?: number;
  height_cm?: number;
  objective?: string;
  activity_level?: string;
  sex?: string;
  birthdate?: string;
  emotions?: {
    chronotype?: string;
    stress?: number;
    sleepHours?: number;
  };
  nutrition?: {
    diet?: string;
    fastingWindow?: {
      protocol?: string;
      windowHours?: number;
    };
  };
}

interface FastingProgressionMetrics {
  totalSessions: number;
  totalFastedHours: number;
  averageDuration: number;
  longestFast: number;
  bestStreak: number;
  currentStreak: number;
  successRate: number;
  consistencyScore: number;
}

interface FastingProgressionAnalysis {
  narrativeSummary: string;
  trendAnalysis: string;
  performanceInsights: string[];
  strategicRecommendations: string[];
  motivationalMessage: string;
  nextMilestone: string;
}

interface FastingProgressionResponse {
  metrics: FastingProgressionMetrics;
  aiAnalysis: FastingProgressionAnalysis;
  dataQuality: 'excellent' | 'good' | 'limited' | 'insufficient';
  analysisDate: string;
  periodDays: number;
  aiModel: string;
  tokensUsed: number;
  cached: boolean;
}

/**
 * Calculate progression metrics
 */
function calculateProgressionMetrics(sessions: FastingSession[]): FastingProgressionMetrics {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalFastedHours: 0,
      averageDuration: 0,
      longestFast: 0,
      bestStreak: 0,
      currentStreak: 0,
      successRate: 0,
      consistencyScore: 0
    };
  }

  const completedSessions = sessions.filter(s => s.status === 'completed' && s.actual_duration_hours);
  const totalFastedHours = completedSessions.reduce((sum, s) => sum + (s.actual_duration_hours || 0), 0);
  const averageDuration = completedSessions.length > 0 ? totalFastedHours / completedSessions.length : 0;
  const longestFast = Math.max(0, ...completedSessions.map(s => s.actual_duration_hours || 0));

  // Calculate success rate
  const successfulSessions = completedSessions.filter(s => 
    s.actual_duration_hours && s.target_hours && 
    (s.actual_duration_hours / s.target_hours) >= 0.9
  );
  const successRate = completedSessions.length > 0 ? 
    (successfulSessions.length / completedSessions.length) * 100 : 0;

  // Simple streak calculation
  const sessionDates = completedSessions.map(s => s.start_time.split('T')[0]);
  const uniqueDates = [...new Set(sessionDates)].sort();
  
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  
  for (let i = 0; i < uniqueDates.length; i++) {
    if (i === 0 || 
        new Date(uniqueDates[i]).getTime() - new Date(uniqueDates[i-1]).getTime() === 24 * 60 * 60 * 1000) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);
  
  // Current streak from today backwards
  const today = new Date().toISOString().split('T')[0];
  if (uniqueDates.includes(today)) {
    currentStreak = 1;
    for (let i = uniqueDates.length - 2; i >= 0; i--) {
      const dayDiff = (new Date(uniqueDates[i+1]).getTime() - new Date(uniqueDates[i]).getTime()) / (24 * 60 * 60 * 1000);
      if (dayDiff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Consistency score
  const consistencyScore = Math.round((successRate * 0.7) + (Math.min(100, (uniqueDates.length / 30) * 100) * 0.3));

  return {
    totalSessions: sessions.length,
    totalFastedHours: Math.round(totalFastedHours * 10) / 10,
    averageDuration: Math.round(averageDuration * 10) / 10,
    longestFast: Math.round(longestFast * 10) / 10,
    bestStreak,
    currentStreak,
    successRate: Math.round(successRate),
    consistencyScore
  };
}

/**
 * Generate cache key for progression analysis
 */
function generateCacheKey(userId: string, periodDays: number, profile: UserProfile, sessions: FastingSession[]): string {
  const cacheData = {
    userId,
    periodDays,
    profileHash: {
      weight_kg: profile.weight_kg,
      height_cm: profile.height_cm,
      objective: profile.objective,
      activity_level: profile.activity_level,
      sex: profile.sex,
      chronotype: profile.emotions?.chronotype,
    },
    sessionsHash: sessions.map(s => ({
      target_hours: s.target_hours,
      actual_duration_hours: s.actual_duration_hours,
      status: s.status,
      protocol_id: s.protocol_id,
      date: s.start_time.split('T')[0]
    }))
  };
  
  return createHash('sha256').update(JSON.stringify(cacheData)).digest('hex');
}

/**
 * Check for cached progression analysis
 */
async function getCachedProgression(supabase: any, userId: string, inputHash: string): Promise<FastingProgressionResponse | null> {
  try {
    const { data, error } = await supabase
      .from('ai_analysis_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('analysis_type', 'fasting_progression')
      .eq('input_hash', inputHash)
      .eq('status', 'completed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Cache lookup error:', error);
      return null;
    }

    if (data && data.length > 0) {
      const cachedResult = data[0];
      console.log('FASTING_PROGRESSION_CACHE_HIT', 'Found cached progression', {
        userId,
        inputHash,
        cacheAge: Date.now() - new Date(cachedResult.created_at).getTime(),
        tokensUsed: cachedResult.result_payload?.tokensUsed || 0
      });

      return {
        ...cachedResult.result_payload,
        cached: true
      };
    }

    return null;
  } catch (error) {
    console.error('Cache lookup exception:', error);
    return null;
  }
}

/**
 * Store progression analysis in cache
 */
async function storeProgressionCache(
  supabase: any, 
  userId: string, 
  inputHash: string, 
  progression: FastingProgressionResponse,
  tokensUsed: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_analysis_jobs')
      .insert({
        user_id: userId,
        analysis_type: 'fasting_progression',
        status: 'completed',
        input_hash: inputHash,
        request_payload: {
          periodDays: progression.periodDays,
          timestamp: new Date().toISOString()
        },
        result_payload: {
          ...progression,
          tokensUsed,
          cached: false
        }
      });

    if (error) {
      console.error('Cache storage error:', error);
    } else {
      console.log('FASTING_PROGRESSION_CACHE_STORE', 'Progression cached successfully', {
        userId,
        inputHash,
        tokensUsed
      });
    }
  } catch (error) {
    console.error('Cache storage exception:', error);
  }
}

/**
 * Build AI prompt for progression analysis
 */
function buildProgressionPrompt(
  profile: UserProfile, 
  sessions: FastingSession[], 
  metrics: FastingProgressionMetrics, 
  periodDays: number
): string {
  const completedSessions = sessions.filter(s => s.status === 'completed' && s.actual_duration_hours);
  
  // Calculate weekly trends
  const weeklyData = [];
  for (let week = 0; week < Math.ceil(periodDays / 7); week++) {
    const weekStart = new Date(Date.now() - (week + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(Date.now() - week * 7 * 24 * 60 * 60 * 1000);
    
    const weekSessions = completedSessions.filter(s => {
      const sessionDate = new Date(s.start_time);
      return sessionDate >= weekStart && sessionDate < weekEnd;
    });
    
    const weekHours = weekSessions.reduce((sum, s) => sum + (s.actual_duration_hours || 0), 0);
    weeklyData.push({
      week: week + 1,
      sessions: weekSessions.length,
      totalHours: weekHours,
      avgDuration: weekSessions.length > 0 ? weekHours / weekSessions.length : 0
    });
  }

  return `Tu es un expert en jeûne intermittent et en analyse de performance métabolique. Analyse la progression de cet utilisateur et génère une analyse narrative détaillée.

PROFIL UTILISATEUR:
- Sexe: ${profile.sex || 'Non spécifié'}
- Poids: ${profile.weight_kg || 'Non spécifié'} kg
- Taille: ${profile.height_cm || 'Non spécifié'} cm
- Objectif: ${profile.objective || 'Non spécifié'}
- Niveau d'activité: ${profile.activity_level || 'Non spécifié'}
- Chronotype: ${profile.emotions?.chronotype || 'Non spécifié'}
- Protocole préféré: ${profile.nutrition?.fastingWindow?.protocol || 'Non spécifié'}

MÉTRIQUES DE PROGRESSION (${periodDays} derniers jours):
- Sessions totales: ${metrics.totalSessions}
- Sessions complétées: ${completedSessions.length}
- Temps total jeûné: ${metrics.totalFastedHours}h
- Durée moyenne: ${metrics.averageDuration}h
- Record personnel: ${metrics.longestFast}h
- Série actuelle: ${metrics.currentStreak} jours
- Meilleure série: ${metrics.bestStreak} jours
- Taux de succès: ${metrics.successRate}%
- Score de consistance: ${metrics.consistencyScore}/100

ÉVOLUTION HEBDOMADAIRE:
${weeklyData.map(w => 
  `Semaine -${w.week}: ${w.sessions} sessions, ${w.totalHours.toFixed(1)}h total, ${w.avgDuration.toFixed(1)}h moyenne`
).join('\n')}

INSTRUCTIONS:
1. Génère un résumé narratif de la progression globale
2. Analyse les tendances (amélioration, stagnation, régression)
3. Identifie 3-5 insights de performance spécifiques
4. Propose 3-4 recommandations stratégiques actionnables
5. Crée un message motivationnel personnalisé
6. Suggère le prochain objectif/milestone réaliste
7. Adapte ton analyse au profil et aux objectifs de l'utilisateur
8. Sois encourageant mais précis dans tes observations

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "narrativeSummary": string,
  "trendAnalysis": string,
  "performanceInsights": string[],
  "strategicRecommendations": string[],
  "motivationalMessage": string,
  "nextMilestone": string
}`;
}

/**
 * Call OpenAI GPT-5 mini for progression analysis
 */
async function generateProgressionAnalysis(
  profile: UserProfile, 
  sessions: FastingSession[], 
  metrics: FastingProgressionMetrics,
  periodDays: number
): Promise<{ analysis: FastingProgressionAnalysis; tokensUsed: number }> {
  const prompt = buildProgressionPrompt(profile, sessions, metrics, periodDays);
  
  console.log('FASTING_PROGRESSION_ANALYZER', 'Calling OpenAI API', {
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500),
    model: 'gpt-5-mini',
    sessionsCount: sessions.length,
    metricsProvided: !!metrics,
    profileProvided: !!profile,
    timestamp: new Date().toISOString()
  });

  console.log('FASTING_PROGRESSION_ANALYZER', 'Full prompt being sent to OpenAI', {
    fullPrompt: prompt,
    timestamp: new Date().toISOString()
  });
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: 'Tu es un expert en jeûne intermittent et en analyse de performance métabolique. Tu analyses les données de progression et génères des insights narratifs personnalisés.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 2500,
      response_format: { type: 'json_object' }
    }),
  });

  console.log('FASTING_PROGRESSION_ANALYZER', 'OpenAI API response received', {
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    timestamp: new Date().toISOString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('FASTING_PROGRESSION_ANALYZER', 'OpenAI API error', {
      status: response.status,
      statusText: response.statusText,
      errorText,
      requestBody: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [{ role: 'system', content: 'Tu es un expert...' }, { role: 'user', content: prompt.substring(0, 200) + '...' }],
        max_completion_tokens: 2500
      }),
      timestamp: new Date().toISOString()
    });
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  console.log('FASTING_PROGRESSION_ANALYZER', 'OpenAI raw response data', {
    hasChoices: !!data.choices,
    choicesLength: data.choices?.length || 0,
    hasUsage: !!data.usage,
    totalTokens: data.usage?.total_tokens || 0,
    rawResponse: data,
    timestamp: new Date().toISOString()
  });

  console.log('FASTING_PROGRESSION_ANALYZER', 'OpenAI response parsed', {
    hasChoices: !!data.choices,
    choicesLength: data.choices?.length || 0,
    hasUsage: !!data.usage,
    totalTokens: data.usage?.total_tokens || 0,
    timestamp: new Date().toISOString()
  });

  // Validate that we have a proper response with content
  if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
    console.error('FASTING_PROGRESSION_ANALYZER', 'Invalid OpenAI response structure', {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      hasFirstChoice: !!data.choices?.[0],
      hasMessage: !!data.choices?.[0]?.message,
      hasContent: !!data.choices?.[0]?.message?.content,
      fullResponse: data,
      timestamp: new Date().toISOString()
    });
    throw new Error('Invalid OpenAI API response: missing content');
  }
  
  const content = data.choices[0].message.content.trim();
  if (!content) {
    console.error('FASTING_PROGRESSION_ANALYZER', 'Empty content from OpenAI', {
      fullResponse: data,
      timestamp: new Date().toISOString()
    });
    throw new Error('Empty response from OpenAI API');
  }
  
  console.log('FASTING_PROGRESSION_ANALYZER', 'Parsing AI response content', {
    contentLength: content.length,
    contentPreview: content.substring(0, 500),
    fullContent: content,
    timestamp: new Date().toISOString()
  });

  let aiResponse;
  try {
    aiResponse = JSON.parse(content);
  } catch (parseError) {
    console.error('FASTING_PROGRESSION_ANALYZER', 'JSON parsing failed', {
      parseError: parseError instanceof Error ? parseError.message : 'Unknown error',
      contentLength: content.length,
      rawContent: content,
      parseErrorStack: parseError instanceof Error ? parseError.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }
  
  const tokensUsed = data.usage?.total_tokens || 0;

  console.log('FASTING_PROGRESSION_ANALYZER', 'AI response successfully parsed', {
    tokensUsed,
    hasNarrativeSummary: !!aiResponse.narrativeSummary,
    hasTrendAnalysis: !!aiResponse.trendAnalysis,
    performanceInsightsCount: aiResponse.performanceInsights?.length || 0,
    strategicRecommendationsCount: aiResponse.strategicRecommendations?.length || 0,
    parsedResponse: aiResponse,
    timestamp: new Date().toISOString()
  });

  return { analysis: aiResponse, tokensUsed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('FASTING_PROGRESSION_ANALYZER', 'Edge Function called', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });

    const { userId, periodDays, profile } = await req.json();

    console.log('FASTING_PROGRESSION_ANALYZER', 'Request received with full payload', {
      userId,
      periodDays,
      hasProfile: !!profile,
      profileKeys: profile ? Object.keys(profile) : [],
      profileData: profile ? {
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        objective: profile.objective,
        activity_level: profile.activity_level,
        sex: profile.sex
      } : null,
      timestamp: new Date().toISOString()
    });

    if (!userId || !periodDays) {
      console.error('FASTING_PROGRESSION_ANALYZER', 'Missing required parameters', {
        userId,
        periodDays,
        timestamp: new Date().toISOString()
      });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: userId, periodDays' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('FASTING_PROGRESSION_ANALYZER', 'Starting progression analysis', {
      userId,
      periodDays,
      hasProfile: !!profile,
      supabaseConfigured: !!(Deno.env.get('SUPABASE_URL') && Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
      timestamp: new Date().toISOString()
    });

    // TOKEN PRE-CHECK
    const estimatedTokens = 50;
    const tokenCheck = await checkTokenBalance(supabase, userId, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('FASTING_PROGRESSION_ANALYZER', 'Insufficient tokens', {
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

    // Fetch fasting sessions for the period
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    console.log('FASTING_PROGRESSION_ANALYZER', 'Fetching sessions', {
      userId,
      startDate,
      endDate,
      timestamp: new Date().toISOString()
    });

    const { data: sessions, error: sessionsError } = await supabase
      .from('fasting_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    if (sessionsError) {
      console.error('FASTING_PROGRESSION_ANALYZER', 'Failed to fetch sessions', {
        error: sessionsError.message,
        userId,
        periodDays
      });
      throw new Error(`Failed to fetch fasting sessions: ${sessionsError.message}`);
    }

    const fastingSessions = sessions || [];

    console.log('FASTING_PROGRESSION_ANALYZER', 'Sessions fetched', {
      userId,
      totalSessions: fastingSessions.length,
      completedSessions: fastingSessions.filter(s => s.status === 'completed').length,
      sessionsData: fastingSessions.map(s => ({
        date: s.start_time.split('T')[0],
        status: s.status,
        target_hours: s.target_hours,
        actual_duration_hours: s.actual_duration_hours
      })),
      timestamp: new Date().toISOString()
    });

    // Calculate metrics
    const metrics = calculateProgressionMetrics(fastingSessions);

    console.log('FASTING_PROGRESSION_ANALYZER', 'Metrics calculated', {
      userId,
      metrics,
      timestamp: new Date().toISOString()
    });

    // Check data sufficiency
    const completedSessions = fastingSessions.filter(s => s.status === 'completed');
    const minSessionsRequired = periodDays === 7 ? 3 : periodDays === 30 ? 8 : 15;
    
    console.log('FASTING_PROGRESSION_ANALYZER', 'Data sufficiency check', {
      userId,
      completedSessions: completedSessions.length,
      minSessionsRequired,
      willProceedWithAI: completedSessions.length >= minSessionsRequired,
      profileValidation: {
        hasProfile: !!profile,
        hasWeightKg: !!profile?.weight_kg,
        hasHeightCm: !!profile?.height_cm,
        hasObjective: !!profile?.objective
      },
      timestamp: new Date().toISOString()
    });

    if (completedSessions.length < minSessionsRequired) {
      console.log('FASTING_PROGRESSION_ANALYZER', 'Insufficient data for AI analysis', {
        userId,
        periodDays,
        completedSessions: completedSessions.length,
        minRequired: minSessionsRequired,
        minRequired: minSessionsRequired
      });

      return new Response(
        JSON.stringify({
          metrics,
          aiAnalysis: {
            narrativeSummary: 'Données insuffisantes pour une analyse IA complète.',
            trendAnalysis: `Complétez au moins ${minSessionsRequired} sessions pour débloquer l'analyse de tendances.`,
            performanceInsights: ['Plus de données nécessaires pour des insights précis'],
            strategicRecommendations: ['Continuez à pratiquer le jeûne régulièrement'],
            motivationalMessage: 'Chaque session compte ! Continuez à forger votre discipline temporelle.',
            nextMilestone: `Objectif : ${minSessionsRequired} sessions complétées`
          },
          dataQuality: 'insufficient',
          analysisDate: new Date().toISOString(),
          periodDays,
          aiModel: 'gpt-5-mini',
          tokensUsed: 0,
          cached: false
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else if (shouldBypass) {
    }

    // Validate profile data for AI prompt construction
    if (!profile) {
      console.error('FASTING_PROGRESSION_ANALYZER', 'No profile data provided', {
        userId,
        periodDays,
        bypassMinData,
        timestamp: new Date().toISOString()
      });
      throw new Error('Profile data is required for AI analysis');
    }

    console.log('FASTING_PROGRESSION_ANALYZER', 'Profile validation passed', {
      userId,
      profileData: {
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        objective: profile.objective,
        activity_level: profile.activity_level,
        sex: profile.sex,
        hasEmotions: !!profile.emotions,
        hasNutrition: !!profile.nutrition
      },
      profileComplete: !!(profile.weight_kg && profile.height_cm && profile.objective),
      timestamp: new Date().toISOString()
    });

    // Generate cache key
    const inputHash = generateCacheKey(userId, periodDays, profile, fastingSessions);

    console.log('FASTING_PROGRESSION_ANALYZER', 'Cache key generated', {
      userId,
      inputHash,
      timestamp: new Date().toISOString()
    });

    // Check for cached results
    const cachedProgression = await getCachedProgression(supabase, userId, inputHash);
    if (cachedProgression) {
      console.log('FASTING_PROGRESSION_ANALYZER', 'Returning cached progression', {
        userId,
        periodDays,
        inputHash,
        cacheAge: Date.now() - new Date(cachedProgression.analysisDate).getTime()
      });

      return new Response(
        JSON.stringify(cachedProgression),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate new progression analysis with AI
    console.log('FASTING_PROGRESSION_ANALYZER', 'Generating new AI progression analysis', {
      userId,
      periodDays,
      sessionsCount: fastingSessions.length,
      completedSessions: completedSessions.length,
      bypassEnabled: shouldBypass,
      metrics
    });

    // Validate OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('FASTING_PROGRESSION_ANALYZER', 'OpenAI API key not configured', {
        userId,
        periodDays,
        bypassMinData,
        timestamp: new Date().toISOString()
      });
      throw new Error('OpenAI API key not configured');
    }

    console.log('FASTING_PROGRESSION_ANALYZER', 'OpenAI API key validated, calling AI', {
      userId,
      periodDays,
      hasApiKey: !!openaiApiKey,
      apiKeyLength: openaiApiKey.length,
      aboutToCallOpenAI: true,
      timestamp: new Date().toISOString()
    });

    const { analysis, tokensUsed } = await generateProgressionAnalysis(profile, fastingSessions, metrics, periodDays);

    // Calculate cost
    const estimatedCostUSD = calculateCostFromTokens(tokensUsed);

    // TOKEN CONSUMPTION
    const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
      userId,
      edgeFunctionName: 'fasting-progression-analyzer',
      operationType: 'fasting_progression',
      openaiModel: 'gpt-5-mini',
      openaiInputTokens: Math.round(tokensUsed * 0.7),
      openaiOutputTokens: Math.round(tokensUsed * 0.3),
      openaiCostUsd: estimatedCostUSD,
      metadata: {
        periodDays,
        sessionsCount: fastingSessions.length,
        completedSessions: completedSessions.length
      }
    });

    console.log('💰 [FASTING_PROGRESSION] Tokens consumed', {
      userId,
      tokensUsed,
      costUsd: estimatedCostUSD.toFixed(6)
    });

    console.log('FASTING_PROGRESSION_ANALYZER', 'AI analysis completed', {
      userId,
      periodDays,
      tokensUsed,
      hasAnalysis: !!analysis,
      analysisKeys: analysis ? Object.keys(analysis) : [],
      openAICallSuccessful: true,
      timestamp: new Date().toISOString()
    });

    const progressionResponse: FastingProgressionResponse = {
      metrics,
      aiAnalysis: analysis,
      dataQuality: completedSessions.length >= 15 ? 'excellent' :
                  completedSessions.length >= 8 ? 'good' : 'limited',
      analysisDate: new Date().toISOString(),
      periodDays,
      aiModel: 'gpt-5-mini',
      tokensUsed,
      cached: false,
      tokens_consumed: estimatedTokens
    };

    // Store in cache
    console.log('FASTING_PROGRESSION_ANALYZER', 'Storing in cache', {
      userId,
      inputHash,
      tokensUsed,
      timestamp: new Date().toISOString()
    });

    await storeProgressionCache(supabase, userId, inputHash, progressionResponse, tokensUsed);

    // Calculate and log cost information for dashboard monitoring
    const estimatedCostUSD = calculateCostFromTokens(tokensUsed);
    
    console.log('FASTING_PROGRESSION_COST_AUDIT', 'AI generation cost calculated', {
      userId,
      analysisType: 'fasting_progression',
      periodDays,
      tokensUsed,
      estimatedCostUSD: Math.round(estimatedCostUSD * 100000) / 100000, // 5 decimal precision
      model: 'gpt-5-mini',
      cached: false,
      timestamp: new Date().toISOString(),
      philosophy: 'ai_cost_transparency_audit'
    });

    console.log('FASTING_PROGRESSION_ANALYZER', 'AI progression analysis generated successfully', {
      userId,
      periodDays,
      tokensUsed,
      consistencyScore: metrics.consistencyScore
    });

    return new Response(
      JSON.stringify(progressionResponse),
      {
        status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('FASTING_PROGRESSION_ANALYZER', 'Analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate progression analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});