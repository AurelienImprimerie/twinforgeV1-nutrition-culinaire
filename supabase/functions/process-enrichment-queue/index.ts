/*
  Fonction Edge: process-enrichment-queue
  Worker automatique pour enrichir les activités avec données biométriques

  Rôle:
  - Traiter la queue activity_enrichment_queue
  - Appeler enrich-activity-wearable pour chaque activité en attente
  - Gérer les retry et les erreurs
  - Mettre à jour le statut dans la queue
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 10;

interface EnrichmentJob {
  id: string;
  activity_id: string;
  user_id: string;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Import Supabase dynamically
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.54.0');

    const startTime = Date.now();

    console.log('🔥 [ENRICHMENT_WORKER] Starting enrichment queue processing', {
      batchSize: BATCH_SIZE,
      maxAttempts: MAX_ATTEMPTS,
      timestamp: new Date().toISOString(),
    });

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending enrichment jobs
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('activity_enrichment_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch enrichment queue: ${fetchError.message}`);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('🔥 [ENRICHMENT_WORKER] No pending enrichment jobs', {
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending enrichment jobs',
          processed: 0,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🔥 [ENRICHMENT_WORKER] Found pending jobs', {
      jobCount: pendingJobs.length,
      timestamp: new Date().toISOString(),
    });

    const results = {
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each job
    for (const job of pendingJobs) {
      try {
        console.log('🔥 [ENRICHMENT_WORKER] Processing job', {
          jobId: job.id,
          activityId: job.activity_id,
          userId: job.user_id,
          attempts: job.attempts + 1,
          timestamp: new Date().toISOString(),
        });

        // Update status to processing
        await supabase
          .from('activity_enrichment_queue')
          .update({
            status: 'processing',
            attempts: job.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Call enrich-activity-wearable function
        const enrichResponse = await fetch(
          `${supabaseUrl}/functions/v1/enrich-activity-wearable`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              activityId: job.activity_id,
              userId: job.user_id,
            }),
          }
        );

        if (!enrichResponse.ok) {
          const errorText = await enrichResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }

          throw new Error(errorData.error || 'Enrichment failed');
        }

        const enrichResult = await enrichResponse.json();

        console.log('✅ [ENRICHMENT_WORKER] Job completed', {
          jobId: job.id,
          activityId: job.activity_id,
          enriched: enrichResult.enriched,
          fieldsEnriched: enrichResult.fieldsEnriched?.length || 0,
          timestamp: new Date().toISOString(),
        });

        // Update status to completed or skipped
        const newStatus = enrichResult.enriched ? 'completed' : 'skipped';
        await supabase
          .from('activity_enrichment_queue')
          .update({
            status: newStatus,
            enrichment_data: enrichResult,
            error_message: null,
          })
          .eq('id', job.id);

        results.processed++;
        if (newStatus === 'completed') {
          results.completed++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error('❌ [ENRICHMENT_WORKER] Job failed', {
          jobId: job.id,
          activityId: job.activity_id,
          error: errorMessage,
          attempts: job.attempts + 1,
          timestamp: new Date().toISOString(),
        });

        // Check if max attempts reached
        const newStatus = job.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending';

        await supabase
          .from('activity_enrichment_queue')
          .update({
            status: newStatus,
            error_message: errorMessage,
          })
          .eq('id', job.id);

        results.processed++;
        results.failed++;
        results.errors.push(`Activity ${job.activity_id}: ${errorMessage}`);
      }
    }

    const processingTime = Date.now() - startTime;

    console.log('✅ [ENRICHMENT_WORKER] Batch processing completed', {
      ...results,
      processingTime,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        processingTime,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ [ENRICHMENT_WORKER] Worker error:', error);
    return new Response(
      JSON.stringify({
        error: 'Enrichment worker failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});
