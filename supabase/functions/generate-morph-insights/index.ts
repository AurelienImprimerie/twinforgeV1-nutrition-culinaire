import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

interface ScanData {
  final_shape_params: Record<string, number>;
  final_limb_masses: Record<string, number>;
  skin_tone?: {
    rgb: { r: number; g: number; b: number };
    hex: string;
    confidence?: number;
    source?: string;
  };
  resolved_gender: 'male' | 'female';
  avatar_version?: string;
  scan_id?: string;
  photo_urls?: string[];
}

interface UserProfile {
  user_id: string;
  age?: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  target_weight_kg?: number;
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  objective?: 'fat_loss' | 'recomp' | 'muscle_gain';
  bmi?: number;
  goals?: Record<string, any>;
  health?: Record<string, any>;
  emotions?: Record<string, any>;
  nutrition?: Record<string, any>;
}

interface MorphInsight {
  id: string;
  title: string;
  description: string;
  type: 'recommendation' | 'observation' | 'achievement' | 'goal_progress';
  category: 'morphology' | 'fitness' | 'nutrition' | 'health' | 'goals';
  priority: 'high' | 'medium' | 'low';
  value?: string;
  icon: string;
  color: string;
  confidence: number;
  actionable?: {
    action: string;
    description: string;
  };
}

interface InsightsResponse {
  insights: MorphInsight[];
  summary: {
    morphology_score: number;
    goal_alignment: number;
    health_indicators: number;
    recommendations_count: number;
  };
  metadata: {
    generated_at: string;
    ai_model: string;
    confidence: number;
  };
  fallback_used?: boolean;
}

interface CachedInsight {
  id: string;
  scan_id: string;
  user_id: string;
  generated_at: string;
  insights_data: MorphInsight[];
  summary_data: InsightsResponse['summary'];
  ai_model_used: string;
  ai_confidence: number;
  input_hash: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey",
};

/**
 * Calculate a unique hash for input data to enable caching
 */
function calculateInputHash(scanData: ScanData, userProfile: UserProfile): string {
  const inputData = {
    scan_data: {
      final_shape_params: scanData.final_shape_params,
      final_limb_masses: scanData.final_limb_masses,
      skin_tone: scanData.skin_tone,
      resolved_gender: scanData.resolved_gender,
      photo_urls: scanData.photo_urls || []
    },
    user_profile: {
      user_id: userProfile.user_id,
      age: userProfile.age,
      sex: userProfile.sex,
      height_cm: userProfile.height_cm,
      weight_kg: userProfile.weight_kg,
      target_weight_kg: userProfile.target_weight_kg,
      activity_level: userProfile.activity_level,
      objective: userProfile.objective,
      bmi: userProfile.bmi
    }
  };
  
  const inputString = JSON.stringify(inputData, Object.keys(inputData).sort());
  return createHash('sha256').update(inputString).digest('hex');
}

/**
 * Initialize Supabase client
 */
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Check cache for existing insights
 */
async function getCachedInsights(supabase: any, scanId: string, inputHash: string): Promise<CachedInsight | null> {
  try {
    const { data, error } = await supabase
      .from('ai_morphology_insights')
      .select('*')
      .eq('scan_id', scanId)
      .eq('input_hash', inputHash)
      .single();

    if (error) {
      console.log('No cached insights found:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error checking cache:', error);
    return null;
  }
}

/**
 * Store insights in cache
 */
async function storeCachedInsights(
  supabase: any,
  scanId: string,
  userId: string,
  inputHash: string,
  insights: MorphInsight[],
  summary: InsightsResponse['summary'],
  aiModel: string,
  confidence: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_morphology_insights')
      .insert({
        scan_id: scanId,
        user_id: userId,
        input_hash: inputHash,
        insights_data: insights,
        summary_data: summary,
        ai_model_used: aiModel,
        ai_confidence: confidence
      });

    if (error) {
      console.error('Error storing cached insights:', error);
    } else {
      console.log('✅ Insights cached successfully');
    }
  } catch (error) {
    console.error('Error storing cached insights:', error);
  }
}

/**
 * Build prompt for GPT-5 mini
 */
