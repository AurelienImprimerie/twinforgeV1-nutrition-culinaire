/**
 * Generate Voice Preview - Edge Function
 *
 * Génère un aperçu audio d'une voix OpenAI pour la prévisualisation dans les préférences
 * Utilise l'API OpenAI TTS (Text-to-Speech) pour générer de l'audio réel
 *
 * Endpoint: POST /generate-voice-preview
 * Body: { voice: string, text: string }
 * Returns: Audio file (audio/mpeg)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENAI_TTS_API = 'https://api.openai.com/v1/audio/speech';

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'generate-voice-preview',
    environment: 'production',
    message,
    ...data
  };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    log('info', 'Voice preview generation requested', { requestId });

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    const apikeyHeader = req.headers.get('apikey');

    if (!authHeader && !apikeyHeader) {
      log('error', 'Missing authentication', { requestId });
      return new Response(
        JSON.stringify({ error: 'Missing authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer la clé OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      log('error', 'OPENAI_API_KEY not configured', { requestId });
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer les paramètres
    const { voice, text, user_id } = await req.json();

    if (!voice || !text) {
      log('error', 'Missing required parameters', { requestId, hasVoice: !!voice, hasText: !!text });
      return new Response(
        JSON.stringify({ error: 'Missing voice or text parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    log('info', 'Generating voice preview', {
      requestId,
      voice,
      textLength: text.length,
      userId: user_id
    });

    // TOKEN PRE-CHECK - TTS pricing: $15/$1000 chars (tts-1)
    if (user_id) {
      const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const estimatedTokens = 25;
      const tokenCheck = await checkTokenBalance(supabase, user_id, estimatedTokens);

      if (!tokenCheck.hasEnoughTokens) {
        log('warn', 'Insufficient tokens for voice preview', {
          userId: user_id,
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
    }

    // Appeler l'API OpenAI TTS
    const response = await fetch(OPENAI_TTS_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // Modèle plus rapide pour les aperçus
        voice: voice,
        input: text,
        response_format: 'mp3',
        speed: 1.0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('error', 'OpenAI TTS API error', {
        requestId,
        status: response.status,
        error: errorText
      });
      return new Response(
        JSON.stringify({ error: 'Failed to generate voice preview' }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Récupérer l'audio
    const audioData = await response.arrayBuffer();

    // TOKEN CONSUMPTION - TTS: $15 per 1M chars
    if (user_id) {
      const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const charCount = text.length;
      const costUsd = (charCount / 1000000) * 15;

      await consumeTokensAtomic(supabase, {
        userId: user_id,
        edgeFunctionName: 'generate-voice-preview',
        operationType: 'voice_preview_generation',
        openaiModel: 'tts-1',
        openaiInputTokens: 0,
        openaiOutputTokens: 0,
        openaiCostUsd: costUsd,
        metadata: {
          voice,
          textLength: charCount,
          audioSize: audioData.byteLength
        }
      });

      log('info', 'Voice preview tokens consumed', {
        userId: user_id,
        charCount,
        costUsd: costUsd.toFixed(6)
      });
    }

    log('info', 'Voice preview generated successfully', {
      requestId,
      audioSize: audioData.byteLength
    });

    // Retourner l'audio
    return new Response(audioData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioData.byteLength.toString(),
      },
    });

  } catch (error) {
    log('error', 'Fatal error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
