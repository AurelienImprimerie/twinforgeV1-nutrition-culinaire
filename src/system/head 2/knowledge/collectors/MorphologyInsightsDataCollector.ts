/**
 * MorphologyInsightsDataCollector - Collect AI-generated morphology insights
 * Aggregates insights from ai_morphology_insights table with their analyses
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type {
  MorphologyInsightsKnowledge,
  MorphInsight,
  MorphInsightSummary,
  MorphInsightsSummary
} from '../../types';

export class MorphologyInsightsDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<MorphologyInsightsKnowledge> {
    try {
      logger.info('MORPHOLOGY_INSIGHTS_COLLECTOR', 'Starting morphology insights collection', { userId });

      const latestInsights = await this.collectLatestInsights(userId);
      const recentInsights = await this.collectRecentInsights(userId);

      // Extract latest summary
      const summary = latestInsights.length > 0 && latestInsights[0].summary
        ? latestInsights[0].summary
        : null;

      const lastInsightDate = recentInsights.length > 0 ? recentInsights[0].generatedAt : null;

      // Extract unique AI models used
      const aiModelsUsed = [...new Set(recentInsights.map(r => r.aiModel))];

      const hasData = latestInsights.length > 0;

      logger.info('MORPHOLOGY_INSIGHTS_COLLECTOR', 'Morphology insights collected', {
        userId,
        latestInsightsCount: latestInsights.length,
        recentInsightsCount: recentInsights.length,
        aiModelsUsed,
        hasData
      });

      return {
        latestInsights,
        recentInsights,
        lastInsightDate,
        summary,
        totalInsightsGenerated: recentInsights.length,
        aiModelsUsed,
        hasData
      };
    } catch (error) {
      logger.error('MORPHOLOGY_INSIGHTS_COLLECTOR', 'Failed to collect morphology insights', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect latest insights (from most recent scan)
   */
  private async collectLatestInsights(userId: string): Promise<Array<MorphInsight & { summary: MorphInsightsSummary | null }>> {
    // First, try to get the latest insight
    const { data: latestInsights, error } = await this.supabase
      .from('ai_morphology_insights')
      .select('id, scan_id, insights_data, summary_data, generated_at, ai_model_used, ai_confidence, input_hash')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(5);

    if (error) {
      logger.error('MORPHOLOGY_INSIGHTS_COLLECTOR', 'Failed to load latest insights', {
        userId,
        error: error.message,
        errorDetails: error
      });
      return [];
    }

    if (!latestInsights || latestInsights.length === 0) {
      logger.warn('MORPHOLOGY_INSIGHTS_COLLECTOR', 'No insights found for user', { userId });
      return [];
    }

    // Get the most recent one with valid insights_data
    const latestInsight = latestInsights.find(insight =>
      insight.insights_data && Array.isArray(insight.insights_data) && insight.insights_data.length > 0
    );

    if (!latestInsight || !latestInsight.insights_data) {
      logger.warn('MORPHOLOGY_INSIGHTS_COLLECTOR', 'No valid insights_data found', {
        userId,
        availableRecords: latestInsights.length,
        recordIds: latestInsights.map(i => i.id)
      });
      return [];
    }

    logger.info('MORPHOLOGY_INSIGHTS_COLLECTOR', 'Latest insights loaded successfully', {
      userId,
      insightId: latestInsight.id,
      scanId: latestInsight.scan_id,
      insightsCount: latestInsight.insights_data.length,
      generatedAt: latestInsight.generated_at,
      inputHash: latestInsight.input_hash?.substring(0, 8)
    });

    // Map insights data and attach summary
    const insights = (latestInsight.insights_data as MorphInsight[]).map(insight => ({
      ...insight,
      summary: latestInsight.summary_data as MorphInsightsSummary | null
    }));

    return insights;
  }

  /**
   * Collect recent insights (last 90 days)
   */
  private async collectRecentInsights(userId: string): Promise<MorphInsightSummary[]> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: insights, error } = await this.supabase
      .from('ai_morphology_insights')
      .select('id, scan_id, user_id, generated_at, insights_data, ai_model_used, ai_confidence')
      .eq('user_id', userId)
      .gte('generated_at', ninetyDaysAgo.toISOString())
      .order('generated_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('MORPHOLOGY_INSIGHTS_COLLECTOR', 'Failed to load recent insights', { userId, error });
      return [];
    }

    if (!insights || insights.length === 0) {
      return [];
    }

    return insights.map((insight) => {
      const insightsData = insight.insights_data as MorphInsight[] || [];
      const highPriorityCount = insightsData.filter((i: MorphInsight) => i.priority === 'high').length;

      return {
        scanId: insight.scan_id,
        userId: insight.user_id,
        generatedAt: insight.generated_at,
        insightsCount: insightsData.length,
        highPriorityCount,
        aiModel: insight.ai_model_used || 'unknown',
        confidence: insight.ai_confidence || 0
      };
    });
  }

  /**
   * Get insights for a specific scan
   */
  async getInsightsForScan(scanId: string): Promise<MorphInsight[]> {
    const { data, error } = await this.supabase
      .from('ai_morphology_insights')
      .select('insights_data')
      .eq('scan_id', scanId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.insights_data) {
      logger.warn('MORPHOLOGY_INSIGHTS_COLLECTOR', 'No insights found for scan', { scanId });
      return [];
    }

    return data.insights_data as MorphInsight[];
  }
}
