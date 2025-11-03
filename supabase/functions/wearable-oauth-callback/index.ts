import { corsHeaders } from '../_shared/cors.ts';
import { validateOriginSimple } from '../_shared/csrfProtection.ts';

/**
 * Wearable OAuth Callback Handler
 * Handles OAuth callbacks from all wearable providers
 * Sprint 3 Phase 5.3: Origin validation for device linking security
 */

interface OAuthCallbackRequest {
  provider: string;
  code: string;
  state: string;
  error?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

const PROVIDER_TOKEN_URLS: Record<string, string> = {
  strava: 'https://www.strava.com/oauth/token',
  garmin: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
  fitbit: 'https://api.fitbit.com/oauth2/token',
  polar: 'https://polarremote.com/v2/oauth2/token',
  wahoo: 'https://api.wahooligan.com/oauth/token',
  whoop: 'https://api.prod.whoop.com/oauth/token',
  oura: 'https://api.ouraring.com/oauth/token',
  suunto: 'https://cloudapi.suunto.com/oauth/token',
  coros: 'https://open.coros.com/oauth2/accesstoken',
  google_fit: 'https://oauth2.googleapis.com/token',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (!provider || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sprint 3 Phase 5.3: Validate origin for OAuth callback security
    const originValidation = validateOriginSimple(req);
    if (!originValidation.valid) {
      console.error('WEARABLE_OAUTH_CALLBACK', 'Origin validation failed', {
        provider,
        error: originValidation.error,
        origin: req.headers.get('origin'),
        referer: req.headers.get('referer'),
      });

      return new Response(
        JSON.stringify({
          error: 'Origin validation failed',
          message: originValidation.error
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('WEARABLE_OAUTH_CALLBACK', 'Origin validation passed', {
      provider,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: `OAuth error: ${error}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code missing' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify state and get auth flow
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.54.0');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authFlow, error: flowError } = await supabase
      .from('device_auth_flows')
      .select('*')
      .eq('state', state)
      .eq('status', 'pending')
      .single();

    if (flowError || !authFlow) {
      console.error('OAuth callback - State verification failed:', {
        state,
        provider,
        flowError: flowError?.message,
        errorCode: flowError?.code,
        hint: flowError?.hint,
      });

      // Provide more helpful error messages
      let errorMessage = 'État de sécurité invalide ou expiré';
      if (flowError?.code === 'PGRST116') {
        errorMessage = 'La session OAuth a expiré. Veuillez réessayer de connecter votre appareil.';
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          technical: flowError?.message || 'State not found in database',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Exchange code for tokens
    const tokenUrl = PROVIDER_TOKEN_URLS[provider];
    if (!tokenUrl) {
      return new Response(
        JSON.stringify({ error: `Unsupported provider: ${provider}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`);

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: `Provider ${provider} not configured` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: authFlow.redirect_uri,
    });

    if (authFlow.code_verifier) {
      tokenParams.append('code_verifier', authFlow.code_verifier);
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Get provider user ID
    const providerUserId = await getProviderUserId(provider, tokens.access_token);

    // Calculate token expiration
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Store encrypted tokens
    const { data: device, error: deviceError } = await supabase
      .from('connected_devices')
      .upsert({
        user_id: authFlow.user_id,
        provider,
        provider_user_id: providerUserId,
        display_name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Device`,
        status: 'connected',
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token || null,
        token_expires_at: tokenExpiresAt,
        scopes: tokens.scope?.split(' ') || [],
        connected_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (deviceError) {
      throw deviceError;
    }

    // Create default sync preferences
    await supabase.from('sync_preferences').upsert({
      user_id: authFlow.user_id,
      device_id: device.id,
      auto_sync_enabled: true,
      sync_frequency_minutes: 60,
      data_types_enabled: ['heart_rate', 'steps', 'calories', 'distance', 'sleep', 'workout'],
      notify_on_error: true,
      backfill_days: 7,
    });

    // Update auth flow status
    await supabase
      .from('device_auth_flows')
      .update({ status: 'completed' })
      .eq('id', authFlow.id);

    // Redirect to success page
    const appUrl = Deno.env.get('APP_URL') || supabaseUrl.replace('supabase.co', 'vercel.app');
    const redirectUrl = `${appUrl}/settings?tab=appareils&connected=${provider}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function getProviderUserId(provider: string, accessToken: string): Promise<string> {
  const userEndpoints: Record<string, string> = {
    strava: 'https://www.strava.com/api/v3/athlete',
    garmin: 'https://apis.garmin.com/wellness-api/rest/user/id',
    fitbit: 'https://api.fitbit.com/1/user/-/profile.json',
    polar: 'https://www.polaraccesslink.com/v3/users',
    wahoo: 'https://api.wahooligan.com/v1/user',
    whoop: 'https://api.prod.whoop.com/developer/v1/user/profile/basic',
    oura: 'https://api.ouraring.com/v2/usercollection/personal_info',
    suunto: 'https://cloudapi.suunto.com/v2/user',
    coros: 'https://open.coros.com/oauth2/userinfo',
    google_fit: 'https://www.googleapis.com/oauth2/v2/userinfo',
  };

  const endpoint = userEndpoints[provider];
  if (!endpoint) {
    return 'unknown';
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to get ${provider} user ID:`, await response.text());
      return 'unknown';
    }

    const userData = await response.json();

    const idFields: Record<string, string> = {
      strava: 'id',
      garmin: 'userId',
      fitbit: 'user.encodedId',
      polar: 'id',
      wahoo: 'id',
      whoop: 'user_id',
      oura: 'id',
      suunto: 'username',
      coros: 'openId',
      google_fit: 'id',
    };

    const idField = idFields[provider];
    const parts = idField.split('.');
    let value = userData;
    for (const part of parts) {
      value = value?.[part];
    }

    return String(value || 'unknown');
  } catch (error) {
    console.error(`Error getting ${provider} user ID:`, error);
    return 'unknown';
  }
}
