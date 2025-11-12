import { supabase } from '@/system/supabase/client';
import logger from '@/lib/utils/logger';

export interface GamificationProgress {
  userId: string;
  currentXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  totalXpEarned: number;
  levelUpCount: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActivityDate: string | null;
  lastLevelUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface XpEvent {
  id: string;
  userId: string;
  eventType: string;
  eventCategory: 'nutrition' | 'training' | 'fasting' | 'body_scan' | 'wearable' | 'general';
  baseXp: number;
  multiplier: number;
  finalXp: number;
  eventDate: string;
  eventMetadata: Record<string, any>;
  createdAt: string;
}

export interface LevelMilestone {
  level: number;
  xpRequired: number;
  xpToNext: number;
  milestoneName: string;
  milestoneDescription: string | null;
  unlockFeatures: any[];
  badgeIcon: string;
  badgeColor: string;
  isMajorMilestone: boolean;
  createdAt: string;
}

export interface XpAwardResult {
  xpAwarded: number;
  baseXp: number;
  multiplier: number;
  streakDays: number;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  totalXp: number;
}

export interface WeightUpdate {
  id: string;
  userId: string;
  previousWeight: number | null;
  newWeight: number;
  weightDelta: number | null;
  updatedFrom: 'dashboard_gaming' | 'profile' | 'body_scan';
  xpAwarded: number;
  isMilestone: boolean;
  milestoneData: Record<string, any>;
  createdAt: string;
}

const XP_VALUES = {
  // Forge Nutritionnelle
  MEAL_SCAN: 25, // Scanner un repas (harmonisé avec useForgeXpRewards)
  BARCODE_SCAN: 15, // Scanner un code-barre
  DAILY_CALORIE_GOAL_MET: 50,

  // Forge Culinaire
  FRIDGE_SCAN: 30, // Scanner son frigo
  RECIPE_GENERATED: 20, // Générer une recette
  MEAL_PLAN_GENERATED: 35, // Générer un plan de repas
  SHOPPING_LIST_GENERATED: 15, // Générer une liste de courses

  // Training
  TRAINING_SESSION: 30,
  FOLLOWING_MEAL_PLAN: 40,
  BODY_SCAN: 25,

  // Fasting
  FASTING_SUCCESS: 50, // Jeûne complété avec succès (augmenté de 35 à 50)
  FASTING_PARTIAL_8H: 25, // Jeûne partiel 8h+ (seuil métabolique)
  FASTING_PARTIAL_12H: 35, // Jeûne partiel 12h+
  FASTING_BONUS_EXCEEDED: 20, // Bonus si objectif dépassé de 20%+

  // Other
  WEARABLE_SYNC: 15,
  WEIGHT_UPDATE: 15,
  WEIGHT_MILESTONE_BONUS: 25,
  RECORD_SHARE: 50, // Premier partage uniquement
} as const;

class GamificationService {
  async getUserProgress(userId: string): Promise<GamificationProgress | null> {
    try {
      const { data, error } = await supabase
        .from('user_gamification_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        userId: data.user_id,
        currentXp: data.current_xp,
        currentLevel: data.current_level,
        xpToNextLevel: data.xp_to_next_level,
        totalXpEarned: data.total_xp_earned,
        levelUpCount: data.level_up_count,
        currentStreakDays: data.current_streak_days,
        longestStreakDays: data.longest_streak_days,
        lastActivityDate: data.last_activity_date,
        lastLevelUpAt: data.last_level_up_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to get user progress', { userId, error });
      throw error;
    }
  }

  async initializeUserProgress(userId: string): Promise<GamificationProgress> {
    try {
      const { data, error } = await supabase
        .from('user_gamification_progress')
        .insert({
          user_id: userId
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('GAMIFICATION', 'User progress initialized', { userId });

      return {
        userId: data.user_id,
        currentXp: data.current_xp,
        currentLevel: data.current_level,
        xpToNextLevel: data.xp_to_next_level,
        totalXpEarned: data.total_xp_earned,
        levelUpCount: data.level_up_count,
        currentStreakDays: data.current_streak_days,
        longestStreakDays: data.longest_streak_days,
        lastActivityDate: data.last_activity_date,
        lastLevelUpAt: data.last_level_up_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to initialize user progress', { userId, error });
      throw error;
    }
  }

  async awardXp(
    userId: string,
    eventType: string,
    eventCategory: XpEvent['eventCategory'],
    baseXp: number,
    metadata: Record<string, any> = {}
  ): Promise<XpAwardResult> {
    try {
      const { data, error } = await supabase.rpc('award_xp', {
        p_user_id: userId,
        p_event_type: eventType,
        p_event_category: eventCategory,
        p_base_xp: baseXp,
        p_event_metadata: metadata
      });

      if (error) throw error;

      const result: XpAwardResult = {
        xpAwarded: data.xp_awarded,
        baseXp: data.base_xp,
        multiplier: parseFloat(data.multiplier),
        streakDays: data.streak_days,
        leveledUp: data.leveled_up,
        oldLevel: data.old_level,
        newLevel: data.new_level,
        currentXp: data.current_xp,
        xpToNextLevel: data.xp_to_next_level,
        totalXp: data.total_xp
      };

      logger.info('GAMIFICATION', 'XP awarded', {
        userId,
        eventType,
        xpAwarded: result.xpAwarded,
        leveledUp: result.leveledUp,
        newLevel: result.newLevel,
        streakDays: result.streakDays
      });

      return result;
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to award XP', {
        userId,
        eventType,
        baseXp,
        error
      });
      throw error;
    }
  }

  async awardMealScanXp(userId: string, mealData?: Record<string, any>): Promise<XpAwardResult> {
    return this.awardXp(userId, 'meal_scan', 'nutrition', XP_VALUES.MEAL_SCAN, mealData || {});
  }

  async awardBarcodeScanXp(userId: string, barcodeData?: Record<string, any>): Promise<XpAwardResult> {
    return this.awardXp(userId, 'barcode_scan', 'nutrition', XP_VALUES.BARCODE_SCAN, barcodeData || {});
  }

  async awardFridgeScanXp(userId: string, scanData?: Record<string, any>): Promise<XpAwardResult> {
    return this.awardXp(userId, 'fridge_scan', 'nutrition', XP_VALUES.FRIDGE_SCAN, scanData || {});
  }

  async awardRecipeGeneratedXp(userId: string, recipeData?: Record<string, any>): Promise<XpAwardResult> {
    return this.awardXp(userId, 'recipe_generated', 'nutrition', XP_VALUES.RECIPE_GENERATED, recipeData || {});
  }

  async awardMealPlanGeneratedXp(userId: string, planData?: Record<string, any>): Promise<XpAwardResult> {
    return this.awardXp(userId, 'meal_plan_generated', 'nutrition', XP_VALUES.MEAL_PLAN_GENERATED, planData || {});
  }

  async awardShoppingListGeneratedXp(userId: string, listData?: Record<string, any>): Promise<XpAwardResult> {
    return this.awardXp(userId, 'shopping_list_generated', 'nutrition', XP_VALUES.SHOPPING_LIST_GENERATED, listData || {});
  }

  async awardCalorieGoalMetXp(
    userId: string,
    calorieData: Record<string, any>
  ): Promise<XpAwardResult> {
    return this.awardXp(
      userId,
      'daily_calorie_goal_met',
      'nutrition',
      XP_VALUES.DAILY_CALORIE_GOAL_MET,
      calorieData
    );
  }

  async awardTrainingSessionXp(
    userId: string,
    sessionData: Record<string, any>
  ): Promise<XpAwardResult> {
    return this.awardXp(userId, 'training_session', 'training', XP_VALUES.TRAINING_SESSION, sessionData);
  }

  async awardMealPlanFollowedXp(userId: string): Promise<XpAwardResult> {
    return this.awardXp(userId, 'meal_plan_followed', 'nutrition', XP_VALUES.FOLLOWING_MEAL_PLAN);
  }

  async awardBodyScanXp(userId: string, scanData?: Record<string, any>): Promise<XpAwardResult> {
    return this.awardXp(userId, 'body_scan', 'body_scan', XP_VALUES.BODY_SCAN, scanData || {});
  }

  /**
   * Award XP for fasting sessions with progressive rewards
   * @param userId - User ID
   * @param fastingData - Must include: durationHours, targetHours, protocol, phase
   */
  async awardFastingXp(
    userId: string,
    fastingData: {
      durationHours: number;
      targetHours: number;
      protocol: string;
      phase?: string;
      completed: boolean;
    }
  ): Promise<XpAwardResult> {
    const { durationHours, targetHours, completed } = fastingData;

    // Calculate base XP based on duration and completion
    let baseXp = 0;
    let eventType = 'fasting_incomplete';

    if (completed && durationHours >= targetHours) {
      // Full success: 50 XP
      baseXp = XP_VALUES.FASTING_SUCCESS;
      eventType = 'fasting_success';

      // Bonus if exceeded target by 20%+
      if (durationHours >= targetHours * 1.2) {
        baseXp += XP_VALUES.FASTING_BONUS_EXCEEDED;
        eventType = 'fasting_success_exceeded';
      }
    } else if (durationHours >= 12) {
      // Partial 12h+: 35 XP
      baseXp = XP_VALUES.FASTING_PARTIAL_12H;
      eventType = 'fasting_partial_12h';
    } else if (durationHours >= 8) {
      // Partial 8h+ (metabolic threshold): 25 XP
      baseXp = XP_VALUES.FASTING_PARTIAL_8H;
      eventType = 'fasting_partial_8h';
    } else {
      // Too short, no XP
      logger.info('GAMIFICATION', 'Fasting too short for XP', { userId, durationHours });
      throw new Error('Fasting duration too short (< 8h) - no XP awarded');
    }

    return this.awardXp(
      userId,
      eventType,
      'fasting',
      baseXp,
      {
        ...fastingData,
        xp_breakdown: {
          base_xp: baseXp,
          duration_hours: durationHours,
          target_hours: targetHours,
          completed
        }
      }
    );
  }

  async awardWearableSyncXp(userId: string): Promise<XpAwardResult> {
    return this.awardXp(userId, 'wearable_sync', 'wearable', XP_VALUES.WEARABLE_SYNC);
  }

  async updateWeight(
    userId: string,
    newWeight: number,
    updatedFrom: WeightUpdate['updatedFrom'],
    objective?: 'fat_loss' | 'muscle_gain' | 'recomp'
  ): Promise<{ weightUpdate: WeightUpdate; xpResult: XpAwardResult | null }> {
    try {
      logger.info('GAMIFICATION', 'updateWeight called', {
        userId,
        newWeight,
        updatedFrom,
        objective
      });

      const { data: profile, error: profileFetchError } = await supabase
        .from('user_profile')
        .select('weight_kg, objective')
        .eq('user_id', userId)
        .single();

      if (profileFetchError) {
        logger.error('GAMIFICATION', 'Failed to fetch user profile', {
          userId,
          error: profileFetchError
        });
        throw profileFetchError;
      }

      logger.info('GAMIFICATION', 'Profile fetched successfully', {
        userId,
        currentWeight: profile?.weight_kg,
        profileObjective: profile?.objective
      });

      const previousWeight = profile?.weight_kg || null;
      const userObjective = objective || profile?.objective;
      const weightDelta = previousWeight ? newWeight - previousWeight : null;

      let isMilestone = false;
      let milestoneData: Record<string, any> = {};
      let bonusXp = 0;

      if (weightDelta && userObjective) {
        if (userObjective === 'fat_loss' && weightDelta <= -1) {
          isMilestone = true;
          milestoneData = {
            type: 'weight_loss',
            amount: Math.abs(weightDelta),
            objective: userObjective
          };
          bonusXp = XP_VALUES.WEIGHT_MILESTONE_BONUS;
        } else if (userObjective === 'muscle_gain' && weightDelta >= 0.5) {
          isMilestone = true;
          milestoneData = {
            type: 'weight_gain',
            amount: weightDelta,
            objective: userObjective
          };
          bonusXp = XP_VALUES.WEIGHT_MILESTONE_BONUS;
        }
      }

      const totalXp = XP_VALUES.WEIGHT_UPDATE + bonusXp;

      logger.info('GAMIFICATION', 'Inserting weight update into history', {
        userId,
        previousWeight,
        newWeight,
        weightDelta,
        totalXp,
        isMilestone
      });

      const { data: weightUpdateData, error: weightError } = await supabase
        .from('weight_updates_history')
        .insert({
          user_id: userId,
          previous_weight: previousWeight,
          new_weight: newWeight,
          weight_delta: weightDelta,
          updated_from: updatedFrom,
          xp_awarded: totalXp,
          is_milestone: isMilestone,
          milestone_data: milestoneData
        })
        .select()
        .single();

      if (weightError) {
        logger.error('GAMIFICATION', 'Failed to insert weight update history', {
          userId,
          error: weightError,
          errorMessage: weightError.message,
          errorCode: weightError.code,
          errorDetails: weightError.details,
          errorHint: weightError.hint
        });
        throw weightError;
      }

      logger.info('GAMIFICATION', 'Weight update history inserted successfully', {
        weightUpdateId: weightUpdateData.id
      });

      const { data: updatedProfile, error: profileError } = await supabase
        .from('user_profile')
        .update({ weight_kg: newWeight })
        .eq('user_id', userId)
        .select('weight_kg')
        .single();

      if (profileError) {
        logger.error('GAMIFICATION', 'Failed to update weight in user_profile', {
          userId,
          newWeight,
          error: profileError
        });
        throw profileError;
      }

      logger.info('GAMIFICATION', 'Weight updated in user_profile successfully', {
        userId,
        previousWeight,
        newWeight,
        updatedWeight: updatedProfile?.weight_kg
      });

      logger.info('GAMIFICATION', 'Awarding XP for weight update', {
        userId,
        totalXp,
        eventType: 'weight_update'
      });

      const xpResult = await this.awardXp(userId, 'weight_update', 'general', totalXp, {
        previous_weight: previousWeight,
        new_weight: newWeight,
        weight_delta: weightDelta,
        is_milestone: isMilestone,
        ...milestoneData
      });

      logger.info('GAMIFICATION', 'XP awarded successfully', {
        userId,
        xpAwarded: xpResult.xpAwarded,
        leveledUp: xpResult.leveledUp,
        newLevel: xpResult.newLevel
      });

      logger.info('GAMIFICATION', 'Weight updated with XP reward', {
        userId,
        previousWeight,
        newWeight,
        weightDelta,
        isMilestone,
        xpAwarded: totalXp
      });

      // TRANSFORMATION RECORDS: Detect and create transformation records automatically
      try {
        logger.info('GAMIFICATION', 'Detecting transformation records', {
          userId,
          newWeight,
          objective: userObjective
        });

        const { data: recordsData, error: recordsError } = await supabase.rpc(
          'detect_transformation_records',
          {
            p_user_id: userId,
            p_new_weight: newWeight,
            p_objective: userObjective || 'fat_loss'
          }
        );

        if (recordsError) {
          logger.error('GAMIFICATION', 'Failed to detect transformation records', {
            userId,
            error: recordsError
          });
          // Don't throw - records are not critical for weight update success
        } else if (recordsData) {
          const recordsArray = Array.isArray(recordsData) ? recordsData : [];
          logger.info('GAMIFICATION', 'Transformation records detected', {
            userId,
            recordsCount: recordsArray.length,
            records: recordsArray
          });
        }
      } catch (recordError) {
        logger.error('GAMIFICATION', 'Exception during transformation record detection', {
          userId,
          error: recordError
        });
        // Continue execution - records are not critical
      }

      const weightUpdate: WeightUpdate = {
        id: weightUpdateData.id,
        userId: weightUpdateData.user_id,
        previousWeight: weightUpdateData.previous_weight,
        newWeight: weightUpdateData.new_weight,
        weightDelta: weightUpdateData.weight_delta,
        updatedFrom: weightUpdateData.updated_from,
        xpAwarded: weightUpdateData.xp_awarded,
        isMilestone: weightUpdateData.is_milestone,
        milestoneData: weightUpdateData.milestone_data,
        createdAt: weightUpdateData.created_at
      };

      return { weightUpdate, xpResult };
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to update weight', { userId, newWeight, error });
      throw error;
    }
  }

  async getRecentXpEvents(userId: string, limit: number = 20): Promise<XpEvent[]> {
    try {
      const { data, error } = await supabase
        .from('xp_events_log')
        .select('*')
        .eq('user_id', userId)
        .order('event_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((event) => ({
        id: event.id,
        userId: event.user_id,
        eventType: event.event_type,
        eventCategory: event.event_category,
        baseXp: event.base_xp,
        multiplier: parseFloat(event.multiplier),
        finalXp: event.final_xp,
        eventDate: event.event_date,
        eventMetadata: event.event_metadata,
        createdAt: event.created_at
      }));
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to get recent XP events', { userId, error });
      throw error;
    }
  }

