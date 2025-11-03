import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
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
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    if (!stripeWebhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("STRIPE_WEBHOOKS", "Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.text();
    const event: StripeEvent = JSON.parse(body);

    console.log("STRIPE_WEBHOOKS", "Received event", {
      event_id: event.id,
      event_type: event.type,
      timestamp: new Date().toISOString(),
    });

    await supabase.from("stripe_webhooks_log").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      event_data: event,
      processing_status: "pending",
      stripe_created_at: new Date(event.created * 1000).toISOString(),
      received_at: new Date().toISOString(),
    });

    let processingResult: { success: boolean; message?: string; error?: string } = {
      success: true,
    };

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          processingResult = await handleSubscriptionChange(supabase, event);
          break;

        case "customer.subscription.deleted":
          processingResult = await handleSubscriptionDeleted(supabase, event);
          break;

        case "invoice.payment_succeeded":
          processingResult = await handleInvoicePaymentSucceeded(supabase, event);
          break;

        case "invoice.payment_failed":
          processingResult = await handleInvoicePaymentFailed(supabase, event);
          break;

        case "payment_intent.succeeded":
          processingResult = await handlePaymentIntentSucceeded(supabase, event);
          break;

        case "checkout.session.completed":
          processingResult = await handleCheckoutSessionCompleted(supabase, event);
          break;

        default:
          console.log("STRIPE_WEBHOOKS", "Unhandled event type", { event_type: event.type });
          processingResult = { success: true, message: "Event type not handled" };
      }

      await supabase
        .from("stripe_webhooks_log")
        .update({
          processing_status: processingResult.success ? "processed" : "failed",
          processing_error: processingResult.error,
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", event.id);
    } catch (processingError) {
      console.error("STRIPE_WEBHOOKS", "Processing error", {
        event_id: event.id,
        event_type: event.type,
        error: processingError instanceof Error ? processingError.message : "Unknown error",
      });

      await supabase
        .from("stripe_webhooks_log")
        .update({
          processing_status: "failed",
          processing_error: processingError instanceof Error ? processingError.message : "Unknown error",
          processing_attempts: 1,
        })
        .eq("stripe_event_id", event.id);

      throw processingError;
    }

    return new Response(JSON.stringify({ received: true, ...processingResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("STRIPE_WEBHOOKS", "Fatal error", {
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

async function handleSubscriptionChange(supabase: any, event: StripeEvent) {
  const subscription = event.data.object;
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price.id;
  const status = subscription.status;

  console.log("STRIPE_WEBHOOKS", "Handling subscription change", {
    subscription_id: subscriptionId,
    customer_id: customerId,
    status,
  });

  const { data: existingSubscription } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  let userId = existingSubscription?.user_id;

  if (!userId) {
    const { data: existingByCustomer } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("stripe_customer_id", customerId)
      .single();

    userId = existingByCustomer?.user_id;
  }

  if (!userId) {
    console.warn("STRIPE_WEBHOOKS", "User not found for subscription", {
      subscription_id: subscriptionId,
      customer_id: customerId,
    });
    return { success: false, error: "User not found for subscription" };
  }

  const { data: pricingConfig } = await supabase
    .from("token_pricing_config")
    .select("subscription_plans")
    .eq("is_active", true)
    .single();

  let planType = "starter_9";
  let tokensQuota = 150000;

  if (pricingConfig?.subscription_plans) {
    const plans = pricingConfig.subscription_plans;
    for (const [key, plan] of Object.entries(plans)) {
      if ((plan as any).stripe_price_id === priceId) {
        planType = key;
        tokensQuota = (plan as any).tokens_per_month || (plan as any).tokens_monthly || 150000;
        break;
      }
    }
  }

  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    plan_type: planType,
    subscription_status: status,
    tokens_monthly_quota: tokensQuota,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
  };

  const { error: upsertError } = await supabase
    .from("user_subscriptions")
    .upsert(subscriptionData, {
      onConflict: "stripe_subscription_id",
    });

  if (upsertError) {
    console.error("STRIPE_WEBHOOKS", "Failed to upsert subscription", { error: upsertError });
    return { success: false, error: upsertError.message };
  }

  console.log("STRIPE_WEBHOOKS", "Subscription updated successfully", {
    user_id: userId,
    plan_type: planType,
    tokens_quota: tokensQuota,
  });

  return { success: true, message: "Subscription updated" };
}

async function handleSubscriptionDeleted(supabase: any, event: StripeEvent) {
  const subscription = event.data.object;
  const subscriptionId = subscription.id;

  console.log("STRIPE_WEBHOOKS", "Handling subscription deletion", {
    subscription_id: subscriptionId,
  });

  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      subscription_status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("STRIPE_WEBHOOKS", "Failed to update subscription status", { error });
    return { success: false, error: error.message };
  }

  return { success: true, message: "Subscription deleted" };
}

async function handleInvoicePaymentSucceeded(supabase: any, event: StripeEvent) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return { success: true, message: "Invoice not related to subscription" };
  }

  console.log("STRIPE_WEBHOOKS", "Handling invoice payment succeeded", {
    invoice_id: invoice.id,
    subscription_id: subscriptionId,
  });

  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!subscription) {
    return { success: false, error: "Subscription not found" };
  }

  const result = await supabase.rpc("add_tokens", {
    p_user_id: subscription.user_id,
    p_token_amount: subscription.tokens_monthly_quota,
    p_transaction_type: "monthly_reset",
    p_token_category: "subscription",
    p_metadata: {
      stripe_invoice_id: invoice.id,
      billing_reason: invoice.billing_reason,
    },
  });

  if (result.error) {
    console.error("STRIPE_WEBHOOKS", "Failed to add tokens", { error: result.error });
    return { success: false, error: result.error.message };
  }

  const { error: updateError } = await supabase
    .from("user_token_balance")
    .update({
      last_monthly_reset: new Date().toISOString(),
      tokens_consumed_last_month: 0,
      tokens_consumed_this_month: 0,
    })
    .eq("user_id", subscription.user_id);

  if (updateError) {
    console.error("STRIPE_WEBHOOKS", "Failed to reset monthly stats", { error: updateError });
  }

  console.log("STRIPE_WEBHOOKS", "Tokens added successfully", {
    user_id: subscription.user_id,
    tokens_added: subscription.tokens_monthly_quota,
  });

  return { success: true, message: "Tokens added for subscription renewal" };
}

async function handleInvoicePaymentFailed(supabase: any, event: StripeEvent) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return { success: true, message: "Invoice not related to subscription" };
  }

  console.log("STRIPE_WEBHOOKS", "Handling invoice payment failed", {
    invoice_id: invoice.id,
    subscription_id: subscriptionId,
  });

  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      subscription_status: "past_due",
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("STRIPE_WEBHOOKS", "Failed to update subscription status", { error });
    return { success: false, error: error.message };
  }

  return { success: true, message: "Subscription marked as past_due" };
}

