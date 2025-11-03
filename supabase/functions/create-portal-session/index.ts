import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createCSRFProtection } from "../_shared/csrfProtection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-CSRF-Token",
};

interface PortalRequest {
  return_url?: string;
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
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sprint 3 Phase 5.3: CSRF Protection for financial portal access
    const csrfProtection = createCSRFProtection(supabase);
    const csrfToken = req.headers.get("x-csrf-token");

    const csrfValidation = await csrfProtection.validateRequest(
      user.id,
      csrfToken,
      req,
      "create-portal-session"
    );

    if (!csrfValidation.valid) {
      console.error("CREATE_PORTAL_SESSION", "CSRF validation failed", {
        user_id: user.id,
        error: csrfValidation.error,
        tokenProvided: !!csrfToken,
        originValidated: csrfValidation.originValidated,
      });

      return new Response(
        JSON.stringify({
          error: "CSRF validation failed",
          message: csrfValidation.error,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("CREATE_PORTAL_SESSION", "CSRF validation passed", {
      user_id: user.id,
      tokenValidated: csrfValidation.tokenValidated,
      originValidated: csrfValidation.originValidated,
    });

    const body: PortalRequest = await req.json();

    console.log("CREATE_PORTAL_SESSION", "Request received", {
      user_id: user.id,
    });

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: "No Stripe customer found. Please subscribe first."
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("CREATE_PORTAL_SESSION", "Creating portal session", {
      user_id: user.id,
      customer_id: subscription.stripe_customer_id,
    });

    const returnUrl = body.return_url || `${req.headers.get("origin")}/settings?tab=subscription`;

    const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: subscription.stripe_customer_id,
        return_url: returnUrl,
      }).toString(),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error("CREATE_PORTAL_SESSION", "Stripe API error", {
        status: stripeResponse.status,
        error: errorText,
      });
      throw new Error(`Stripe API error: ${stripeResponse.status} - ${errorText}`);
    }

    const session = await stripeResponse.json();

    console.log("CREATE_PORTAL_SESSION", "Portal session created successfully", {
      user_id: user.id,
      session_id: session.id,
      portal_url: session.url,
    });

    return new Response(
      JSON.stringify({
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("CREATE_PORTAL_SESSION", "Error", {
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