  async getLevelMilestone(level: number): Promise<LevelMilestone | null> {
    try {
      const { data, error } = await supabase
        .from('level_milestones')
        .select('*')
        .eq('level', level)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        level: data.level,
        xpRequired: data.xp_required,
        xpToNext: data.xp_to_next,
        milestoneName: data.milestone_name,
        milestoneDescription: data.milestone_description,
        unlockFeatures: data.unlock_features,
        badgeIcon: data.badge_icon,
        badgeColor: data.badge_color,
        isMajorMilestone: data.is_major_milestone,
        createdAt: data.created_at
      };
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to get level milestone', { level, error });
      throw error;
    }
  }

  async getAllLevelMilestones(): Promise<LevelMilestone[]> {
    try {
      const { data, error } = await supabase
        .from('level_milestones')
        .select('*')
        .order('level', { ascending: true });

      if (error) throw error;

      return (data || []).map((milestone) => ({
        level: milestone.level,
        xpRequired: milestone.xp_required,
        xpToNext: milestone.xp_to_next,
        milestoneName: milestone.milestone_name,
        milestoneDescription: milestone.milestone_description,
        unlockFeatures: milestone.unlock_features,
        badgeIcon: milestone.badge_icon,
        badgeColor: milestone.badge_color,
        isMajorMilestone: milestone.is_major_milestone,
        createdAt: milestone.created_at
      }));
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to get all level milestones', { error });
      throw error;
    }
  }