async function handlePaymentIntentSucceeded(supabase: any, event: StripeEvent) {
  const paymentIntent = event.data.object;
  const metadata = paymentIntent.metadata || {};

  if (metadata.token_purchase !== "true") {
    return { success: true, message: "Payment not related to token purchase" };
  }

  console.log("STRIPE_WEBHOOKS", "Handling one-time token purchase", {
    payment_intent_id: paymentIntent.id,
    user_id: metadata.user_id,
    tokens: metadata.token_amount,
  });

  const userId = metadata.user_id;
  const tokenAmount = parseInt(metadata.token_amount, 10);

  if (!userId || !tokenAmount) {
    return { success: false, error: "Missing metadata for token purchase" };
  }

  const result = await supabase.rpc("add_tokens", {
    p_user_id: userId,
    p_token_amount: tokenAmount,
    p_transaction_type: "purchase",
    p_token_category: "onetime",
    p_stripe_payment_intent_id: paymentIntent.id,
    p_metadata: {
      pack_id: metadata.pack_id,
      amount_paid_eur: paymentIntent.amount / 100,
    },
  });

  if (result.error) {
    console.error("STRIPE_WEBHOOKS", "Failed to add tokens", { error: result.error });
    return { success: false, error: result.error.message };
  }

  console.log("STRIPE_WEBHOOKS", "One-time tokens added successfully", {
    user_id: userId,
    tokens_added: tokenAmount,
  });

  return { success: true, message: "One-time tokens added" };
}

async function handleCheckoutSessionCompleted(supabase: any, event: StripeEvent) {
  const session = event.data.object;
  const metadata = session.metadata || {};

  console.log("STRIPE_WEBHOOKS", "Handling checkout session completed", {
    session_id: session.id,
    mode: session.mode,
    customer_id: session.customer,
  });

  if (session.mode === "subscription") {
    const subscriptionId = session.subscription;
    const userId = metadata.user_id;

    if (!userId) {
      return { success: false, error: "Missing user_id in metadata" };
    }

    const { error } = await supabase
      .from("user_subscriptions")
      .update({
        stripe_customer_id: session.customer,
      })
      .eq("user_id", userId)
      .eq("stripe_subscription_id", subscriptionId);

    if (error) {
      console.error("STRIPE_WEBHOOKS", "Failed to link customer", { error });
      return { success: false, error: error.message };
    }

    return { success: true, message: "Checkout session linked to user" };
  }

  return { success: true, message: "Checkout session completed (no action needed)" };
}