function buildGPT5MiniPrompt(scanData: ScanData, userProfile: UserProfile): any[] {
  const messages = [
    {
      role: "system",
      content: `Tu es un expert en morphologie corporelle et coach bien-être. Tu analyses des scans 3D corporels et génères des insights personnalisés en français.

INSTRUCTIONS IMPORTANTES SUR LE LANGAGE ET LE TON :
- Utilise UNIQUEMENT un langage simple et accessible, compréhensible par tous
- ÉVITE absolument les termes techniques comme "bodybuilderSize", "emaciated", "pearFigure", etc.
- Remplace les termes techniques par des expressions courantes :
  * "bodybuilderSize" → "développement musculaire" ou "masse musculaire"
  * "emaciated" → "minceur" ou "faible masse corporelle"
  * "pearFigure" → "silhouette en poire" ou "hanches plus larges"
  * "appleFigure" → "silhouette en pomme" ou "taille plus large"
  * "athletic" → "sportif" ou "en forme"
- Ton OBLIGATOIREMENT positif et motivant
- Mets l'accent sur les progrès possibles et le potentiel de l'utilisateur
- Évite tout langage critique ou décourageant
- Encourage l'utilisation des fonctionnalités de l'app pour le suivi
- Formule les conseils comme des opportunités d'amélioration, pas des défauts

Tu dois retourner une réponse JSON avec cette structure exacte:
{
  "insights": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "type": "recommendation|observation|achievement|goal_progress",
      "category": "morphology|fitness|nutrition|health|goals",
      "priority": "high|medium|low",
      "value": "string",
      "icon": "string",
      "color": "string",
      "confidence": number,
      "actionable": {
        "action": "string",
        "description": "string"
      }
    }
  ],
  "summary": {
    "morphology_score": number,
    "goal_alignment": number,
    "health_indicators": number,
    "recommendations_count": number
  }
}

Génère 8-12 insights variés et personnalisés. Utilise des couleurs hex comme #8B5CF6, #10B981, #F59E0B. Pour les icônes, utilise des noms comme "Zap", "TrendingUp", "Target", "Activity", "Check", "Circle", "Palette".`
    },
    {
      role: "user",
      content: `Analyse ces données de scan corporel et profil utilisateur:

**Données de scan:**
- Paramètres morphologiques: ${JSON.stringify(scanData.final_shape_params)}
- Masses des membres: ${JSON.stringify(scanData.final_limb_masses)}
- Genre résolu: ${scanData.resolved_gender}
- Teint de peau: ${scanData.skin_tone ? JSON.stringify(scanData.skin_tone) : 'Non disponible'}

**Profil utilisateur:**
- Âge: ${userProfile.age || 'Non spécifié'}
- Sexe: ${userProfile.sex}
- Taille: ${userProfile.height_cm}cm
- Poids: ${userProfile.weight_kg}kg
- Poids cible: ${userProfile.target_weight_kg || 'Non spécifié'}kg
- Niveau d'activité: ${userProfile.activity_level || 'Non spécifié'}
- Objectif: ${userProfile.objective || 'Non spécifié'}
- IMC: ${userProfile.bmi || 'Non calculé'}

Génère des insights personnalisés et actionnables en français.`
    }
  ];

  // Add image analysis if photo URLs are available
  if (scanData.photo_urls && scanData.photo_urls.length > 0) {
    const imageContent = scanData.photo_urls.map(url => ({
      type: "image_url",
      image_url: { url }
    }));

    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: "Analyse également ces photos du scan corporel pour enrichir tes insights:"
        },
        ...imageContent
      ]
    });
  }

  return messages;
}

/**
 * Call GPT-5 mini API
 */
