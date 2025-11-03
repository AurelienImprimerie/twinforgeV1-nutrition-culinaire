import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GoalSyncPayload {
  activity_id: string;
  user_id: string;
}

interface TrainingGoal {
  id: string;
  user_id: string;
  title: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  unit: string;
  discipline?: string;
  deadline?: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ActivityMetrics {
  id: string;
  user_id: string;
  timestamp: string;
  type: string;
  duration_min?: number;
  distance_meters?: number;
  calories_est?: number;
  vo2max_estimated?: number;
  training_load_score?: number;
  avg_power_watts?: number;
  efficiency_score?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const payload: GoalSyncPayload = await req.json();
    const { activity_id, user_id } = payload;

    if (!activity_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing activity_id or user_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: activity, error: activityError } = await supabaseClient
      .from("activities")
      .select("*")
      .eq("id", activity_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (activityError) {
      console.error("Error fetching activity:", activityError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch activity", details: activityError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!activity) {
      return new Response(
        JSON.stringify({ error: "Activity not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: activeGoals, error: goalsError } = await supabaseClient
      .from("training_goals")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true);

    if (goalsError) {
      console.error("Error fetching goals:", goalsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch goals", details: goalsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];

    for (const goal of activeGoals || []) {
      const valueToAdd = extractValueFromActivity(goal, activity);

      if (valueToAdd === null || valueToAdd === 0) {
        continue;
      }

      const newValue = goal.current_value + valueToAdd;

      const { data: updatedGoal, error: updateError } = await supabaseClient
        .from("training_goals")
        .update({ current_value: newValue })
        .eq("id", goal.id)
        .eq("user_id", user_id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating goal:", updateError);
        continue;
      }

      const progressPercentage = (newValue / goal.target_value) * 100;

      if (progressPercentage >= 100) {
        await supabaseClient
          .from("training_goals")
          .update({ status: "completed", is_active: false })
          .eq("id", goal.id)
          .eq("user_id", user_id);
      }

      results.push({
        goal_id: goal.id,
        goal_title: goal.title,
        updated: true,
        old_value: goal.current_value,
        new_value: newValue,
        progress_percentage: Math.min(progressPercentage, 100),
        completed: progressPercentage >= 100,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        activity_id,
        user_id,
        goals_updated: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function extractValueFromActivity(goal: TrainingGoal, activity: ActivityMetrics): number | null {
  switch (goal.goal_type) {
    case "volume":
      if (goal.unit === "minutes" || goal.unit === "min") {
        return activity.duration_min || 0;
      }
      if (goal.unit === "sessions") {
        return 1;
      }
      return 0;

    case "distance":
      if (activity.distance_meters && (goal.unit === "km" || goal.unit === "kilometers")) {
        return activity.distance_meters / 1000;
      }
      if (activity.distance_meters && (goal.unit === "m" || goal.unit === "meters")) {
        return activity.distance_meters;
      }
      return 0;

    case "endurance":
      if (goal.unit === "vo2max" && activity.vo2max_estimated) {
        return activity.vo2max_estimated - goal.current_value;
      }
      return 0;

    case "strength":
      if (goal.unit === "sessions" && isStrengthActivity(activity.type)) {
        return 1;
      }
      if (goal.unit === "total_load" && activity.training_load_score) {
        return activity.training_load_score;
      }
      return 0;

    case "frequency":
      if (goal.unit === "sessions_per_week") {
        return 1;
      }
      return 0;

    default:
      return 0;
  }
}

function isStrengthActivity(activityType: string): boolean {
  const strengthTypes = ["musculation", "force", "strength", "weightlifting", "powerlifting", "crossfit"];
  return strengthTypes.some((type) => activityType.toLowerCase().includes(type));
}
