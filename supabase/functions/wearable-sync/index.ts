import { corsHeaders } from '../_shared/cors.ts';

/**
 * Wearable Data Synchronization
 * Fetches and normalizes data from wearable providers
 */

interface SyncRequest {
  deviceId: string;
  dataTypes?: string[];
  startDate?: string;
  endDate?: string;
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

    // Use dynamic import with proper Deno syntax
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

    const { deviceId, dataTypes, startDate, endDate }: SyncRequest = await req.json();

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Device ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: device, error: deviceError } = await supabase
      .from('connected_devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: 'Device not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (device.status === 'disconnected') {
      return new Response(JSON.stringify({ error: 'Device disconnected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();

    const { data: syncHistory, error: syncError } = await supabase
      .from('device_sync_history')
      .insert({
        device_id: deviceId,
        user_id: user.id,
        sync_type: 'manual',
        status: 'success',
        data_types_synced: dataTypes || [],
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncError) {
      throw syncError;
    }

    await supabase
      .from('connected_devices')
      .update({ status: 'syncing' })
      .eq('id', deviceId);

    let recordsFetched = 0;
    let recordsStored = 0;
    let syncStatus: 'success' | 'partial' | 'failed' = 'success';
    let errorMessage: string | null = null;

    try {
      const syncResult = await syncProviderData(
        device.provider,
        device.access_token_encrypted,
        dataTypes || ['workout', 'heart_rate', 'steps', 'calories'],
        startDate,
        endDate
      );

      recordsFetched = syncResult.totalRecords;

      for (const dataPoint of syncResult.data) {
        const { error: insertError } = await supabase.from('wearable_health_data').insert({
          user_id: user.id,
          device_id: deviceId,
          data_type: dataPoint.dataType,
          timestamp: dataPoint.timestamp,
          value_numeric: dataPoint.valueNumeric,
          value_text: dataPoint.valueText,
          value_json: dataPoint.valueJson,
          unit: dataPoint.unit,
          quality_score: dataPoint.qualityScore,
          raw_data: dataPoint.rawData,
          synced_at: new Date().toISOString(),
        });

        if (!insertError) {
          recordsStored++;
        }
      }

      if (recordsStored < recordsFetched) {
        syncStatus = 'partial';
        errorMessage = 'Some records could not be stored';
      }

      await supabase
        .from('connected_devices')
        .update({
          status: 'connected',
          last_sync_at: new Date().toISOString(),
          last_error: null,
          error_count: 0,
        })
        .eq('id', deviceId);
    } catch (error) {
      syncStatus = 'failed';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await supabase
        .from('connected_devices')
        .update({
          status: 'error',
          last_error: errorMessage,
          error_count: device.error_count + 1,
        })
        .eq('id', deviceId);
    }

    const durationMs = Date.now() - startTime;

    await supabase
      .from('device_sync_history')
      .update({
        status: syncStatus,
        records_fetched: recordsFetched,
        records_stored: recordsStored,
        duration_ms: durationMs,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncHistory.id);

    return new Response(
      JSON.stringify({
        success: syncStatus === 'success',
        status: syncStatus,
        recordsFetched,
        recordsStored,
        durationMs,
        errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Sync error:', error);

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

async function syncProviderData(
  provider: string,
  accessToken: string,
  dataTypes: string[],
  startDate?: string,
  endDate?: string
) {
  const data: any[] = [];
  let totalRecords = 0;

  const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  for (const dataType of dataTypes) {
    try {
      const providerData = await fetchProviderData(provider, accessToken, dataType, start, end);
      const normalized = normalizeProviderData(provider, dataType, providerData);
      data.push(...normalized);
      totalRecords += providerData.length;
    } catch (error) {
      console.error(`Error fetching ${dataType} from ${provider}:`, error);
    }
  }

  return { data, totalRecords };
}

async function fetchProviderData(
  provider: string,
  accessToken: string,
  dataType: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const endpoints: Record<string, Record<string, string>> = {
    strava: {
      workout: 'https://www.strava.com/api/v3/athlete/activities',
    },
    garmin: {
      workout: 'https://apis.garmin.com/wellness-api/rest/activities',
      heart_rate: 'https://apis.garmin.com/wellness-api/rest/heartRate',
      steps: 'https://apis.garmin.com/wellness-api/rest/dailies',
    },
    fitbit: {
      heart_rate: 'https://api.fitbit.com/1/user/-/activities/heart/date',
      steps: 'https://api.fitbit.com/1/user/-/activities/steps/date',
      workout: 'https://api.fitbit.com/1/user/-/activities/list.json',
    },
    google_fit: {
      activity: 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      heart_rate: 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      steps: 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      calories: 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      distance: 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      workout: 'https://www.googleapis.com/fitness/v1/users/me/sessions',
    },
  };

  const endpoint = endpoints[provider]?.[dataType];
  if (!endpoint) {
    return [];
  }

  if (provider === 'google_fit' && dataType !== 'workout') {
    const startTimeMillis = new Date(startDate).getTime();
    const endTimeMillis = new Date(endDate).getTime();

    const dataSourceMap: Record<string, string> = {
      heart_rate: 'com.google.heart_rate.bpm',
      steps: 'com.google.step_count.delta',
      calories: 'com.google.calories.expended',
      distance: 'com.google.distance.delta',
    };

    const dataSourceId = dataSourceMap[dataType];
    if (!dataSourceId) {
      return [];
    }

    const requestBody = {
      aggregateBy: [{
        dataTypeName: dataSourceId,
      }],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis,
      endTimeMillis,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${dataType} from ${provider}`);
    }

    const data = await response.json();
    return data.bucket || [];
  }

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${dataType} from ${provider}`);
  }

  const data = await response.json();

  if (provider === 'google_fit' && dataType === 'workout') {
    return data.session || [];
  }

  return Array.isArray(data) ? data : data.activities || [];
}

function normalizeProviderData(provider: string, dataType: string, rawData: any[]): any[] {
  return rawData.map((item) => {
    const normalized: any = {
      dataType,
      rawData: item,
    };

    switch (provider) {
      case 'strava':
        normalized.timestamp = item.start_date;
        normalized.valueNumeric = item.distance || item.moving_time;
        normalized.unit = dataType === 'workout' ? 'meters' : 'seconds';
        normalized.qualityScore = 95;
        break;

      case 'garmin':
        normalized.timestamp = item.summaryDate || item.startTimeGMT;
        normalized.valueNumeric = item.steps || item.heartRate || item.calories;
        normalized.unit = dataType === 'steps' ? 'steps' : dataType === 'heart_rate' ? 'bpm' : 'kcal';
        normalized.qualityScore = 90;
        break;

      case 'fitbit':
        normalized.timestamp = item.startTime || item.dateTime;
        normalized.valueNumeric = item.steps || item.value || item.heartRate;
        normalized.unit = dataType === 'steps' ? 'steps' : 'bpm';
        normalized.qualityScore = 85;
        break;

      case 'google_fit':
        if (dataType === 'workout') {
          normalized.timestamp = new Date(parseInt(item.startTimeMillis)).toISOString();
          normalized.valueJson = {
            activityType: item.activityType || item.name,
            startTime: new Date(parseInt(item.startTimeMillis)).toISOString(),
            endTime: new Date(parseInt(item.endTimeMillis)).toISOString(),
            durationSeconds: Math.round((parseInt(item.endTimeMillis) - parseInt(item.startTimeMillis)) / 1000),
            name: item.name,
            description: item.description,
          };
          normalized.unit = 'activity';
          normalized.qualityScore = 90;
        } else {
          normalized.timestamp = new Date(parseInt(item.startTimeMillis || item.endTimeMillis)).toISOString();

          const dataPoints = item.dataset?.[0]?.point || [];
          if (dataPoints.length > 0) {
            const point = dataPoints[0];
            const value = point.value?.[0];

            if (dataType === 'heart_rate') {
              normalized.valueNumeric = value?.fpVal || value?.intVal;
              normalized.unit = 'bpm';
            } else if (dataType === 'steps') {
              normalized.valueNumeric = value?.intVal || 0;
              normalized.unit = 'steps';
            } else if (dataType === 'calories') {
              normalized.valueNumeric = value?.fpVal || 0;
              normalized.unit = 'kcal';
            } else if (dataType === 'distance') {
              normalized.valueNumeric = (value?.fpVal || 0) / 1000;
              normalized.unit = 'km';
            }
          } else {
            normalized.valueNumeric = 0;
            normalized.unit = dataType === 'heart_rate' ? 'bpm' : dataType === 'steps' ? 'steps' : 'kcal';
          }

          normalized.qualityScore = 85;
        }
        break;

      default:
        normalized.timestamp = new Date().toISOString();
        normalized.valueNumeric = 0;
        normalized.qualityScore = 50;
    }

    return normalized;
  });
}
