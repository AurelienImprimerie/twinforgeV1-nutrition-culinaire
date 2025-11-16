/**
 * ActivityAnalysisCollector - Collect AI analysis jobs for activity tracking
 * Retrieves completed AI analyses: activity_analysis, trend_analysis, activity_transcription
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';

export interface ActivityAnalysisJob {
  id: string;
  userId: string;
  analysisType: 'activity_analysis' | 'trend_analysis' | 'activity_transcription';
  requestPayload: any;
  resultPayload: any;
  inputHash: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityAnalysisKnowledge {
  recentAnalyses: ActivityAnalysisJob[];
  analysisByType: {
    activityAnalysis: ActivityAnalysisJob[];
    trendAnalysis: ActivityAnalysisJob[];
    transcription: ActivityAnalysisJob[];
  };
  lastAnalysisDate: string | null;
  analysisCount: number;
  successRate: number;
  averageProcessingTime: number;
  cachedAnalysesCount: number;
  hasData: boolean;
}

export class ActivityAnalysisCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<ActivityAnalysisKnowledge> {
    try {
      logger.info('ACTIVITY_ANALYSIS_COLLECTOR', 'Starting activity analysis data collection', { userId });

      // Get last 30 days of completed analyses
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: analyses, error } = await this.supabase
        .from('ai_analysis_jobs')
        .select('*')
        .eq('user_id', userId)
        .in('analysis_type', ['activity_analysis', 'trend_analysis', 'activity_transcription'])
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('ACTIVITY_ANALYSIS_COLLECTOR', 'Failed to load activity analyses', { userId, error });
        return this.getDefaultKnowledge();
      }

      if (!analyses || analyses.length === 0) {
        logger.info('ACTIVITY_ANALYSIS_COLLECTOR', 'No activity analyses found', { userId });
        return this.getDefaultKnowledge();
      }

      // Map to typed structure
      const typedAnalyses: ActivityAnalysisJob[] = analyses.map(analysis => ({
        id: analysis.id,
        userId: analysis.user_id,
        analysisType: analysis.analysis_type as 'activity_analysis' | 'trend_analysis' | 'activity_transcription',
        requestPayload: analysis.request_payload,
        resultPayload: analysis.result_payload,
        inputHash: analysis.input_hash,
        status: analysis.status as 'processing' | 'completed' | 'failed',
        errorMessage: analysis.error_message,
        createdAt: analysis.created_at,
        updatedAt: analysis.updated_at
      }));

      // Filter by type
      const activityAnalysis = typedAnalyses.filter(a => a.analysisType === 'activity_analysis');
      const trendAnalysis = typedAnalyses.filter(a => a.analysisType === 'trend_analysis');
      const transcription = typedAnalyses.filter(a => a.analysisType === 'activity_transcription');

      // Calculate metrics
      const completedAnalyses = typedAnalyses.filter(a => a.status === 'completed');
      const successRate = typedAnalyses.length > 0
        ? (completedAnalyses.length / typedAnalyses.length) * 100
        : 0;

      // Calculate average processing time (from created_at to updated_at)
      const processingTimes = completedAnalyses.map(a => {
        const created = new Date(a.createdAt).getTime();
        const updated = new Date(a.updatedAt).getTime();
        return updated - created;
      });
      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      // Check for cached analyses (analyses with same input_hash)
      const inputHashes = new Set(typedAnalyses.map(a => a.inputHash));
      const cachedAnalysesCount = typedAnalyses.length - inputHashes.size;

      logger.info('ACTIVITY_ANALYSIS_COLLECTOR', 'Activity analyses data collected', {
        userId,
        totalAnalyses: typedAnalyses.length,
        completedCount: completedAnalyses.length,
        successRate: Math.round(successRate),
        avgProcessingTimeMs: Math.round(averageProcessingTime),
        cachedCount: cachedAnalysesCount
      });

      return {
        recentAnalyses: typedAnalyses.slice(0, 20), // Last 20
        analysisByType: {
          activityAnalysis,
          trendAnalysis,
          transcription
        },
        lastAnalysisDate: typedAnalyses[0]?.createdAt || null,
        analysisCount: typedAnalyses.length,
        successRate: Math.round(successRate),
        averageProcessingTime: Math.round(averageProcessingTime / 1000), // Convert to seconds
        cachedAnalysesCount,
        hasData: typedAnalyses.length > 0
      };
    } catch (error) {
      logger.error('ACTIVITY_ANALYSIS_COLLECTOR', 'Failed to collect activity analyses data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return this.getDefaultKnowledge();
    }
  }

  private getDefaultKnowledge(): ActivityAnalysisKnowledge {
    return {
      recentAnalyses: [],
      analysisByType: {
        activityAnalysis: [],
        trendAnalysis: [],
        transcription: []
      },
      lastAnalysisDate: null,
      analysisCount: 0,
      successRate: 0,
      averageProcessingTime: 0,
      cachedAnalysesCount: 0,
      hasData: false
    };
  }
}
