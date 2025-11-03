import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface InitializeTokenBalanceResponse {
  success: boolean;
  message: string;
  balance?: {
    available_tokens: number;
    subscription_tokens: number;
    onetime_tokens: number;
    bonus_tokens: number;
  };
  error?: string;
  action_taken?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client with service role for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authenticated user from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_authorization",
          message: "Authorization header required",
        } as InitializeTokenBalanceResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the user token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invalid_token",
          message: "Invalid or expired token",
        } as InitializeTokenBalanceResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[initialize-token-balance] Processing for user: ${user.id}`);

    // Check if token balance already exists
    const { data: existingBalance, error: checkError } = await supabase
      .from("user_token_balance")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      console.error(
        "[initialize-token-balance] Error checking existing balance:",
        checkError
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "database_error",
          message: "Failed to check existing balance",
        } as InitializeTokenBalanceResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If balance already exists, return it
    if (existingBalance) {
      console.log(
        `[initialize-token-balance] Balance already exists for user ${user.id}`
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: "Token balance already initialized",
          action_taken: "none_required",
          balance: {
            available_tokens: existingBalance.available_tokens,
            subscription_tokens: existingBalance.subscription_tokens,
            onetime_tokens: existingBalance.onetime_tokens,
            bonus_tokens: existingBalance.bonus_tokens,
          },
        } as InitializeTokenBalanceResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create token balance with welcome bonus (15,000 tokens)
    console.log(
      `[initialize-token-balance] Creating token balance for user ${user.id}`
    );

    const { data: newBalance, error: insertError } = await supabase
      .from("user_token_balance")
      .insert({
        user_id: user.id,
        available_tokens: 15000,
        subscription_tokens: 0,
        onetime_tokens: 0,
        bonus_tokens: 15000,
        tokens_consumed_this_month: 0,
        tokens_consumed_last_month: 0,
        last_monthly_reset: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error(
        "[initialize-token-balance] Error creating balance:",
        insertError
      );

      // Log anomaly for monitoring
      await supabase.from("token_anomalies").insert({
        user_id: user.id,
        anomaly_type: "failed_consumption",
        severity: "high",
        description: "Failed to initialize token balance via Edge Function",
        metadata: {
          error: insertError.message,
          error_code: insertError.code,
          edge_function: "initialize-token-balance",
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "creation_failed",
          message: "Failed to create token balance",
        } as InitializeTokenBalanceResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create free subscription if it doesn't exist
    const { data: existingSubscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingSubscription) {
      const currentDate = new Date();
      const oneYearLater = new Date(currentDate);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      await supabase.from("user_subscriptions").insert({
        user_id: user.id,
        plan_type: "free",
        subscription_status: "trialing",
        tokens_monthly_quota: 15000,
        trial_start: currentDate.toISOString(),
        current_period_start: currentDate.toISOString(),
        current_period_end: oneYearLater.toISOString(),
        cancel_at_period_end: false,
      });

      console.log(
        `[initialize-token-balance] Created free subscription for user ${user.id}`
      );
    }

    // Log the welcome bonus transaction
    await supabase.from("token_transactions").insert({
      user_id: user.id,
      transaction_type: "bonus",
      token_amount: 15000,
      balance_after: 15000,
      metadata: {
        reason: "welcome_bonus_edge_function",
        description: "Bienvenue ! 15 000 tokens offerts",
        source: "initialize-token-balance",
        timestamp: new Date().toISOString(),
      },
    });

    console.log(
      `[initialize-token-balance] Successfully initialized balance for user ${user.id}`
    );

    // Log success in anomalies for audit trail
    await supabase.from("token_anomalies").insert({
      user_id: user.id,
      anomaly_type: "suspicious_pattern",
      severity: "low",
      description: "Token balance initialized via Edge Function fallback",
      metadata: {
        edge_function: "initialize-token-balance",
        tokens_granted: 15000,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token balance successfully initialized",
        action_taken: "balance_created",
        balance: {
          available_tokens: newBalance.available_tokens,
          subscription_tokens: newBalance.subscription_tokens,
          onetime_tokens: newBalance.onetime_tokens,
          bonus_tokens: newBalance.bonus_tokens,
        },
      } as InitializeTokenBalanceResponse),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[initialize-token-balance] Unexpected error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "internal_error",
        message:
          error instanceof Error ? error.message : "An unexpected error occurred",
      } as InitializeTokenBalanceResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
