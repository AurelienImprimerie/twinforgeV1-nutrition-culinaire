import { corsHeaders } from '../_shared/cors.ts';

/**
 * Enrich Activity with Wearable Data
 * Automatically enriches an activity with biometric data from connected wearables
 */

interface EnrichRequest {
  activityId: string;
  userId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.54.0');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { activityId, userId: requestUserId }: EnrichRequest = await req.json();

    if (!activityId) {
      return new Response(JSON.stringify({ error: 'Activity ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = requestUserId || user.id;

    console.log('[ENRICH] Starting enrichment for activity', { activityId, userId });

    // 1. Fetch the activity
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .eq('user_id', userId)
      .single();

    if (activityError || !activity) {
      return new Response(
        JSON.stringify({ error: 'Activity not found', details: activityError?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If already enriched, skip
    if (activity.wearable_device_id) {
      console.log('[ENRICH] Activity already enriched', { activityId });
      return new Response(
        JSON.stringify({
          success: true,
          enriched: false,
          message: 'Activity already enriched',
          fieldsEnriched: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Fetch connected devices
    const { data: devices, error: devicesError } = await supabase
      .from('connected_devices')
      .select('id, provider, status')
      .eq('user_id', userId)
      .eq('status', 'connected');

    if (devicesError || !devices || devices.length === 0) {
      console.log('[ENRICH] No connected devices found', { userId });
      return new Response(
        JSON.stringify({
          success: true,
          enriched: false,
          message: 'No connected devices found',
          fieldsEnriched: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Find wearable data in time window
    const activityTimestamp = new Date(activity.timestamp);
    const startWindow = new Date(activityTimestamp.getTime() - 5 * 60 * 1000); // 5 min before
    const endWindow = new Date(
      activityTimestamp.getTime() + activity.duration_min * 60 * 1000 + 5 * 60 * 1000
    ); // duration + 5 min after

    const { data: wearableData, error: wearableError } = await supabase
      .from('wearable_health_data')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startWindow.toISOString())
      .lte('timestamp', endWindow.toISOString())
      .order('timestamp', { ascending: true });

    if (wearableError || !wearableData || wearableData.length === 0) {
      console.log('[ENRICH] No wearable data found in time window', {
        activityId,
        startWindow: startWindow.toISOString(),
        endWindow: endWindow.toISOString(),
      });
      return new Response(
        JSON.stringify({
          success: true,
          enriched: false,
          message: 'No wearable data found in time window',
          fieldsEnriched: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[ENRICH] Found wearable data points', { count: wearableData.length });

    // 4. Aggregate wearable data
    const fields: Record<string, any> = {};
    const fieldsEnriched: string[] = [];
    let primaryDeviceId: string | null = null;
    const rawData: Record<string, any> = {};

    // Group by data type
    const dataByType: Record<string, any[]> = {};
    wearableData.forEach((dp) => {
      if (!dataByType[dp.data_type]) {
        dataByType[dp.data_type] = [];
      }
      dataByType[dp.data_type].push(dp);
    });

    // Set primary device
    if (wearableData.length > 0) {
      primaryDeviceId = wearableData[0].device_id;
    }

    // Process heart rate
    if (dataByType['heart_rate']) {
      const hrValues = dataByType['heart_rate']
        .map((d) => d.value_numeric)
        .filter((v) => v);
      if (hrValues.length > 0) {
        fields.hr_avg = Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length);
        fields.hr_max = Math.max(...hrValues);
        fields.hr_min = Math.min(...hrValues);
        fieldsEnriched.push('hr_avg', 'hr_max', 'hr_min');
        rawData.heart_rate = hrValues;
      }
    }

    // Process calories
    if (dataByType['calories']) {
      const caloriesValue = dataByType['calories'][0]?.value_numeric;
      if (caloriesValue) {
        fields.calories_est = Math.round(caloriesValue);
        fieldsEnriched.push('calories_est');
        rawData.calories = caloriesValue;
      }
    }

    // Process distance
    if (dataByType['distance']) {
      const distanceValue = dataByType['distance'][0]?.value_numeric;
      if (distanceValue) {
        fields.distance_meters = distanceValue;
        fieldsEnriched.push('distance_meters');
        rawData.distance = distanceValue;

        // Calculate average speed if duration available
        if (activity.duration_min > 0) {
          const speedKmh = distanceValue / 1000 / (activity.duration_min / 60);
          fields.avg_speed_kmh = Math.round(speedKmh * 100) / 100;
          fieldsEnriched.push('avg_speed_kmh');
        }
      }
    }

    // Process VO2max
    if (dataByType['vo2max']) {
      const vo2maxValue = dataByType['vo2max'][0]?.value_numeric;
      if (vo2maxValue) {
        fields.vo2max_estimated = vo2maxValue;
        fieldsEnriched.push('vo2max_estimated');
        rawData.vo2max = vo2maxValue;
      }
    }

    // Process HRV
    if (dataByType['hrv']) {
      const hrvValues = dataByType['hrv'].map((d) => d.value_numeric).filter((v) => v);
      if (hrvValues.length > 0) {
        fields.hrv_pre_activity = hrvValues[0];
        if (hrvValues.length > 1) {
          fields.hrv_post_activity = hrvValues[hrvValues.length - 1];
        }
        fieldsEnriched.push('hrv_pre_activity');
        rawData.hrv = hrvValues;
      }
    }

    // Process elevation
    if (dataByType['elevation']) {
      const elevationValue = dataByType['elevation'][0]?.value_numeric;
      if (elevationValue) {
        fields.elevation_gain_meters = elevationValue;
        fieldsEnriched.push('elevation_gain_meters');
        rawData.elevation = elevationValue;
      }
    }

    // Process cadence
    if (dataByType['cadence']) {
      const cadenceValues = dataByType['cadence']
        .map((d) => d.value_numeric)
        .filter((v) => v);
      if (cadenceValues.length > 0) {
        fields.avg_cadence_rpm = Math.round(
          cadenceValues.reduce((a, b) => a + b, 0) / cadenceValues.length
        );
        fields.max_cadence_rpm = Math.max(...cadenceValues);
        fieldsEnriched.push('avg_cadence_rpm', 'max_cadence_rpm');
        rawData.cadence = cadenceValues;
      }
    }

    // Process power
    if (dataByType['power']) {
      const powerValues = dataByType['power'].map((d) => d.value_numeric).filter((v) => v);
      if (powerValues.length > 0) {
        fields.avg_power_watts = Math.round(
          powerValues.reduce((a, b) => a + b, 0) / powerValues.length
        );
        fields.max_power_watts = Math.max(...powerValues);
        fieldsEnriched.push('avg_power_watts', 'max_power_watts');
        rawData.power = powerValues;
      }
    }

    // 5. Update activity with enriched data
    const { error: updateError } = await supabase
      .from('activities')
      .update({
        ...fields,
        wearable_device_id: primaryDeviceId,
        wearable_synced_at: new Date().toISOString(),
        wearable_raw_data: rawData,
      })
      .eq('id', activityId)
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    console.log('[ENRICH] Activity enriched successfully', {
      activityId,
      fieldsEnriched: fieldsEnriched.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        enriched: true,
        fieldsEnriched,
        dataPointsProcessed: wearableData.length,
        primaryDeviceId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ENRICH] Error:', error);
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
