/*
  Fonction Edge: activity-transcriber
  Agent 1 - Transcription et nettoyage du texte avec gpt-5-nano
  
  Rôle: Transformer l'audio utilisateur en texte propre et structuré
  Modèle: gpt-5-nano (optimisé pour vitesse et coût)
*/ import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const { audioData, userId, clientTraceId } = await req.json();
    const startTime = Date.now();
    console.log('🎤 [ACTIVITY_TRANSCRIBER] Starting transcription', {
      userId,
      clientTraceId,
      audioDataLength: audioData?.length || 0,
      timestamp: new Date().toISOString()
    });
    // Validation des données d'entrée
    if (!audioData || !userId) {
      throw new Error('Audio data and user ID are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TOKEN PRE-CHECK - Whisper + GPT-5-nano
    const estimatedTokens = 40;
    const tokenCheck = await checkTokenBalance(supabase, userId, estimatedTokens);

    if (!tokenCheck.hasEnoughTokens) {
      console.warn('ACTIVITY_TRANSCRIBER', 'Insufficient tokens', {
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
    // Étape 1: Transcription audio vers texte
    console.log('🎤 [ACTIVITY_TRANSCRIBER] Step 1: Audio transcription');
    // Convertir base64 en blob pour l'API Whisper
    const audioBuffer = Uint8Array.from(atob(audioData), (c)=>c.charCodeAt(0));
    const audioBlob = new Blob([
      audioBuffer
    ], {
      type: 'audio/webm'
    });
    // Appel à l'API Whisper d'OpenAI pour la transcription
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: (()=>{
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-1');
        formData.append('language', 'fr');
        formData.append('response_format', 'json');
        return formData;
      })()
    });
    if (!transcriptionResponse.ok) {
      throw new Error(`Transcription failed: ${transcriptionResponse.statusText}`);
    }
    const transcriptionData = await transcriptionResponse.json();
    const originalTranscription = transcriptionData.text;
    console.log('🎤 [ACTIVITY_TRANSCRIBER] Step 2: Text cleaning with gpt-5-nano');
    // Log the original transcription for debugging
    console.log('🎤 [ACTIVITY_TRANSCRIBER] Original transcription:', {
      text: originalTranscription,
      length: originalTranscription.length,
      userId,
      clientTraceId
    });
    // Étape 2: Nettoyage du texte avec gpt-5-nano
    const cleaningPrompt = `Tu es un INTERPRÈTE MULTILINGUE ULTRA-SPÉCIALISÉ pour la Forge Énergétique TwinForge.

MISSION CRITIQUE: Tu dois interpréter et nettoyer des transcriptions audio d'activités physiques provenant d'utilisateurs du monde entier.

CONTEXTE UTILISATEUR:
- L'utilisateur parle dans un MICROPHONE (qualité audio variable)
- Peut avoir des ACCENTS PRONONCÉS (antillais, caribéens, africains, européens, etc.)
- Peut parler en PLUSIEURS LANGUES ou mélanger les langues
- Peut utiliser des expressions RÉGIONALES ou du CRÉOLE
- Le texte transcrit peut être "DÉGUEULASSE" avec des erreurs de reconnaissance vocale

CAPACITÉS REQUISES:
- INTERPRÈTE les accents forts et les déformations de prononciation
- COMPREND le créole, les patois, et les mélanges linguistiques
- DÉCODE les erreurs de transcription automatique (mots mal reconnus)
- RECONSTRUIT le sens réel malgré les imperfections audio
- TRADUIT tout en français standard et clair

RÈGLES DE NETTOYAGE:
1. INTERPRÈTE le sens réel derrière les erreurs de transcription
2. SUPPRIME toutes les hésitations (euh, hmm, ben, alors, etc.)
3. CORRIGE les mots mal transcrits par la reconnaissance vocale
4. TRADUIS les expressions créoles/régionales en français standard
5. STRUCTURE les phrases de manière claire et fluide
6. CONSERVE ABSOLUMENT tous les détails sur:
   - Types d'activités (course, musculation, yoga, etc.)
   - Durées (minutes, heures)
   - Intensités (facile, modéré, intense, très intense)
   - Contexte temporel (matin, soir, hier, aujourd'hui)
   - Notes personnelles importantes
7. RÉPONDS UNIQUEMENT avec le texte nettoyé en français, SANS commentaires

EXEMPLES DE TRANSFORMATION:
- "Euh... j'ai fait... comment dire... du footing ce matin là" → "J'ai fait du footing ce matin"
- "Mi ka fè kouri 30 minit" (créole) → "J'ai fait 30 minutes de course"
- "J'ai fait du... comment on dit... weight lifting" → "J'ai fait de la musculation"
- "Mwen te fè yoga pou 45 minit" → "J'ai fait du yoga pendant 45 minutes"

Texte à nettoyer:
"${originalTranscription}"`;
    console.log('🎤 [ACTIVITY_TRANSCRIBER] Calling OpenAI API with gpt-5-mini');
    const cleaningResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: cleaningPrompt
          }
        ],
        max_completion_tokens: 1500
      })
    });
    console.log('🎤 [ACTIVITY_TRANSCRIBER] OpenAI API response status:', cleaningResponse.status);
    if (!cleaningResponse.ok) {
      const errorText = await cleaningResponse.text();
      console.error('🎤 [ACTIVITY_TRANSCRIBER] OpenAI API error:', {
        status: cleaningResponse.status,
        statusText: cleaningResponse.statusText,
        error: errorText,
        userId,
        clientTraceId
      });
      throw new Error(`Text cleaning failed: ${cleaningResponse.statusText}`);
    }
    const cleaningData = await cleaningResponse.json();
    console.log('🎤 [ACTIVITY_TRANSCRIBER] OpenAI API response received:', {
      hasChoices: !!cleaningData.choices,
      choicesLength: cleaningData.choices?.length || 0,
      userId,
      clientTraceId
    });
    const cleanText = cleaningData.choices?.[0]?.message?.content || originalTranscription;
    const processingTime = Date.now() - startTime;

    // TOKEN CONSUMPTION - Whisper + GPT-5-nano
    const whisperDuration = audioBuffer.length / (16000 * 2); // Estimate duration
    const whisperCost = (whisperDuration / 60) * 0.006;
    const gptInputTokens = cleaningData.usage?.prompt_tokens || 0;
    const gptOutputTokens = cleaningData.usage?.completion_tokens || 0;
    const gptCost = (gptInputTokens / 1000000 * 0.25) + (gptOutputTokens / 1000000 * 2.0);
    const totalCost = whisperCost + gptCost;

    const requestId = crypto.randomUUID();