async function callGPT5Mini(scanData: ScanData, userProfile: UserProfile): Promise<InsightsResponse> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const messages = buildGPT5MiniPrompt(scanData, userProfile);

  const requestBody = {
    model: "gpt-5-mini",
    messages: messages,
    response_format: { type: "json_object" },
    max_completion_tokens: 4000
  };

  console.log('🤖 Calling GPT-5 mini API with optimized parameters...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GPT-5 mini API error:', response.status, errorText);
    throw new Error(`GPT-5 mini API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.choices || !result.choices[0] || !result.choices[0].message) {
    throw new Error('Invalid response from GPT-5 mini API');
  }

  const content = result.choices[0].message.content;
  const parsedContent = JSON.parse(content);

  return {
    insights: parsedContent.insights,
    summary: parsedContent.summary,
    metadata: {
      generated_at: new Date().toISOString(),
      ai_model: 'gpt-5-mini',
      confidence: 0.9
    },
    fallback_used: false
  };
}

/**
 * Fallback morphology analysis (existing logic)
 */
function analyzeMorphology(scanData: ScanData, userProfile: UserProfile): MorphInsight[] {
  const insights: MorphInsight[] = [];
  const shapeParams = scanData.final_shape_params || {};
  const limbMasses = scanData.final_limb_masses || {};
  
  // 1. Body Composition Analysis
  const bodybuilderSize = shapeParams.bodybuilderSize || 0;
  const emaciated = shapeParams.emaciated || 0;
  const pearFigure = shapeParams.pearFigure || 0;
  
  if (bodybuilderSize > 0.3) {
    insights.push({
      id: 'muscle-development',
      title: 'Développement Musculaire Excellent',
      description: `Votre scan révèle un développement musculaire remarquable (score: ${(bodybuilderSize * 100).toFixed(0)}%). Votre morphologie indique un excellent potentiel athlétique.`,
      type: 'achievement',
      category: 'morphology',
      priority: 'high',
      value: 'Développé',
      icon: 'Zap',
      color: '#8B5CF6',
      confidence: 0.92,
      actionable: {
        action: 'Optimiser l\'entraînement',
        description: 'Programme adapté à votre morphologie musculaire'
      }
    });
  } else if (emaciated < -0.5) {
    insights.push({
      id: 'lean-physique',
      title: 'Physique Lean Défini',
      description: `Votre morphologie révèle une composition corporelle très définie. Excellent pour la définition musculaire et la performance athlétique.`,
      type: 'observation',
      category: 'morphology',
      priority: 'medium',
      value: 'Défini',
      icon: 'TrendingUp',
      color: '#10B981',
      confidence: 0.88
    });
  }
  
  // 2. BMI Analysis
  if (userProfile.bmi) {
    const bmi = userProfile.bmi;
    let bmiInsight: MorphInsight;
    
    if (bmi >= 18.5 && bmi < 25) {
      bmiInsight = {
        id: 'bmi-optimal',
        title: 'IMC dans la Zone Optimale',
        description: `Votre IMC de ${bmi.toFixed(1)} se situe dans la plage idéale. Votre morphologie actuelle est excellente pour maintenir une santé optimale.`,
        type: 'achievement',
        category: 'health',
        priority: 'high',
        value: bmi.toFixed(1),
        icon: 'Check',
        color: '#22C55E',
        confidence: 0.95
      };
    } else {
      bmiInsight = {
        id: 'bmi-optimization',
        title: 'Opportunité d\'Optimisation',
        description: `Votre IMC de ${bmi.toFixed(1)} offre une excellente base pour une transformation corporelle. Votre morphologie actuelle a un potentiel d'amélioration significatif.`,
        type: 'recommendation',
        category: 'health',
        priority: 'high',
        value: bmi.toFixed(1),
        icon: 'Target',
        color: '#F59E0B',
        confidence: 0.88,
        actionable: {
          action: 'Plan de transformation',
          description: 'Programme personnalisé basé sur votre scan'
        }
      };
    }
    
    insights.push(bmiInsight);
  }
  
  return insights;
}

/**
 * Calculate summary metrics
 */
function calculateSummary(insights: MorphInsight[], userProfile: UserProfile): InsightsResponse['summary'] {
  const morphologyInsights = insights.filter(i => i.category === 'morphology');
  const healthInsights = insights.filter(i => i.category === 'health');
  const recommendationsCount = insights.filter(i => i.type === 'recommendation').length;
  
  const morphologyScore = morphologyInsights.length > 0 ? 
    morphologyInsights.reduce((sum, insight) => sum + insight.confidence, 0) / morphologyInsights.length : 0.8;
  
  const hasGoals = !!(userProfile.target_weight_kg || userProfile.objective);
  const goalAlignment = hasGoals ? 0.85 : 0.5;
  
  const healthIndicators = healthInsights.length > 0 ?
    healthInsights.reduce((sum, insight) => sum + insight.confidence, 0) / healthInsights.length : 0.75;
  
  return {
    morphology_score: morphologyScore,
    goal_alignment: goalAlignment,
    health_indicators: healthIndicators,
    recommendations_count: recommendationsCount
  };
}

/**
 * Generate fallback insights
 */
function generateFallbackInsights(scanData: ScanData, userProfile: UserProfile): InsightsResponse {
  console.log('🔄 Using fallback morphology analysis...');
  
  const insights = analyzeMorphology(scanData, userProfile);
  const summary = calculateSummary(insights, userProfile);
  
  return {
    insights,
    summary,
    metadata: {
      generated_at: new Date().toISOString(),
      ai_model: 'analytical_fallback_v1.0',
      confidence: 0.75
    },
    fallback_used: true
  };
}

/**
 * Main Edge Function handler
 */
