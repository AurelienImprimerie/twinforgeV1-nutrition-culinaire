/**
 * Response Utilities
 * Common response helpers for scan-match function
 */ export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
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
 * Enhanced response with debug information for DB-first architecture
 */ export function jsonResponseWithDebug(body, debugInfo, status = 200) {
  const enhancedBody = {
    ...body,
    debug_info: {
      timestamp: new Date().toISOString(),
      processing_time_ms: debugInfo.processingTime?.toFixed(2),
      db_first_version: 'v2.0',
      ...debugInfo
    }
  };
  return new Response(JSON.stringify(enhancedBody), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-DB-First-Version": "v2.0",
      "X-Processing-Time": debugInfo.processingTime?.toFixed(2) || "unknown"
    }
  });
}
