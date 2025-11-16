/**
 * BreastfeedingDataCollector - Collect breastfeeding data for user
 * Aggregates breastfeeding status, baby age, and derives nutritional needs
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { BreastfeedingTracking, BreastfeedingType } from '../../../../domain/breastfeeding';
import { getBreastfeedingNutritionalGuide } from '../../../../domain/breastfeeding';

export interface BreastfeedingKnowledge {
  hasData: boolean;
  isBreastfeeding: boolean;
  breastfeedingType: BreastfeedingType | null;
  babyAgeMonths: number | null;
  startDate: string | null;
  durationMonths: number | null;
  nutritionalNeeds: {
    extraCalories: number;
    extraProtein: number;
    calciumNeed: number;
    ironNeed: number;
    omega3Need: number;
    waterIntake: number;
  };
  recommendations: {
    priorityFoods: string[];
    limitedFoods: string[];
    avoidFoods: string[];
    mealFrequency: string;
  };
  notes: string | null;
}

export class BreastfeedingDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<BreastfeedingKnowledge> {
    try {
      logger.info('BREASTFEEDING_DATA_COLLECTOR', 'Starting breastfeeding data collection', { userId });

      const { data: breastfeedingData, error } = await this.supabase
        .from('breastfeeding_tracking')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        logger.error('BREASTFEEDING_DATA_COLLECTOR', 'Failed to load breastfeeding data', { userId, error });
        return this.getDefaultBreastfeedingKnowledge();
      }

      if (!breastfeedingData || !breastfeedingData.is_breastfeeding) {
        logger.info('BREASTFEEDING_DATA_COLLECTOR', 'User is not currently breastfeeding', { userId });
        return this.getDefaultBreastfeedingKnowledge();
      }

      const tracking = breastfeedingData as BreastfeedingTracking;
      const durationMonths = this.calculateDurationMonths(tracking.start_date);
      const nutritionalGuide = getBreastfeedingNutritionalGuide(
        tracking.breastfeeding_type,
        tracking.baby_age_months
      );

      const knowledge: BreastfeedingKnowledge = {
        hasData: true,
        isBreastfeeding: tracking.is_breastfeeding,
        breastfeedingType: tracking.breastfeeding_type,
        babyAgeMonths: tracking.baby_age_months,
        startDate: tracking.start_date,
        durationMonths,
        nutritionalNeeds: {
          extraCalories: nutritionalGuide.calorieIncrease,
          extraProtein: nutritionalGuide.proteinIncrease,
          calciumNeed: nutritionalGuide.calciumNeed,
          ironNeed: nutritionalGuide.ironNeed,
          omega3Need: nutritionalGuide.omega3Need,
          waterIntake: nutritionalGuide.waterIntake,
        },
        recommendations: {
          priorityFoods: nutritionalGuide.priorityFoods,
          limitedFoods: nutritionalGuide.limitedFoods,
          avoidFoods: nutritionalGuide.avoidFoods,
          mealFrequency: nutritionalGuide.mealFrequency,
        },
        notes: tracking.notes,
      };

      logger.info('BREASTFEEDING_DATA_COLLECTOR', 'Breastfeeding data collected successfully', {
        userId,
        isBreastfeeding: knowledge.isBreastfeeding,
        breastfeedingType: knowledge.breastfeedingType,
        babyAgeMonths: knowledge.babyAgeMonths,
        extraCalories: knowledge.nutritionalNeeds.extraCalories,
      });

      return knowledge;
    } catch (error) {
      logger.error('BREASTFEEDING_DATA_COLLECTOR', 'Failed to collect breastfeeding data', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getDefaultBreastfeedingKnowledge();
    }
  }

  private calculateDurationMonths(startDate: string | null): number | null {
    if (!startDate) return null;

    try {
      const start = new Date(startDate);
      const now = new Date();
      const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 +
                        (now.getMonth() - start.getMonth());
      return Math.max(0, diffMonths);
    } catch (error) {
      logger.warn('BREASTFEEDING_DATA_COLLECTOR', 'Failed to calculate duration', { startDate, error });
      return null;
    }
  }

  private getDefaultBreastfeedingKnowledge(): BreastfeedingKnowledge {
    return {
      hasData: false,
      isBreastfeeding: false,
      breastfeedingType: null,
      babyAgeMonths: null,
      startDate: null,
      durationMonths: null,
      nutritionalNeeds: {
        extraCalories: 0,
        extraProtein: 0,
        calciumNeed: 1000,
        ironNeed: 18,
        omega3Need: 250,
        waterIntake: 2.0,
      },
      recommendations: {
        priorityFoods: [],
        limitedFoods: [],
        avoidFoods: [],
        mealFrequency: 'Standard',
      },
      notes: null,
    };
  }
}