await consumeTokensAtomic(supabase, {
      userId,
      edgeFunctionName: 'activity-transcriber',
      operationType: 'activity_transcription',
      openaiModel: 'whisper-1+gpt-5-nano',
      openaiInputTokens: gptInputTokens,
      openaiOutputTokens: gptOutputTokens,
      openaiCostUsd: totalCost,
      metadata: {
        clientTraceId,
        audioDataLength: audioData.length,
        originalLength: originalTranscription.length,
        cleanLength: cleanText.length
      }
    });

    console.log('✅ [ACTIVITY_TRANSCRIBER] Transcription completed', {
      userId,
      clientTraceId,
      originalLength: originalTranscription.length,
      cleanLength: cleanText.length,
      processingTime,
      tokensConsumed: estimatedTokens,
      costUsd: totalCost.toFixed(6),
      cleanTextPreview: cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    });
    // Store cost tracking in database
    try {
      await supabase.from('ai_analysis_jobs').insert({
        user_id: userId,
        analysis_type: 'activity_transcription',
        status: 'completed',
        request_payload: {
          clientTraceId,
          audioDataLength: audioData.length,
          originalTranscriptionLength: originalTranscription.length
        },
        result_payload: {
          cleanText,
          originalTranscription,
          confidence: 0.95,
          processingTime,
          costUsd,
          estimatedTokens,
          model: 'gpt-5-mini'
        }
      });
      console.log('💰 [ACTIVITY_TRANSCRIBER] Cost tracking saved to database', {
        userId,
        costUsd: costUsd.toFixed(6),
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      console.error('💰 [ACTIVITY_TRANSCRIBER] Failed to save cost tracking', {
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        userId,
        costUsd: costUsd.toFixed(6),
        timestamp: new Date().toISOString()
      });
    // Don't fail the main function if cost tracking fails
    }
    const response = {
      cleanText,
      originalTranscription,
      processingTime,
      costUsd,
      confidence: 0.95 // Confiance élevée pour gpt-5-mini avec reasoning
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('❌ [ACTIVITY_TRANSCRIBER] Error:', error);
    return new Response(JSON.stringify({
      error: 'Transcription failed',
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
