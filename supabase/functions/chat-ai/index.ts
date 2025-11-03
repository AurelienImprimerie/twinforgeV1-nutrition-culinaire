import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { consumeTokensAtomic, createInsufficientTokensResponse } from "../_shared/tokenMiddleware.ts";
import { validateChatAIRequest } from "./requestValidator.ts";
import { createCSRFProtection } from "../_shared/csrfProtection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-CSRF-Token",
};

interface ChatRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  mode: "training" | "nutrition" | "fasting" | "general" | "body-scan";
  contextData?: any;
  stream?: boolean;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function log(level: 'info' | 'warn' | 'error', message: string, requestId: string, data?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'chat-ai',
    requestId,
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

  console.log('🚀 EDGE FUNCTION INVOKED - chat-ai', {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });

  if (req.method === "OPTIONS") {
    console.log('✅ OPTIONS request handled', { requestId });
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    log('info', '📥 Chat request received', requestId, { method: req.method });

    if (!OPENAI_API_KEY) {
      log('error', '❌ OPENAI_API_KEY not configured', requestId);
      console.error('CRITICAL: OPENAI_API_KEY is missing!');
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log('✅ OPENAI_API_KEY is configured', { requestId });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody = await req.json();
    const { messages, mode, contextData, stream = false }: ChatRequest = requestBody;

    // Sprint 2 Phase 3.2: Validate request with unified validation system
    const validationError = validateChatAIRequest(requestBody);
    if (validationError) {
      log('error', 'Request validation failed', requestId, { error: validationError });

      return new Response(
        JSON.stringify({ error: validationError }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sprint 3 Phase 5.3: CSRF Protection for AI chat (prompt injection prevention)
    const csrfProtection = createCSRFProtection(supabase);
    const csrfToken = req.headers.get('x-csrf-token');

    const csrfValidation = await csrfProtection.validateRequest(
      user.id,
      csrfToken,
      req,
      'chat-ai'
    );

    if (!csrfValidation.valid) {
      log('error', 'CSRF validation failed', requestId, {
        error: csrfValidation.error,
        tokenProvided: !!csrfToken,
        originValidated: csrfValidation.originValidated,
      });

      return new Response(
        JSON.stringify({
          error: 'CSRF validation failed',
          message: csrfValidation.error
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    log('info', 'CSRF validation passed', requestId, {
      tokenValidated: csrfValidation.tokenValidated,
      originValidated: csrfValidation.originValidated,
    });

    log('info', '✅ Request parsed and validated successfully', requestId, {
      mode,
      messageCount: messages.length,
      stream,
      lastMessageRole: messages[messages.length - 1]?.role
    });

    // NOTE: With atomic consumption, we no longer check balance beforehand
    // The atomic function will handle verification and consumption in one transaction
    log('info', 'Calling OpenAI API with atomic token consumption', requestId, {
      model: 'gpt-5-mini',
      messageCount: messages.length,
      stream,
      requestId
    });

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: messages,
        max_completion_tokens: 800,
        stream: stream,
      }),
    });

    log('info', 'OpenAI response received', requestId, {
      status: openAIResponse.status,
      ok: openAIResponse.ok,
      stream
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      log('error', 'OpenAI API error', requestId, {
        status: openAIResponse.status,
        error
      });
      throw new Error(`OpenAI API error: ${openAIResponse.status} - ${error}`);
    }

    if (stream) {
      log('info', 'Starting SSE stream', requestId);

      let chunkCount = 0;
      let accumulatedInputTokens = 0;
      let accumulatedOutputTokens = 0;
      const reader = openAIResponse.body?.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      if (!reader) {
        log('error', 'No response body reader', requestId);
        throw new Error('No response body available');
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                log('info', 'Stream completed', requestId, { chunkCount });
                controller.close();

                // ATOMIC token consumption after stream completion
                try {
                  const consumptionResult = await consumeTokensAtomic(supabase, {
                    userId: user.id,
                    edgeFunctionName: 'chat-ai',
                    operationType: 'chat-completion',
                    openaiModel: 'gpt-5-mini',
                    openaiInputTokens: accumulatedInputTokens || estimatedInputTokens,
                    openaiOutputTokens: accumulatedOutputTokens || estimatedOutputTokens,
                    metadata: { mode, requestId, streaming: true }
                  });

                  if (consumptionResult.success) {
                    log('info', '✅ Tokens consumed atomically after stream', requestId, {
                      consumed: consumptionResult.consumed,
                      remaining: consumptionResult.remainingBalance,
                      requestId: consumptionResult.requestId,
                      duplicate: consumptionResult.duplicate || false
                    });
                  } else {
                    log('error', '❌ Atomic token consumption failed', requestId, {
                      error: consumptionResult.error,
                      requestId: consumptionResult.requestId
                    });
                  }
                } catch (tokenError) {
                  log('error', '💥 Exception during atomic token consumption', requestId, {
                    error: tokenError instanceof Error ? tokenError.message : String(tokenError)
                  });
                }

                break;
              }

              chunkCount++;
              const chunk = decoder.decode(value, { stream: true });

              if (chunkCount <= 3) {
                log('info', 'Stream chunk received', requestId, {
                  chunkNumber: chunkCount,
                  chunkLength: chunk.length,
                  preview: chunk.substring(0, 100)
                });
              }

              // Parse SSE chunks to extract usage data if available
              try {
                const lines = chunk.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.usage) {
                        accumulatedInputTokens = parsed.usage.prompt_tokens || 0;
                        accumulatedOutputTokens = parsed.usage.completion_tokens || 0;
                      }
                    } catch {
                      // Not valid JSON, continue
                    }
                  }
                }
              } catch {
                // Parsing error, continue streaming
              }

              controller.enqueue(encoder.encode(chunk));
            }
          } catch (error) {
            log('error', 'Stream error', requestId, {
              error: error instanceof Error ? error.message : String(error),
              chunkCount
            });
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Request-Id": requestId,
        },
      });
    }

    const data = await openAIResponse.json();

    log('info', 'Non-stream response parsed', requestId, {
      hasMessage: !!data.choices[0]?.message,
      tokensUsed: data.usage?.total_tokens
    });

    const consumptionResult = await consumeTokensAtomic(supabase, {
      userId: user.id,
      edgeFunctionName: 'chat-ai',
      operationType: 'chat-completion',
      openaiModel: 'gpt-5-mini',
      openaiInputTokens: data.usage?.prompt_tokens,
      openaiOutputTokens: data.usage?.completion_tokens,
      metadata: { mode, requestId }
    }, requestId);

    if (!consumptionResult.success) {
      log('error', '❌ Atomic token consumption failed', requestId, {
        error: consumptionResult.error,
        needsUpgrade: consumptionResult.needsUpgrade
      });

      // Return error response if consumption failed
      if (consumptionResult.error === 'insufficient_tokens' || consumptionResult.needsUpgrade) {
        return createInsufficientTokensResponse(
          consumptionResult.remainingBalance,
          consumptionResult.consumed,
          consumptionResult.needsUpgrade || false,
          corsHeaders
        );
      }
    }

    log('info', '✅ Tokens consumed atomically', requestId, {
      consumed: consumptionResult.consumed,
      remaining: consumptionResult.remainingBalance,
      requestId: consumptionResult.requestId,
      duplicate: consumptionResult.duplicate || false
    });

    return new Response(
      JSON.stringify({
        message: data.choices[0].message,
        usage: data.usage,
        requestId,
        tokenBalance: consumptionResult.remainingBalance
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      }
    );
  } catch (error) {
    log('error', 'Fatal error', requestId, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({
        error: error.message || "An error occurred processing your request",
        requestId
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      }
    );
  }
});
