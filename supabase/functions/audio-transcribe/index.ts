/**
 * Audio Transcribe Edge Function
 * Transcrit l'audio en texte en utilisant OpenAI Whisper API
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhisperResponse {
  text: string;
  language?: string;
  duration?: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("🎤 Audio Transcribe: Starting transcription request");

    // Vérifier la clé API OpenAI
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("❌ OpenAI API key not configured");
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parser le FormData
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    const userId = formData.get("user_id") as string | null;

    if (!audioFile || !(audioFile instanceof File)) {
      console.error("❌ No audio file provided");
      return new Response(
        JSON.stringify({ error: "No audio file provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!userId) {
      console.error("❌ No user_id provided");
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client for token management
    const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TOKEN PRE-CHECK - Whisper pricing: $0.006 per minute (estimate 1 min per 1MB)
    const estimatedMinutes = Math.ceil(audioFile.size / (1024 * 1024));
    const estimatedTokens = Math.ceil(estimatedMinutes * 0.006 * 5); // 30 tokens per minute
    const tokenCheck = await checkTokenBalance(supabase, userId, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('AUDIO_TRANSCRIBE', 'Insufficient tokens', {
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

    console.log("📁 Audio file received:", {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    });

    // Vérifier la taille du fichier (max 25MB pour Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      console.error("❌ Audio file too large:", audioFile.size);
      return new Response(
        JSON.stringify({ error: "Audio file too large (max 25MB)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Vérifier la taille minimale (1KB)
    if (audioFile.size < 1024) {
      console.error("❌ Audio file too small:", audioFile.size);
      return new Response(
        JSON.stringify({ error: "Audio file too small" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Préparer le FormData pour Whisper
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "fr"); // Français par défaut
    whisperFormData.append("response_format", "json");

    console.log("🚀 Sending to OpenAI Whisper API");

    // Appeler l'API Whisper
    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: whisperFormData,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("❌ Whisper API error:", {
        status: whisperResponse.status,
        error: errorText,
      });
      return new Response(
        JSON.stringify({
          error: "Transcription failed",
          details: errorText,
        }),
        {
          status: whisperResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const whisperResult: WhisperResponse = await whisperResponse.json();

    // TOKEN CONSUMPTION - Whisper: $0.006 per minute
    const actualDuration = whisperResult.duration || estimatedMinutes * 60;
    const actualMinutes = actualDuration / 60;
    const actualCostUsd = actualMinutes * 0.006;

    const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
      userId,
      edgeFunctionName: 'audio-transcribe',
      operationType: 'audio_transcription',
      openaiModel: 'whisper-1',
      openaiInputTokens: 0,
      openaiOutputTokens: 0,
      openaiCostUsd: actualCostUsd,
      metadata: {
        audioSize: audioFile.size,
        duration: actualDuration,
        textLength: whisperResult.text.length,
        language: whisperResult.language
      }
    });

    console.log("✅ Transcription successful:", {
      textLength: whisperResult.text.length,
      language: whisperResult.language,
      tokensConsumed: estimatedTokens,
      costUsd: actualCostUsd.toFixed(6)
    });

    return new Response(JSON.stringify({
      ...whisperResult,
      tokens_consumed: estimatedTokens
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Audio Transcribe error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
