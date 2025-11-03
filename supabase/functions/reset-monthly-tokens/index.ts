import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetResult {
  userId: string;
  email: string;
  planType: string;
  tokensAllocated: number;
  previousBalance: number;
  newBalance: number;
  success: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("RESET_MONTHLY_TOKENS", "Starting monthly token reset");

    const { data: pricingConfig, error: configError } = await supabase
      .from("token_pricing_config")
      .select("subscription_plans")
      .eq("is_active", true)
      .single();

    if (configError || !pricingConfig) {
      throw new Error("Failed to fetch pricing config");
    }

    const { data: activeSubscriptions, error: subsError } = await supabase
      .from("user_subscriptions")
      .select(`
        id,
        user_id,
        plan_type,
        current_period_start,
        current_period_end,
        users:user_id (
          email
        )
      `)
      .eq("status", "active");

    if (subsError) {
      throw new Error(`Failed to fetch active subscriptions: ${subsError.message}`);
    }

    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      console.log("RESET_MONTHLY_TOKENS", "No active subscriptions found");
      return new Response(
        JSON.stringify({
          message: "No active subscriptions to reset",
          count: 0,
          results: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("RESET_MONTHLY_TOKENS", `Processing ${activeSubscriptions.length} active subscriptions`);

    const results: ResetResult[] = [];

    for (const subscription of activeSubscriptions) {
      const plan = pricingConfig.subscription_plans[subscription.plan_type];
      if (!plan) {
        console.error("RESET_MONTHLY_TOKENS", "Invalid plan type", {
          userId: subscription.user_id,
          planType: subscription.plan_type,
        });
        results.push({
          userId: subscription.user_id,
          email: subscription.users?.email || "unknown",
          planType: subscription.plan_type,
          tokensAllocated: 0,
          previousBalance: 0,
          newBalance: 0,
          success: false,
          error: "Invalid plan type",
        });
        continue;
      }

      const tokensToAllocate = plan.tokens_per_month;

      const { data: currentBalance, error: balanceError } = await supabase
        .from("user_token_balance")
        .select("balance")
        .eq("user_id", subscription.user_id)
        .single();

      if (balanceError) {
        console.error("RESET_MONTHLY_TOKENS", "Failed to fetch balance", {
          userId: subscription.user_id,
          error: balanceError.message,
        });
        results.push({
          userId: subscription.user_id,
          email: subscription.users?.email || "unknown",
          planType: subscription.plan_type,
          tokensAllocated: 0,
          previousBalance: 0,
          newBalance: 0,
          success: false,
          error: balanceError.message,
        });
        continue;
      }

      const previousBalance = currentBalance?.balance || 0;

      const { error: updateError } = await supabase
        .from("user_token_balance")
        .update({
          balance: tokensToAllocate,
          last_reset_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", subscription.user_id);

      if (updateError) {
        console.error("RESET_MONTHLY_TOKENS", "Failed to update balance", {
          userId: subscription.user_id,
          error: updateError.message,
        });
        results.push({
          userId: subscription.user_id,
          email: subscription.users?.email || "unknown",
          planType: subscription.plan_type,
          tokensAllocated: tokensToAllocate,
          previousBalance,
          newBalance: previousBalance,
          success: false,
          error: updateError.message,
        });
        continue;
      }

      const { error: txError } = await supabase
        .from("token_transactions")
        .insert({
          user_id: subscription.user_id,
          transaction_type: "add",
          amount: tokensToAllocate,
          balance_after: tokensToAllocate,
          source: "monthly_reset",
          metadata: {
            plan_type: subscription.plan_type,
            previous_balance: previousBalance,
            subscription_id: subscription.id,
            reset_date: new Date().toISOString(),
          },
        });

      if (txError) {
        console.warn("RESET_MONTHLY_TOKENS", "Failed to log transaction", {
          userId: subscription.user_id,
          error: txError.message,
        });
      }

      console.log("RESET_MONTHLY_TOKENS", "Successfully reset tokens", {
        userId: subscription.user_id,
        email: subscription.users?.email,
        planType: subscription.plan_type,
        previousBalance,
        newBalance: tokensToAllocate,
      });

      results.push({
        userId: subscription.user_id,
        email: subscription.users?.email || "unknown",
        planType: subscription.plan_type,
        tokensAllocated: tokensToAllocate,
        previousBalance,
        newBalance: tokensToAllocate,
        success: true,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log("RESET_MONTHLY_TOKENS", "Monthly reset completed", {
      total: results.length,
      successful: successCount,
      failed: failureCount,
    });

    return new Response(
      JSON.stringify({
        message: "Monthly token reset completed",
        count: results.length,
        successful: successCount,
        failed: failureCount,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("RESET_MONTHLY_TOKENS", "Fatal error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
