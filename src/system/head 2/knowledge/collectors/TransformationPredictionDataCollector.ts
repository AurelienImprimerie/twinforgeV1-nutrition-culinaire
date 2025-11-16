import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';

export interface PredictionKnowledge {
  hasPrediction: boolean;
  activePrediction: {
    predictedDate: string;
    confidenceScore: number;
    daysToTarget: number;
    weeklyTrend: number;
    weightToGo: number;
    scenarios: {
      optimistic: string;
      pessimistic: string;
    };
  } | null;
  milestones: Array<{
    type: string;
    weight: number;
    predictedDate: string;
    status: string;
    varianceDays: number;
  }>;
  influenceFactors: {
    activityScore: number;
    consistencyScore: number;
    caloricBalanceScore: number;
    overallScore: number;
  } | null;
  recommendations: string[];
  predictionHistory: {
    totalPredictions: number;
    averageConfidence: number;
    lastPredictionDate: string | null;
  };
  hasData: boolean;
}

export class TransformationPredictionDataCollector {
  constructor(private supabase: SupabaseClient) {}

  async collect(userId: string): Promise<PredictionKnowledge> {
    try {
      logger.info('PREDICTION_COLLECTOR', 'Collecting prediction data', { userId });

      const [activePredictionData, milestonesData, historyData] = await Promise.all([
        this.getActivePrediction(userId),
        this.getMilestones(userId),
        this.getPredictionHistory(userId)
      ]);

      const hasPrediction = activePredictionData !== null;
      const hasData = hasPrediction || historyData.totalPredictions > 0;

      const knowledge: PredictionKnowledge = {
        hasPrediction,
        activePrediction: activePredictionData
          ? {
              predictedDate: activePredictionData.predicted_date,
              confidenceScore: activePredictionData.confidence_score,
              daysToTarget: activePredictionData.days_to_target,
              weeklyTrend: activePredictionData.weekly_trend,
              weightToGo: activePredictionData.weight_to_go,
              scenarios: {
                optimistic: activePredictionData.optimistic_date,
                pessimistic: activePredictionData.pessimistic_date
              }
            }
          : null,
        milestones: milestonesData,
        influenceFactors: activePredictionData?.influence_factors || null,
        recommendations: activePredictionData?.recommendations || [],
        predictionHistory: historyData,
        hasData
      };

      logger.info('PREDICTION_COLLECTOR', 'Prediction data collected', {
        userId,
        hasPrediction,
        milestonesCount: milestonesData.length
      });

      return knowledge;
    } catch (error) {
      logger.error('PREDICTION_COLLECTOR', 'Failed to collect prediction data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.getDefaultKnowledge();
    }
  }

  private async getActivePrediction(userId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('transformation_predictions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.warn('PREDICTION_COLLECTOR', 'Failed to get active prediction', { userId, error });
      return null;
    }
  }

  private async getMilestones(userId: string): Promise<
    Array<{
      type: string;
      weight: number;
      predictedDate: string;
      status: string;
      varianceDays: number;
    }>
  > {
    try {
      const { data, error } = await this.supabase
        .from('prediction_milestones')
        .select(
          `
          milestone_type,
          milestone_weight,
          predicted_date,
          status,
          variance_days,
          prediction_id
        `
        )
        .eq('user_id', userId)
        .order('predicted_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((milestone) => ({
        type: milestone.milestone_type,
        weight: milestone.milestone_weight,
        predictedDate: milestone.predicted_date,
        status: milestone.status,
        varianceDays: milestone.variance_days
      }));
    } catch (error) {
      logger.warn('PREDICTION_COLLECTOR', 'Failed to get milestones', { userId, error });
      return [];
    }
  }

  private async getPredictionHistory(
    userId: string
  ): Promise<{
    totalPredictions: number;
    averageConfidence: number;
    lastPredictionDate: string | null;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('transformation_predictions')
        .select('confidence_score, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const predictions = data || [];
      const totalPredictions = predictions.length;

      if (totalPredictions === 0) {
        return {
          totalPredictions: 0,
          averageConfidence: 0,
          lastPredictionDate: null
        };
      }

      const averageConfidence = Math.round(
        predictions.reduce((sum, p) => sum + p.confidence_score, 0) / totalPredictions
      );

      return {
        totalPredictions,
        averageConfidence,
        lastPredictionDate: predictions[0].created_at
      };
    } catch (error) {
      logger.warn('PREDICTION_COLLECTOR', 'Failed to get prediction history', { userId, error });
      return {
        totalPredictions: 0,
        averageConfidence: 0,
        lastPredictionDate: null
      };
    }
  }

  private getDefaultKnowledge(): PredictionKnowledge {
    return {
      hasPrediction: false,
      activePrediction: null,
      milestones: [],
      influenceFactors: null,
      recommendations: [],
      predictionHistory: {
        totalPredictions: 0,
        averageConfidence: 0,
        lastPredictionDate: null
      },
      hasData: false
    };
  }
}
