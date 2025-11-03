/**
 * Edge Function: Process Detection Jobs
 * Traite les jobs d'analyse d'équipements en arrière-plan
 */

import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DetectionJob {
  id: string;
  user_id: string;
  location_id: string;
  photo_id: string;
  status: string;
  retry_count: number;
}

interface PhotoData {
  photo_url: string;
}

interface LocationData {
  type: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: pendingJobs, error: fetchError } = await supabase
      .from('equipment_detection_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending jobs to process',
          processed: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const results = [];

    for (const job of pendingJobs as DetectionJob[]) {
      try {
        await supabase
          .from('equipment_detection_jobs')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        const { data: photoData, error: photoError } = await supabase
          .from('training_location_photos')
          .select('photo_url')
          .eq('id', job.photo_id)
          .single();

        if (photoError || !photoData) {
          throw new Error('Photo not found');
        }

        const { data: locationData, error: locationError } = await supabase
          .from('training_locations')
          .select('type')
          .eq('id', job.location_id)
          .single();

        if (locationError || !locationData) {
          throw new Error('Location not found');
        }

        const detectResponse = await fetch(
          `${supabaseUrl}/functions/v1/detect-equipment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              photoUrl: (photoData as PhotoData).photo_url,
              photoId: job.photo_id,
              locationId: job.location_id,
              locationType: (locationData as LocationData).type,
            }),
          }
        );

        if (!detectResponse.ok) {
          throw new Error(`Detection failed: ${detectResponse.statusText}`);
        }

        const detectResult = await detectResponse.json();

        await supabase
          .from('equipment_detection_jobs')
          .update({
            status: 'completed',
            progress_percentage: 100,
            equipment_detected_count: detectResult.equipment_count || 0,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        results.push({
          jobId: job.id,
          status: 'completed',
          equipmentCount: detectResult.equipment_count || 0,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (job.retry_count < 3) {
          await supabase
            .from('equipment_detection_jobs')
            .update({
              status: 'pending',
              retry_count: job.retry_count + 1,
              error_message: errorMessage,
            })
            .eq('id', job.id);

          results.push({
            jobId: job.id,
            status: 'retrying',
            retryCount: job.retry_count + 1,
            error: errorMessage,
          });
        } else {
          await supabase
            .from('equipment_detection_jobs')
            .update({
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          results.push({
            jobId: job.id,
            status: 'failed',
            error: errorMessage,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} jobs`,
        processed: results.length,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing detection jobs:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
