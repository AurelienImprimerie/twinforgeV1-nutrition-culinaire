/**
 * Supabase Client Utilities for Edge Functions
 * Provides service-role client for bypassing RLS in controlled manner
 */ import { createClient } from 'npm:@supabase/supabase-js@2';
/**
 * Get service-role Supabase client for Edge Functions
 * Bypasses RLS for controlled data access
 */ export function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ [getServiceClient] Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing',
      serviceKeyPreview: supabaseServiceKey ? 'eyJ...' + supabaseServiceKey.slice(-10) : 'missing'
    });
    throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  console.log('🔍 [getServiceClient] Initializing service-role client', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    urlPreview: supabaseUrl.substring(0, 30) + '...',
    serviceKeyPreview: 'eyJ...' + supabaseServiceKey.slice(-10),
    philosophy: 'service_role_rls_bypass_controlled'
  });
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
/**
 * Validate service client environment variables
 */ export function validateServiceClientEnv() {
  const missingVars = [];
  if (!Deno.env.get('SUPABASE_URL')) {
    missingVars.push('SUPABASE_URL');
  }
  if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  return {
    isValid: missingVars.length === 0,
    missingVars
  };
}
