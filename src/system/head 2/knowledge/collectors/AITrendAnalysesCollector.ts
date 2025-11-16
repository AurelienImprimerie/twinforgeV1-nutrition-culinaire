/**
 * AITrendAnalysesCollector - Collect AI trend analyses data for user
 * Retrieves nutritional trends, strategic advice, and meal classifications from ai_trend_analyses table
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';

export interface AITrendAnalysesKnowledge {
  trends: Array<{
    pattern: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
    confidence: number;
    recommendations: string[];
  }>;
  strategicAdvice: Array<{
    category: 'nutrition' | 'timing' | 'balance' | 'goals';
    advice: string;
    priority: 'low' | 'medium' | 'high';
    timeframe: 'immediate' | 'short_term' | 'long_term';
  }>;
  mealClassifications: Array<{
    meal_id: string;
    classification: 'balanced' | 'protein_rich' | 'needs_improvement' | 'excellent';
    reasoning: string;
    score: number;
  }>;
  lastAnalysisDate: string | null;
  analysisPeriod: '7_days' | '30_days';
  hasData: boolean;
}

export class AITrendAnalysesCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<AITrendAnalysesKnowledge> {
    try {
      logger.info('AI_TREND_ANALYSES_COLLECTOR', 'Starting AI trend analyses data collection', { userId });

      // Get most recent analysis (prefer 7_days, fallback to 30_days)
      const { data: analyses, error } = await this.supabase
        .from('ai_trend_analyses')
        .select('trends, strategic_advice, meal_classifications, analysis_period, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(2);

      if (error) {
        logger.error('AI_TREND_ANALYSES_COLLECTOR', 'Failed to load AI trend analyses', { userId, error });
        return this.getDefaultKnowledge();
      }

      if (!analyses || analyses.length === 0) {
        logger.info('AI_TREND_ANALYSES_COLLECTOR', 'No AI trend analyses found', { userId });
        return this.getDefaultKnowledge();
      }

      // Prefer 7_days analysis if available, otherwise use most recent
      const preferredAnalysis = analyses.find(a => a.analysis_period === '7_days') || analyses[0];

      const trends = this.parseTrends(preferredAnalysis.trends);
      const strategicAdvice = this.parseStrategicAdvice(preferredAnalysis.strategic_advice);
      const mealClassifications = this.parseMealClassifications(preferredAnalysis.meal_classifications);

      logger.info('AI_TREND_ANALYSES_COLLECTOR', 'AI trend analyses data collected', {
        userId,
        trendsCount: trends.length,
        adviceCount: strategicAdvice.length,
        classificationsCount: mealClassifications.length,
        analysisPeriod: preferredAnalysis.analysis_period,
        lastAnalysisDate: preferredAnalysis.created_at
      });

      return {
        trends,
        strategicAdvice,
        mealClassifications,
        lastAnalysisDate: preferredAnalysis.created_at,
        analysisPeriod: preferredAnalysis.analysis_period as '7_days' | '30_days',
        hasData: true
      };
    } catch (error) {
      logger.error('AI_TREND_ANALYSES_COLLECTOR', 'Failed to collect AI trend analyses data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return this.getDefaultKnowledge();
    }
  }

  private parseTrends(trendsData: any): Array<{
    pattern: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
    confidence: number;
    recommendations: string[];
  }> {
    if (!Array.isArray(trendsData)) {
      return [];
    }

    return trendsData
      .filter(trend => trend && trend.pattern)
      .map(trend => ({
        pattern: trend.pattern || '',
        description: trend.description || '',
        impact: ['positive', 'negative', 'neutral'].includes(trend.impact) ? trend.impact : 'neutral',
        confidence: typeof trend.confidence === 'number' ? trend.confidence : 0.5,
        recommendations: Array.isArray(trend.recommendations) ? trend.recommendations : []
      }));
  }

  private parseStrategicAdvice(adviceData: any): Array<{
    category: 'nutrition' | 'timing' | 'balance' | 'goals';
    advice: string;
    priority: 'low' | 'medium' | 'high';
    timeframe: 'immediate' | 'short_term' | 'long_term';
  }> {
    if (!Array.isArray(adviceData)) {
      return [];
    }

    return adviceData
      .filter(advice => advice && advice.advice)
      .map(advice => ({
        category: ['nutrition', 'timing', 'balance', 'goals'].includes(advice.category)
          ? advice.category
          : 'nutrition',
        advice: advice.advice || '',
        priority: ['low', 'medium', 'high'].includes(advice.priority) ? advice.priority : 'medium',
        timeframe: ['immediate', 'short_term', 'long_term'].includes(advice.timeframe)
          ? advice.timeframe
          : 'short_term'
      }));
  }

  private parseMealClassifications(classificationsData: any): Array<{
    meal_id: string;
    classification: 'balanced' | 'protein_rich' | 'needs_improvement' | 'excellent';
    reasoning: string;
    score: number;
  }> {
    if (!Array.isArray(classificationsData)) {
      return [];
    }

    return classificationsData
      .filter(classification => classification && classification.meal_id)
      .map(classification => ({
        meal_id: classification.meal_id || '',
        classification: ['balanced', 'protein_rich', 'needs_improvement', 'excellent'].includes(classification.classification)
          ? classification.classification
          : 'balanced',
        reasoning: classification.reasoning || '',
        score: typeof classification.score === 'number' ? classification.score : 70
      }));
  }

  private getDefaultKnowledge(): AITrendAnalysesKnowledge {
    return {
      trends: [],
      strategicAdvice: [],
      mealClassifications: [],
      lastAnalysisDate: null,
      analysisPeriod: '7_days',
      hasData: false
    };
  }
}
