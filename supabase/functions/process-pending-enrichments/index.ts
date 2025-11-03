import { corsHeaders } from '../_shared/cors.ts';

/**
 * Process Pending Activity Enrichments
 * Automatically processes pending activity enrichments from the activity_enrichment_log table
 * This function is called periodically by a cron job or manually
 */

interface EnrichmentLog {
  id: string;
  activity_id: string;
  user_id: string;
  status: string;
  attempt_count: number;
}

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 10;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2.54.0');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[PROCESS_ENRICHMENTS] Starting batch processing');

    // Fetch pending enrichments with retry limit
    const { data: pendingLogs, error: fetchError } = await supabase
      .from('activity_enrichment_log')
      .select('id, activity_id, user_id, status, attempt_count')
      .eq('status', 'pending')
      .lt('attempt_count', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      console.log('[PROCESS_ENRICHMENTS] No pending enrichments found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending enrichments to process',
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[PROCESS_ENRICHMENTS] Found ${pendingLogs.length} pending enrichments`);

    const results = {
      total: pendingLogs.length,
      success: 0,
      failed: 0,
      skipped: 0,
    };

    // Process each enrichment
    for (const log of pendingLogs) {
      console.log(`[PROCESS_ENRICHMENTS] Processing activity ${log.activity_id}`);

      // Update status to processing
      await supabase
        .from('activity_enrichment_log')
        .update({
          status: 'processing',
          attempt_count: log.attempt_count + 1,
        })
        .eq('id', log.id);

      try {
        // Call the enrich-activity-wearable function
        const enrichResponse = await fetch(
          `${supabaseUrl}/functions/v1/enrich-activity-wearable`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              activityId: log.activity_id,
              userId: log.user_id,
            }),
          }
        );

        if (!enrichResponse.ok) {
          const errorText = await enrichResponse.text();
          throw new Error(`Enrichment failed: ${errorText}`);
        }

        const enrichResult = await enrichResponse.json();

        // Update log with success
        await supabase
          .from('activity_enrichment_log')
          .update({
            status: enrichResult.enriched ? 'success' : 'skipped',
            fields_enriched: enrichResult.fieldsEnriched || [],
            data_points_processed: enrichResult.dataPointsProcessed || 0,
            primary_device_id: enrichResult.primaryDeviceId || null,
            error_message: enrichResult.message || null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', log.id);

        if (enrichResult.enriched) {
          results.success++;
          console.log(
            `[PROCESS_ENRICHMENTS] Successfully enriched activity ${log.activity_id} with ${enrichResult.fieldsEnriched?.length || 0} fields`
          );
        } else {
          results.skipped++;
          console.log(
            `[PROCESS_ENRICHMENTS] Skipped activity ${log.activity_id}: ${enrichResult.message}`
          );
        }
      } catch (error) {
        results.failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error during enrichment';
        console.error(`[PROCESS_ENRICHMENTS] Error enriching activity ${log.activity_id}:`, error);

        // Update log with failure
        await supabase
          .from('activity_enrichment_log')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', log.id);
      }
    }

    console.log('[PROCESS_ENRICHMENTS] Batch processing completed', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Batch processing completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[PROCESS_ENRICHMENTS] Fatal error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
