/**
 * TodayDataCollector - Aggregate today's data across all forges
 * Provides a unified view of user's current day activities
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';

export interface TodayData {
  trainingSessions: TodayTrainingSession[];
  meals: TodayMeal[];
  fastingSession: TodayFastingSession | null;
  bodyScans: TodayBodyScan[];
  hasTraining: boolean;
  hasNutrition: boolean;
  hasFasting: boolean;
  hasBodyScan: boolean;
  totalActivities: number;
}

export interface TodayTrainingSession {
  id: string;
  discipline: string;
  startTime: string;
  endTime: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  exerciseCount: number;
}

export interface TodayMeal {
  id: string;
  name: string;
  mealType: string;
  consumedAt: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  items: Array<{
    name: string;
    category: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
  }>;
}

export interface TodayFastingSession {
  id: string;
  startTime: string;
  targetDuration: number;
  currentDuration: number;
  status: 'in_progress' | 'completed';
}

export interface TodayBodyScan {
  id: string;
  scanType: string;
  scanTime: string;
}

export class TodayDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<TodayData> {
    try {
      logger.info('TODAY_DATA_COLLECTOR', 'Starting today data collection', { userId });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Collect all data in parallel
      const [trainingsResult, mealsResult, fastingResult, scansResult] =
        await Promise.allSettled([
          this.collectTodayTrainingSessions(userId, startOfDay, endOfDay),
          this.collectTodayMeals(userId, startOfDay, endOfDay),
          this.collectTodayFastingSession(userId, startOfDay),
          this.collectTodayBodyScans(userId, startOfDay, endOfDay)
        ]);

      const trainingSessions =
        trainingsResult.status === 'fulfilled' ? trainingsResult.value : [];
      const meals = mealsResult.status === 'fulfilled' ? mealsResult.value : [];
      const fastingSession =
        fastingResult.status === 'fulfilled' ? fastingResult.value : null;
      const bodyScans = scansResult.status === 'fulfilled' ? scansResult.value : [];

      const hasTraining = trainingSessions.length > 0;
      const hasNutrition = meals.length > 0;
      const hasFasting = !!fastingSession;
      const hasBodyScan = bodyScans.length > 0;

      const totalActivities =
        trainingSessions.length + meals.length + bodyScans.length + (fastingSession ? 1 : 0);

      logger.info('TODAY_DATA_COLLECTOR', 'Today data collected', {
        userId,
        trainingSessions: trainingSessions.length,
        meals: meals.length,
        hasFasting,
        bodyScans: bodyScans.length,
        totalActivities
      });

      return {
        trainingSessions,
        meals,
        fastingSession,
        bodyScans,
        hasTraining,
        hasNutrition,
        hasFasting,
        hasBodyScan,
        totalActivities
      };
    } catch (error) {
      logger.error('TODAY_DATA_COLLECTOR', 'Failed to collect today data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect today's training sessions
   */
  private async collectTodayTrainingSessions(
    userId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<TodayTrainingSession[]> {
    const { data: sessions, error } = await this.supabase
      .from('training_sessions')
      .select('id, discipline, started_at, completed_at, status, prescription')
      .eq('user_id', userId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false });

    if (error || !sessions) {
      return [];
    }

    // Count exercises from prescription JSONB
    const sessionsWithCounts = sessions.map((session) => {
      let exerciseCount = 0;
      if (session.prescription && typeof session.prescription === 'object') {
        const prescription = session.prescription as any;
        if (Array.isArray(prescription.exercises)) {
          exerciseCount = prescription.exercises.length;
        } else if (Array.isArray(prescription.blocks)) {
          exerciseCount = prescription.blocks.length;
        }
      }

      return {
        id: session.id,
        discipline: session.discipline || 'force',
        startTime: session.started_at || session.completed_at || '',
        endTime: session.completed_at || null,
        status: session.status as 'planned' | 'in_progress' | 'completed',
        exerciseCount
      };
    });

    return sessionsWithCounts;
  }

  /**
   * Collect today's meals
   */
  private async collectTodayMeals(
    userId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<TodayMeal[]> {
    const { data: meals, error } = await this.supabase
      .from('meals')
      .select('id, meal_name, meal_type, timestamp, total_kcal, items')
      .eq('user_id', userId)
      .gte('timestamp', startOfDay.toISOString())
      .lte('timestamp', endOfDay.toISOString())
      .order('timestamp', { ascending: false });

    if (error || !meals) {
      return [];
    }

    return meals.map((meal) => {
      // Parse items from JSONB
      const items = this.parseMealItems(meal.items);

      // Calculate totals from items
      const totalProtein = items.reduce((sum, item) => sum + (item.proteins || 0), 0);
      const totalCarbs = items.reduce((sum, item) => sum + (item.carbs || 0), 0);
      const totalFats = items.reduce((sum, item) => sum + (item.fats || 0), 0);

      return {
        id: meal.id,
        name: meal.meal_name || 'Repas',
        mealType: meal.meal_type || 'unknown',
        consumedAt: meal.timestamp,
        calories: meal.total_kcal || 0,
        protein: totalProtein,
        carbs: totalCarbs,
        fats: totalFats,
        items
      };
    });
  }

  /**
   * Parse meal items from JSONB
   */
  private parseMealItems(itemsData: any): Array<{
    name: string;
    category: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
  }> {
    if (!itemsData || !Array.isArray(itemsData)) {
      return [];
    }

    return itemsData
      .filter(item => item && item.name)
      .map(item => ({
        name: item.name,
        category: item.category || 'unknown',
        calories: item.calories || 0,
        proteins: item.proteins || 0,
        carbs: item.carbs || 0,
        fats: item.fats || 0
      }));
  }

  /**
   * Collect today's fasting session (if any)
   */
  private async collectTodayFastingSession(
    userId: string,
    startOfDay: Date
  ): Promise<TodayFastingSession | null> {
    const { data: session, error } = await this.supabase
      .from('fasting_sessions')
      .select('id, start_time, target_hours, status')
      .eq('user_id', userId)
      .gte('start_time', startOfDay.toISOString())
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !session) {
      return null;
    }

    // Calculate current duration
    const startTime = new Date(session.start_time);
    const now = new Date();
    const currentDuration = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours

    return {
      id: session.id,
      startTime: session.start_time,
      targetDuration: session.target_hours || 0,
      currentDuration: Math.round(currentDuration * 10) / 10,
      status: session.status as 'in_progress' | 'completed'
    };
  }

  /**
   * Collect today's body scans
   */
  private async collectTodayBodyScans(
    userId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<TodayBodyScan[]> {
    const { data: scans, error } = await this.supabase
      .from('body_scans')
      .select('id, timestamp')
      .eq('user_id', userId)
      .gte('timestamp', startOfDay.toISOString())
      .lte('timestamp', endOfDay.toISOString())
      .order('timestamp', { ascending: false });

    if (error || !scans) {
      return [];
    }

    return scans.map((scan) => ({
      id: scan.id,
      scanType: 'photo_scan',
      scanTime: scan.timestamp
    }));
  }
}
