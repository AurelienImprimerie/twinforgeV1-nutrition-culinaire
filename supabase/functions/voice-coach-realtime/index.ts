/**
 * Voice Coach Realtime API - WebRTC Interface
 *
 * Endpoints:
 * - POST /session : Crée une session WebRTC avec OpenAI Realtime API
 * - GET /health : Health check et diagnostics
 *
 * Architecture:
 * - Le client envoie son SDP offer via POST /session
 * - Le serveur fait un POST vers OpenAI /v1/realtime avec le SDP brut
 * - OpenAI retourne un SDP answer
 * - Le serveur retourne ce SDP au client
 * - WebRTC peer-to-peer connection automatique entre client et OpenAI
 *
 * Format de requête vers OpenAI:
 * - Endpoint: https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17
 * - Method: POST
 * - Content-Type: application/sdp
 * - Body: SDP offer brut (pas de JSON, pas de FormData)
 * - Header: Authorization: Bearer <OPENAI_API_KEY>
 *
 * Avantages:
 * - Pas de proxy, connexion directe client <-> OpenAI
 * - Audio géré automatiquement par WebRTC
 * - Meilleure latence
 * - Plus simple à maintenir
 * - Recommandé par OpenAI pour les navigateurs web
 *
 * IMPORTANT:
 * - Cette fonction nécessite OPENAI_API_KEY dans les secrets Supabase
 * - La clé API doit avoir accès à l'API Realtime d'OpenAI
 * - Utilise /v1/realtime (pas /v1/realtime/calls) pour éviter les erreurs 400
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkTokenBalance, consumeTokensAtomic, createInsufficientTokensResponse } from '../_shared/tokenMiddleware.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENAI_REALTIME_API = 'https://api.openai.com/v1/realtime';

// Updated model - using cost-efficient gpt-realtime-mini
const DEFAULT_MODEL = 'gpt-realtime-mini';
const FALLBACK_MODEL = 'gpt-realtime-mini-2025-10-06';

// Structured logging helper with enhanced context
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'voice-coach-realtime',
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

// Validation helper for API key
function validateApiKey(apiKey: string | undefined): { valid: boolean; error?: string } {
  if (!apiKey) {
    return { valid: false, error: 'OPENAI_API_KEY is not set in environment' };
  }

  if (!apiKey.startsWith('sk-')) {
    return { valid: false, error: 'OPENAI_API_KEY format is invalid (should start with sk-)' };
  }

  if (apiKey.length < 20) {
    return { valid: false, error: 'OPENAI_API_KEY appears to be too short' };
  }

  return { valid: true };
}

// Helper function to calculate realtime API cost
function calculateRealtimeCost(
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  audioTokens: number = 0
): number {
  // Pricing from tokenMiddleware.ts
  const pricing: Record<string, { input: number; output: number; audio: number }> = {
    'gpt-4o-realtime-preview': {
      input: 5.00,    // per 1M tokens
      output: 20.00,  // per 1M tokens
      audio: 100.00   // per 1M tokens
    },
    'gpt-realtime-mini': {
      input: 5.00,
      output: 20.00,
      audio: 100.00
    },
    'gpt-realtime-mini-2025-10-06': {
      input: 5.00,
      output: 20.00,
      audio: 100.00
    }
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-realtime-preview'];

  let totalCost = 0;
  if (inputTokens > 0) {
    totalCost += (inputTokens / 1_000_000) * modelPricing.input;
  }
  if (outputTokens > 0) {
    totalCost += (outputTokens / 1_000_000) * modelPricing.output;
  }
  if (audioTokens > 0) {
    totalCost += (audioTokens / 1_000_000) * modelPricing.audio;
  }

  return totalCost;
}

/**
 * Crée une session Realtime via l'interface unifiée d'OpenAI
 * Le client envoie son SDP offer, on retourne le SDP answer d'OpenAI
 */
