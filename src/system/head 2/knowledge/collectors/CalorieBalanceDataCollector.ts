/**
 * CalorieBalanceDataCollector - Collect calorie balance data for today
 * Aggregates calories consumed (IN) and calories burned (OUT) for real-time balance
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';

export interface CalorieBalanceKnowledge {
  caloriesIn: number;
  caloriesOut: number;
  caloriesBalance: number;
  dailyTarget: number;
  remainingCalories: number;
  percentageOfTarget: number;

  calorieBreakdown: {
    meals: number;
    snacks: number;
    drinks: number;
  };

  activityBreakdown: {
    bmr: number;
    training: number;
    activities: number;
    neat: number;
  };

  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };

  status: 'deficit' | 'maintenance' | 'surplus';
  lastMealTime: string | null;
  lastActivityTime: string | null;
  hasData: boolean;
}

export class CalorieBalanceDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<CalorieBalanceKnowledge> {
    try {
      logger.info('CALORIE_BALANCE_COLLECTOR', 'Starting calorie balance data collection', { userId });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [mealsResult, activitiesResult, profileResult] = await Promise.allSettled([
        this.getTodayMeals(userId, todayISO),
        this.getTodayActivities(userId, todayISO),
        this.getUserProfile(userId)
      ]);

      const meals = mealsResult.status === 'fulfilled' ? mealsResult.value : [];
      const activities = activitiesResult.status === 'fulfilled' ? activitiesResult.value : [];
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;

      const caloriesIn = meals.reduce((sum, m) => sum + (m.total_calories || 0), 0);

      const bmr = this.calculateBMR(profile);
      const trainingCalories = activities
        .filter(a => a.type === 'training')
        .reduce((sum, a) => sum + (a.calories_burned || 0), 0);
      const activityCalories = activities
        .filter(a => a.type !== 'training')
        .reduce((sum, a) => sum + (a.calories_burned || 0), 0);
      const neat = Math.round(bmr * 0.15);

      const caloriesOut = bmr + trainingCalories + activityCalories + neat;
      const caloriesBalance = caloriesIn - caloriesOut;

      const dailyTarget = this.calculateDailyTarget(profile, bmr);
      const remainingCalories = Math.max(0, dailyTarget - caloriesIn);
      const percentageOfTarget = Math.round((caloriesIn / dailyTarget) * 100);

      const calorieBreakdown = this.categorizeCaloriesIn(meals);
      const activityBreakdown = {
        bmr,
        training: trainingCalories,
        activities: activityCalories,
        neat
      };

      const macros = this.calculateMacros(meals);

      let status: 'deficit' | 'maintenance' | 'surplus';
      if (caloriesBalance < -200) status = 'deficit';
      else if (caloriesBalance > 200) status = 'surplus';
      else status = 'maintenance';

      const lastMeal = meals.sort((a, b) =>
        new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime()
      )[0];

      const lastActivity = activities.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      const hasData = meals.length > 0 || activities.length > 0;

      logger.info('CALORIE_BALANCE_COLLECTOR', 'Calorie balance data collected', {
        userId,
        caloriesIn,
        caloriesOut,
        balance: caloriesBalance,
        mealsCount: meals.length,
        activitiesCount: activities.length,
        hasData
      });

      return {
        caloriesIn,
        caloriesOut,
        caloriesBalance,
        dailyTarget,
        remainingCalories,
        percentageOfTarget,
        calorieBreakdown,
        activityBreakdown,
        macros,
        status,
        lastMealTime: lastMeal?.consumed_at || null,
        lastActivityTime: lastActivity?.timestamp || null,
        hasData
      };
    } catch (error) {
      logger.error('CALORIE_BALANCE_COLLECTOR', 'Failed to collect calorie balance data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.getDefaultCalorieBalanceKnowledge();
    }
  }

  private async getTodayMeals(userId: string, todayISO: string) {
    const { data, error } = await this.supabase
      .from('meals')
      .select('total_calories, protein_g, carbs_g, fat_g, meal_type, consumed_at')
      .eq('user_id', userId)
      .gte('consumed_at', todayISO);

    if (error) throw error;
    return data || [];
  }

  private async getTodayActivities(userId: string, todayISO: string) {
    const { data, error } = await this.supabase
      .from('biometric_activities')
      .select('type, calories_burned, timestamp')
      .eq('user_id', userId)
      .gte('timestamp', todayISO);

    if (error) throw error;
    return data || [];
  }

  private async getUserProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('user_profile')
      .select('sex, birthdate, height_cm, weight_kg, activity_level, objective')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  private calculateBMR(profile: any): number {
    if (!profile?.weight_kg || !profile?.height_cm || !profile?.birthdate) {
      return 1800;
    }

    const age = Math.floor(
      (Date.now() - new Date(profile.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    if (profile.sex === 'male') {
      return Math.round(10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * age + 5);
    } else {
      return Math.round(10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * age - 161);
    }
  }

  private calculateDailyTarget(profile: any, bmr: number): number {
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      lightly_active: 1.375,
      active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9
    };

    const tdee = bmr * (activityMultipliers[profile?.activity_level] || 1.55);

    const objectiveAdjustments: Record<string, number> = {
      fat_loss: -500,
      muscle_gain: 300,
      maintenance: 0,
      recomposition: -200
    };

    return Math.round(tdee + (objectiveAdjustments[profile?.objective] || 0));
  }

  private categorizeCaloriesIn(meals: any[]) {
    const breakfast = ['breakfast', 'petit-dejeuner'];
    const lunch = ['lunch', 'dejeuner'];
    const dinner = ['dinner', 'diner'];
    const snackTypes = ['snack', 'collation'];

    return {
      meals: meals
        .filter(m => [...breakfast, ...lunch, ...dinner].includes(m.meal_type?.toLowerCase()))
        .reduce((sum, m) => sum + (m.total_calories || 0), 0),
      snacks: meals
        .filter(m => snackTypes.includes(m.meal_type?.toLowerCase()))
        .reduce((sum, m) => sum + (m.total_calories || 0), 0),
      drinks: 0
    };
  }

  private calculateMacros(meals: any[]) {
    return {
      protein: Math.round(meals.reduce((sum, m) => sum + (m.protein_g || 0), 0)),
      carbs: Math.round(meals.reduce((sum, m) => sum + (m.carbs_g || 0), 0)),
      fat: Math.round(meals.reduce((sum, m) => sum + (m.fat_g || 0), 0))
    };
  }

  private getDefaultCalorieBalanceKnowledge(): CalorieBalanceKnowledge {
    return {
      caloriesIn: 0,
      caloriesOut: 0,
      caloriesBalance: 0,
      dailyTarget: 2000,
      remainingCalories: 2000,
      percentageOfTarget: 0,
      calorieBreakdown: {
        meals: 0,
        snacks: 0,
        drinks: 0
      },
      activityBreakdown: {
        bmr: 0,
        training: 0,
        activities: 0,
        neat: 0
      },
      macros: {
        protein: 0,
        carbs: 0,
        fat: 0
      },
      status: 'maintenance',
      lastMealTime: null,
      lastActivityTime: null,
      hasData: false
    };
  }
}
