import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createCSRFProtection } from "../_shared/csrfProtection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-CSRF-Token",
};

interface CheckoutRequest {
  mode: "subscription" | "payment";
  plan_type?: string;
  token_pack_id?: string;
  success_url?: string;
  cancel_url?: string;
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

    // Sprint 3 Phase 5.3: CSRF Protection for financial operations
    const csrfProtection = createCSRFProtection(supabase);
    const csrfToken = req.headers.get("x-csrf-token");

    const csrfValidation = await csrfProtection.validateRequest(
      user.id,
      csrfToken,
      req,
      "create-checkout-session"
    );

    if (!csrfValidation.valid) {
      console.error("CREATE_CHECKOUT_SESSION", "CSRF validation failed", {
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

    console.log("CREATE_CHECKOUT_SESSION", "CSRF validation passed", {
      user_id: user.id,
      tokenValidated: csrfValidation.tokenValidated,
      originValidated: csrfValidation.originValidated,
    });

    const body: CheckoutRequest = await req.json();

    console.log("CREATE_CHECKOUT_SESSION", "Request received", {
      user_id: user.id,
      mode: body.mode,
      plan_type: body.plan_type,
      token_pack_id: body.token_pack_id,
    });

    if (!body.mode || (body.mode !== "subscription" && body.mode !== "payment")) {
      throw new Error("Invalid mode: must be 'subscription' or 'payment'");
    }

    if (body.mode === "subscription" && !body.plan_type) {
      throw new Error("plan_type is required for subscription mode");
    }

    if (body.mode === "payment" && !body.token_pack_id) {
      throw new Error("token_pack_id is required for payment mode");
    }

    const { data: pricingConfig, error: configError } = await supabase
      .from("token_pricing_config")
      .select("subscription_plans, token_packs")
      .eq("is_active", true)
      .single();

    if (configError) {
      console.error("CREATE_CHECKOUT_SESSION", "Failed to fetch pricing config", {
        error: configError.message,
      });
      throw new Error(`Failed to fetch pricing configuration: ${configError.message}`);
    }

    if (!pricingConfig) {
      throw new Error("Pricing configuration not found");
    }

    const { data: existingSubscription } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    const customerId = existingSubscription?.stripe_customer_id;

    let sessionParams: any = {
      mode: body.mode,
      success_url: body.success_url || `${req.headers.get("origin")}/settings?tab=subscription&success=true`,
      cancel_url: body.cancel_url || `${req.headers.get("origin")}/settings?tab=subscription&canceled=true`,
      metadata: {
        user_id: user.id,
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    if (body.mode === "subscription") {
      const plan = pricingConfig.subscription_plans[body.plan_type!];
      if (!plan) {
        console.error("CREATE_CHECKOUT_SESSION", "Plan not found", {
          plan_type: body.plan_type,
          available_plans: Object.keys(pricingConfig.subscription_plans),
        });
        throw new Error(`Plan not found: ${body.plan_type}`);
      }

      console.log("CREATE_CHECKOUT_SESSION", "Plan details", {
        plan_type: body.plan_type,
        price_eur: plan.price_eur,
        tokens_per_month: plan.tokens_per_month,
        stripe_price_id: plan.stripe_price_id,
      });

      if (!plan.stripe_price_id) {
        console.error("CREATE_CHECKOUT_SESSION", "Stripe price ID not configured", {
          plan_type: body.plan_type,
          plan: plan,
        });
        throw new Error(`Stripe price ID not configured for plan: ${body.plan_type}. Please run the Stripe product creation script first.`);
      }

      sessionParams.line_items = [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ];

      sessionParams.subscription_data = {
        metadata: {
          user_id: user.id,
          plan_type: body.plan_type,
        },
      };
    } else if (body.mode === "payment") {
      const pack = pricingConfig.token_packs[body.token_pack_id!];
      if (!pack) {
        console.error("CREATE_CHECKOUT_SESSION", "Token pack not found", {
          token_pack_id: body.token_pack_id,
          available_packs: Object.keys(pricingConfig.token_packs),
        });
        throw new Error(`Token pack not found: ${body.token_pack_id}`);
      }

      console.log("CREATE_CHECKOUT_SESSION", "Token pack details", {
        pack_id: body.token_pack_id,
        tokens: pack.tokens,
        price_eur: pack.price_eur,
        bonus_percent: pack.bonus_percent,
      });

      sessionParams.line_items = [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Pack de ${pack.tokens.toLocaleString()} tokens`,
              description:
                pack.bonus_percent > 0
                  ? `Bonus de ${pack.bonus_percent}% inclus`
                  : "Tokens pour utiliser les fonctionnalités IA",
            },
            unit_amount: Math.round(pack.price_eur * 100),
          },
          quantity: 1,
        },
      ];

      sessionParams.payment_intent_data = {
        metadata: {
          user_id: user.id,
          token_purchase: "true",
          token_amount: pack.tokens.toString(),
          pack_id: body.token_pack_id,
        },
      };
    }

    console.log("CREATE_CHECKOUT_SESSION", "Creating Stripe session", {
      user_id: user.id,
      mode: body.mode,
      has_customer_id: !!customerId,
      session_params_keys: Object.keys(sessionParams),
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(
        Object.entries(sessionParams).reduce((acc: any, [key, value]) => {
          if (typeof value === "object" && !Array.isArray(value)) {
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (typeof subValue === "object") {
                Object.entries(subValue as any).forEach(([subSubKey, subSubValue]) => {
                  acc[`${key}[${subKey}][${subSubKey}]`] = subSubValue;
                });
              } else {
                acc[`${key}[${subKey}]`] = subValue;
              }
            });
          } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
              Object.entries(item).forEach(([itemKey, itemValue]) => {
                if (typeof itemValue === "object") {
                  Object.entries(itemValue as any).forEach(([subItemKey, subItemValue]) => {
                    if (typeof subItemValue === "object") {
                      Object.entries(subItemValue as any).forEach(([subSubItemKey, subSubItemValue]) => {
                        acc[`${key}[${index}][${itemKey}][${subItemKey}][${subSubItemKey}]`] = subSubItemValue;
                      });
                    } else {
                      acc[`${key}[${index}][${itemKey}][${subItemKey}]`] = subItemValue;
                    }
                  });
                } else {
                  acc[`${key}[${index}][${itemKey}]`] = itemValue;
                }
              });
            });
          } else {
            acc[key] = value;
          }
          return acc;
        }, {})
      ).toString(),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error("CREATE_CHECKOUT_SESSION", "Stripe API error", {
        status: stripeResponse.status,
        error: errorText,
      });
      throw new Error(`Stripe API error: ${stripeResponse.status} - ${errorText}`);
    }

    const session = await stripeResponse.json();

    console.log("CREATE_CHECKOUT_SESSION", "Session created successfully", {
      user_id: user.id,
      session_id: session.id,
      checkout_url: session.url,
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("CREATE_CHECKOUT_SESSION", "Error", {
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