async function createRealtimeSession(
  sdpOffer: string,
  openaiApiKey: string,
  model: string = DEFAULT_MODEL,
  voice: string = 'alloy',
  instructions?: string,
  retryCount: number = 0
): Promise<string> {
  const maxRetries = 2;

  log('info', 'Creating Realtime session via WebRTC endpoint', {
    model,
    voice,
    hasInstructions: !!instructions,
    sdpLength: sdpOffer.length,
    retryCount,
    maxRetries
  });

  // Build URL with query parameters for model
  // Using /v1/realtime instead of /v1/realtime/calls as per OpenAI community feedback
  const url = new URL(`${OPENAI_REALTIME_API}?model=${encodeURIComponent(model)}`);

  log('info', 'Sending SDP request to OpenAI', {
    url: url.toString(),
    model,
    voice,
    apiKeyPrefix: `${openaiApiKey.substring(0, 7)}...`,
    apiKeyLength: openaiApiKey.length,
    contentType: 'application/sdp'
  });

  try {
    // OpenAI Realtime API expects raw SDP in body with application/sdp Content-Type
    // NOT FormData or JSON - this is the key fix for the 400 error
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/sdp',
      },
      body: sdpOffer,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    log('info', 'Received response from OpenAI', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      const errorText = await response.text();

      log('error', 'OpenAI API returned error response', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        errorBodyLength: errorText.length,
        retryCount,
        willRetry: retryCount < maxRetries && response.status >= 500
      });

      // Retry logic for server errors (5xx)
      if (response.status >= 500 && retryCount < maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        log('warn', `Retrying after ${backoffDelay}ms due to server error`, {
          status: response.status,
          retryCount: retryCount + 1,
          maxRetries
        });

        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return createRealtimeSession(sdpOffer, openaiApiKey, model, voice, instructions, retryCount + 1);
      }

      // Parse error details if JSON
      let errorDetails = errorText;
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        // Not JSON, use as is
      }

      // Enhanced error logging for 400 errors with empty response
      if (response.status === 400 && (!errorDetails || errorDetails.trim().length === 0 ||
          (errorJson && (!errorJson.error?.message || errorJson.error.message === '')))) {
        log('error', 'Received 400 Bad Request with empty error details', {
          possibleCauses: [
            'Invalid SDP format',
            'Model not available for your API key',
            'Missing required parameters',
            'Endpoint incompatibility (/v1/realtime vs /v1/realtime/calls)',
            'API key lacks Realtime API access'
          ],
          recommendations: [
            'Verify OpenAI API key has Realtime API access enabled',
            'Check if model is available in your organization',
            'Ensure SDP offer is valid WebRTC format',
            'Try using /v1/realtime endpoint instead of /v1/realtime/calls'
          ],
          debugInfo: {
            url: url.toString(),
            model,
            voice,
            sdpLength: sdpOffer.length,
            sdpStart: sdpOffer.substring(0, 100)
          }
        });

        throw new Error(`OpenAI API error 400: Empty error response. This usually indicates an issue with the request format or API access. Check logs for detailed diagnostics.`);
      }

      throw new Error(`OpenAI API error ${response.status}: ${errorDetails}`);
    }

    // La réponse est le SDP answer en text/plain
    const sdpAnswer = await response.text();

    log('info', 'Received SDP answer from OpenAI', {
      sdpAnswerLength: sdpAnswer.length,
      sdpPreview: sdpAnswer.substring(0, 100)
    });

    return sdpAnswer;
  } catch (error) {
    log('error', 'Failed to create Realtime session', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // ==========================================
    // GET /health - Health check endpoint
    // ==========================================
    if (req.method === 'GET' && url.pathname.includes('/health')) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

      log('info', 'Health check requested', { requestId });

      return new Response(
        JSON.stringify({
          status: 'ok',
          mode: 'webrtc-unified',
          timestamp: new Date().toISOString(),
          hasOpenAIKey: !!openaiApiKey,
          openaiKeyLength: openaiApiKey?.length || 0,
          openaiKeyPrefix: openaiApiKey ? `${openaiApiKey.substring(0, 7)}...` : 'NOT_SET',
          message: openaiApiKey
            ? 'Edge function is configured and ready for WebRTC'
            : 'OPENAI_API_KEY is not configured'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ==========================================
    // POST /session - Create WebRTC session
    // ==========================================
    if (req.method === 'POST' && url.pathname.includes('/session')) {
      log('info', 'WebRTC session creation requested', { requestId });

      // Vérifier l'authentification Supabase
      const authHeader = req.headers.get('Authorization');
      const apikeyHeader = req.headers.get('apikey');

      if (!authHeader && !apikeyHeader) {
        log('error', 'Missing authentication', { requestId });
        return new Response(
          JSON.stringify({
            error: 'Missing authentication',
            details: 'Authorization header or apikey required'
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Vérifier la clé OpenAI avec validation améliorée
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      const keyValidation = validateApiKey(openaiApiKey);

      if (!keyValidation.valid) {
        log('error', 'OPENAI_API_KEY validation failed', {
          requestId,
          error: keyValidation.error,
          hasKey: !!openaiApiKey,
          keyLength: openaiApiKey?.length || 0
        });
        return new Response(
          JSON.stringify({
            error: 'OpenAI API key not configured correctly',
            details: keyValidation.error,
            troubleshooting: {
              step1: 'Verify OPENAI_API_KEY is set in Supabase Dashboard > Edge Functions > Secrets',
              step2: 'Ensure the key starts with "sk-" and is a valid OpenAI API key',
              step3: 'Check that the key has access to the Realtime API in your OpenAI account',
              step4: 'Verify your OpenAI account has sufficient credits and is not rate-limited'
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      log('info', 'OPENAI_API_KEY validation passed', {
        requestId,
        keyPrefix: `${openaiApiKey!.substring(0, 7)}...`,
        keyLength: openaiApiKey!.length
      });

      // Récupérer le SDP offer du client
      const contentType = req.headers.get('content-type') || '';
      let sdpOffer: string;

      if (contentType.includes('application/json')) {
        const body = await req.json();
        sdpOffer = body.sdp;
        const userId = body.user_id;

        if (!sdpOffer) {
          log('error', 'Missing SDP in JSON body', { requestId });
          return new Response(
            JSON.stringify({
              error: 'Missing SDP',
              details: 'Expected { "sdp": "...", ... } in request body'
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        log('info', 'Received SDP offer (JSON)', {
          requestId,
          sdpLength: sdpOffer.length,
          model: body.model,
          voice: body.voice,
          userId
        });

        // TOKEN PRE-CHECK - Realtime sessions can be expensive
        if (userId) {
          const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          // Estimate 100 tokens for a typical realtime session (5-10 minutes)
          const estimatedTokens = 100;
          const tokenCheck = await checkTokenBalance(supabase, userId, estimatedTokens);

          if (!tokenCheck.hasEnoughTokens) {
            log('warn', 'Insufficient tokens for realtime session', {
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

          log('info', 'Token pre-check passed for realtime session', {
            userId,
            currentBalance: tokenCheck.currentBalance,
            estimatedTokens
          });
        }

        // Créer la session avec les paramètres optionnels
        const sdpAnswer = await createRealtimeSession(
          sdpOffer,
          openaiApiKey,
          body.model,
          body.voice,
          body.instructions
        );

        log('info', 'Returning SDP answer to client', {
          requestId,
          sdpAnswerLength: sdpAnswer.length
        });

        // CRITICAL FIX: Consume tokens for realtime session initiation
        // WebRTC sessions are long-lived, so we consume an initial amount
        // The client should call a session-end endpoint with actual usage
        if (userId) {
          try {
            const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            // Initial token consumption - minimum session cost
            // This will be adjusted when the session ends and we get actual usage
            const initialTokens = 100; // ~5 minutes of typical usage
            const modelUsed = body.model || DEFAULT_MODEL;

            const consumptionResult = await consumeTokensAtomic(supabase, {
              userId: userId,
              edgeFunctionName: 'voice-coach-realtime',
              operationType: 'voice-realtime-session-init',
              openaiModel: modelUsed,
              openaiInputTokens: 0,
              openaiOutputTokens: 0,
              openaiCostUsd: 0.02, // Estimated initial cost for session setup
              metadata: {
                requestId,
                sessionInitiated: true,
                model: modelUsed,
                voice: body.voice || 'alloy',
                estimatedDuration: '5-10 minutes'
              }
            });

            log('info', 'Initial tokens consumed for realtime session', {
              userId,
              consumed: consumptionResult.consumed,
              remaining: consumptionResult.remainingBalance,
              model: modelUsed,
              sessionId: requestId
            });

            // Store session metadata in database for tracking actual usage
            await supabase.from('ai_analysis_jobs').insert({
              user_id: userId,
              analysis_type: 'voice_realtime_session',
              status: 'in_progress',
              input_hash: requestId,
              request_payload: {
                model: modelUsed,
                voice: body.voice || 'alloy',
                instructions: body.instructions,
                sessionStartTime: new Date().toISOString()
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          } catch (tokenError) {
            log('error', 'Failed to consume tokens for realtime session', {
              userId,
              error: tokenError instanceof Error ? tokenError.message : String(tokenError)
            });
          }
        }

        // Retourner le SDP answer
        return new Response(sdpAnswer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/sdp',
            'X-Session-Id': requestId,
          },
        });
      } else if (contentType.includes('application/sdp') || contentType.includes('text/plain')) {
        // Format simple: juste le SDP en text/plain
        sdpOffer = await req.text();

        if (!sdpOffer || sdpOffer.trim().length === 0) {
          log('error', 'Empty SDP offer', { requestId });
          return new Response(
            JSON.stringify({ error: 'Empty SDP offer' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        log('info', 'Received SDP offer (plain text)', {
          requestId,
          sdpLength: sdpOffer.length
        });

        // Utiliser les valeurs par défaut avec le nouveau modèle
        const model = url.searchParams.get('model') || DEFAULT_MODEL;
        const voice = url.searchParams.get('voice') || 'alloy';

        const sdpAnswer = await createRealtimeSession(
          sdpOffer,
          openaiApiKey,
          model,
          voice
        );

        log('info', 'Returning SDP answer to client', {
          requestId,
          sdpAnswerLength: sdpAnswer.length
        });

        return new Response(sdpAnswer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/sdp',
          },
        });
      } else {
        log('error', 'Unsupported content type', { requestId, contentType });
        return new Response(
          JSON.stringify({
            error: 'Unsupported content type',
            details: 'Expected application/json, application/sdp, or text/plain'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ==========================================
    // POST /session-end - Track actual token usage
    // ==========================================
    if (req.method === 'POST' && url.pathname.includes('/session-end')) {
      log('info', 'Session end tracking requested', { requestId });

      try {
        const body = await req.json();
        const { session_id, user_id, duration_seconds, input_tokens, output_tokens, audio_tokens } = body;

        if (!session_id || !user_id) {
          return new Response(
            JSON.stringify({
              error: 'Missing required fields',
              details: 'session_id and user_id are required'
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get session metadata
        const { data: sessionData } = await supabase
          .from('ai_analysis_jobs')
          .select('request_payload')
          .eq('input_hash', session_id)
          .eq('analysis_type', 'voice_realtime_session')
          .single();

        const model = sessionData?.request_payload?.model || 'gpt-4o-realtime-preview';

        // Calculate actual cost and consume additional tokens if needed
        // The initial 100 tokens covered the session setup, now we charge for actual usage
        if (input_tokens || output_tokens || audio_tokens) {
          const actualCostUsd = calculateRealtimeCost(model, input_tokens, output_tokens, audio_tokens);

          // We already charged 0.02 USD initially, so charge the difference
          const additionalCostUsd = Math.max(0, actualCostUsd - 0.02);

          if (additionalCostUsd > 0) {
            await consumeTokensAtomic(supabase, {
              userId: user_id,
              edgeFunctionName: 'voice-coach-realtime',
              operationType: 'voice-realtime-session-usage',
              openaiModel: model,
              openaiInputTokens: input_tokens || 0,
              openaiOutputTokens: output_tokens || 0,
              openaiCostUsd: additionalCostUsd,
              metadata: {
                sessionId: session_id,
                durationSeconds: duration_seconds,
                audioTokens: audio_tokens,
                sessionEnded: true
              }
            });

            log('info', 'Additional tokens consumed for realtime session usage', {
              userId: user_id,
              sessionId: session_id,
              actualCostUsd,
              additionalCostUsd,
              inputTokens: input_tokens,
              outputTokens: output_tokens,
              audioTokens: audio_tokens
            });
          }
        }

        // Update session status in database
        await supabase
          .from('ai_analysis_jobs')
          .update({
            status: 'completed',
            result_payload: {
              durationSeconds: duration_seconds,
              inputTokens: input_tokens,
              outputTokens: output_tokens,
              audioTokens: audio_tokens,
              sessionEndTime: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('input_hash', session_id)
          .eq('analysis_type', 'voice_realtime_session');

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Session usage tracked successfully'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );

      } catch (error) {
        log('error', 'Failed to track session end', {
          error: error instanceof Error ? error.message : String(error)
        });
        return new Response(
          JSON.stringify({
            error: 'Failed to track session usage',
            details: error instanceof Error ? error.message : 'Unknown error'
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ==========================================
    // Route non reconnue
    // ==========================================
    log('warn', 'Unknown endpoint', {
      requestId,
      method: req.method,
      path: url.pathname
    });

    return new Response(
      JSON.stringify({
        error: 'Not Found',
        details: 'Available endpoints: GET /health, POST /session, POST /session-end',
        mode: 'webrtc-unified'
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    log('error', 'Fatal error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