  async getWeightUpdateHistory(userId: string, limit: number = 10): Promise<WeightUpdate[]> {
    try {
      const { data, error } = await supabase
        .from('weight_updates_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((update) => ({
        id: update.id,
        userId: update.user_id,
        previousWeight: update.previous_weight,
        newWeight: update.new_weight,
        weightDelta: update.weight_delta,
        updatedFrom: update.updated_from,
        xpAwarded: update.xp_awarded,
        isMilestone: update.is_milestone,
        milestoneData: update.milestone_data,
        createdAt: update.created_at
      }));
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to get weight update history', { userId, error });
      throw error;
    }
  }

  async getXpStats(userId: string, days: number = 30): Promise<{
    totalXpEarned: number;
    averageXpPerDay: number;
    topEventTypes: Array<{ eventType: string; count: number; totalXp: number }>;
    categoryBreakdown: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('xp_events_log')
        .select('event_type, event_category, final_xp')
        .eq('user_id', userId)
        .gte('event_date', startDate.toISOString());

      if (error) throw error;

      const events = data || [];
      const totalXpEarned = events.reduce((sum, e) => sum + e.final_xp, 0);
      const averageXpPerDay = Math.round(totalXpEarned / days);

      const eventTypeMap = new Map<string, { count: number; totalXp: number }>();
      const categoryBreakdown: Record<string, number> = {};

      events.forEach((event) => {
        const existing = eventTypeMap.get(event.event_type) || { count: 0, totalXp: 0 };
        eventTypeMap.set(event.event_type, {
          count: existing.count + 1,
          totalXp: existing.totalXp + event.final_xp
        });

        categoryBreakdown[event.event_category] =
          (categoryBreakdown[event.event_category] || 0) + event.final_xp;
      });

      const topEventTypes = Array.from(eventTypeMap.entries())
        .map(([eventType, stats]) => ({
          eventType,
          count: stats.count,
          totalXp: stats.totalXp
        }))
        .sort((a, b) => b.totalXp - a.totalXp)
        .slice(0, 5);

      return {
        totalXpEarned,
        averageXpPerDay,
        topEventTypes,
        categoryBreakdown
      };
    } catch (error) {
      logger.error('GAMIFICATION', 'Failed to get XP stats', { userId, error });
      throw error;
    }
  }
}

export const gamificationService = new GamificationService();
