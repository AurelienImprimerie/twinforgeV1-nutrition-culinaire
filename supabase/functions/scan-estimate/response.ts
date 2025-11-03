/**
 * Response Utilities
 * Common response helpers for scan-estimate function
 */ export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

/**
 * Serialize TokenUsage object to JSONB-safe format
 * Removes undefined fields and ensures all values are defined
 */
export function serializeTokenUsage(tokenUsage: any) {
  if (!tokenUsage) return null;

  return {
    input_tokens: tokenUsage.input_tokens || 0,
    output_tokens: tokenUsage.output_tokens || 0,
    reasoning_tokens: tokenUsage.reasoning_tokens || 0,
    total_tokens: tokenUsage.total_tokens || 0,
    cost_estimate_usd: tokenUsage.cost_estimate_usd || 0,
    model_used: tokenUsage.model_used || 'unknown',
    reasoning_cost_usd: tokenUsage.reasoning_cost_usd || 0,
    output_cost_usd: tokenUsage.output_cost_usd || 0
  };
}