Deno.serve(async (req: Request) => {
  console.log('🚀 Generate Morph Insights - Function started', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method === "OPTIONS") {
    console.log('✅ CORS preflight request handled');
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('📥 Parsing request body...');
    const { scan_data, user_profile, analysis_config } = await req.json();
    
    console.log('✅ Generate Morph Insights - Request received:', {
      hasScanData: !!scan_data,
      hasUserProfile: !!user_profile,
      userId: user_profile?.user_id,
      scanId: scan_data?.scan_id,
      analysisConfig: analysis_config
    });

    // Validate input data
    if (!scan_data || !user_profile) {
      console.log('❌ Validation failed: Missing required data');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required data: scan_data and user_profile are required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!user_profile.user_id || !scan_data.scan_id) {
      console.log('❌ Validation failed: Missing user_id or scan_id');
      return new Response(
        JSON.stringify({
          error: 'Missing user_id in user_profile or scan_id in scan_data'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // TOKEN PRE-CHECK
    const estimatedTokens = 55;
    const tokenCheck = await checkTokenBalance(supabase, user_profile.user_id, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('GENERATE_MORPH_INSIGHTS', 'Insufficient tokens', {
        userId: user_profile.user_id,
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

    // Calculate input hash for caching
    const inputHash = calculateInputHash(scan_data, user_profile);
    console.log('🔍 Input hash calculated:', inputHash.substring(0, 8) + '...');

    // Check cache first
    console.log('🔍 Checking cache for existing insights...');
    const cachedInsights = await getCachedInsights(supabase, scan_data.scan_id, inputHash);
    
    if (cachedInsights) {
      console.log('✅ Found cached insights, returning from cache');
      const response: InsightsResponse = {
        insights: cachedInsights.insights_data,
        summary: cachedInsights.summary_data,
        metadata: {
          generated_at: cachedInsights.generated_at,
          ai_model: cachedInsights.ai_model_used,
          confidence: cachedInsights.ai_confidence
        },
        fallback_used: cachedInsights.ai_model_used.includes('fallback')
      };

      return new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // No cache found, generate new insights
    console.log('🧠 No cache found, generating new insights with GPT-5 mini...');
    
    let insights: InsightsResponse;
    
    try {
      // Try GPT-5 mini first
      insights = await callGPT5Mini(scan_data, user_profile);
      console.log('✅ GPT-5 mini insights generated successfully');

      // TOKEN CONSUMPTION - Only if not fallback
      if (!insights.fallback_used && insights.metadata.tokens_used) {
        const tokensUsed = insights.metadata.tokens_used;
        const costUsd = (tokensUsed.prompt_tokens / 1000000 * 0.25) + (tokensUsed.completion_tokens / 1000000 * 2.0);

        const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
          userId: user_profile.user_id,
          edgeFunctionName: 'generate-morph-insights',
          operationType: 'morph_insights',
          openaiModel: 'gpt-5-mini',
          openaiInputTokens: tokensUsed.prompt_tokens,
          openaiOutputTokens: tokensUsed.completion_tokens,
          openaiCostUsd: costUsd,
          metadata: {
            scanId: scan_data.scan_id,
            insightsCount: insights.insights?.length || 0
          }
        });

        console.log('💰 [MORPH_INSIGHTS] Tokens consumed', {
          userId: user_profile.user_id,
          tokensUsed: tokensUsed.total_tokens,
          costUsd: costUsd.toFixed(6)
        });
      }

      // Store in cache
      await storeCachedInsights(
        supabase,
        scan_data.scan_id,
        user_profile.user_id,
        inputHash,
        insights.insights,
        insights.summary,
        'gpt-5-mini',
        insights.metadata.confidence
      );
      
    } catch (error) {
      console.error('❌ GPT-5 mini failed, using fallback:', error.message);
      
      // Use fallback analysis
      insights = generateFallbackInsights(scan_data, user_profile);
      
      // Store fallback in cache
      await storeCachedInsights(
        supabase,
        scan_data.scan_id,
        user_profile.user_id,
        inputHash,
        insights.insights,
        insights.summary,
        'analytical_fallback_v1.0',
        insights.metadata.confidence
      );
    }
    
    console.log('✅ Generate Morph Insights - Insights generated:', {
      userId: user_profile.user_id,
      insightsCount: insights.insights.length,
      morphologyScore: insights.summary.morphology_score,
      recommendationsCount: insights.summary.recommendations_count,
      fallbackUsed: insights.fallback_used
    });

    console.log('📤 Sending response with insights');
    return new Response(
      JSON.stringify({
        ...insights,
        tokens_consumed: estimatedTokens
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Generate Morph Insights - Error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during insights generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});