import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type {
  UserKnowledge,
  ForgeType
} from '../../types';
import type { CacheManager } from '../../core/CacheManager';
import type { TodayData } from '../collectors/TodayDataCollector';
import { loadProfileKnowledge } from './profileLoader';
import { createCollectors, type CollectorInstances } from './collectorManager';
import { calculateCompleteness } from './utils';
import {
  getDefaultProfileKnowledge,
  getDefaultTrainingKnowledge,
  getDefaultEquipmentKnowledge,
  getDefaultNutritionKnowledge,
  getDefaultFastingKnowledge,
  getDefaultBodyScanKnowledge,
  getDefaultEnergyKnowledge,
  getDefaultTemporalKnowledge,
  getDefaultBreastfeedingKnowledge,
  getDefaultGamificationKnowledge,
  getDefaultPredictionKnowledge
} from './defaults';

export class UserKnowledgeBase {
  private supabase: SupabaseClient;
  private cacheManager: CacheManager;
  private currentKnowledge: UserKnowledge | null = null;
  private rawProfile: any | null = null;
  private collectors: CollectorInstances;
  private todayData: TodayData | null = null;

  constructor(supabase: SupabaseClient, cacheManager: CacheManager) {
    this.supabase = supabase;
    this.cacheManager = cacheManager;
    this.collectors = createCollectors(supabase);
  }

  async loadUserKnowledge(userId: string): Promise<UserKnowledge> {
    const startTime = Date.now();

    try {
      logger.info('USER_KNOWLEDGE_BASE', 'Loading user knowledge', { userId });

      const cacheKey = `knowledge:${userId}`;
      const cached = this.cacheManager.get<UserKnowledge>(cacheKey);

      if (cached) {
        logger.info('USER_KNOWLEDGE_BASE', 'Knowledge loaded from cache', { userId });
        this.currentKnowledge = cached;
        return cached;
      }

      const results = await Promise.allSettled([
        loadProfileKnowledge(this.supabase, userId, (profile) => { this.rawProfile = profile; }),
        this.collectors.training.collect(userId),
        this.collectors.equipment.collect(userId),
        this.collectors.nutrition.collect(userId),
        this.collectors.fasting.collect(userId),
        this.collectors.bodyScan.collect(userId),
        this.collectors.energy.collect(userId),
        this.collectors.activityAnalysis.collect(userId),
        this.collectors.temporal.collect(userId),
        this.collectors.today.collect(userId),
        this.collectors.breastfeeding.collect(userId),
        this.collectors.gamification.collect(userId),
        this.collectors.prediction.collect(userId),
        this.collectors.calorieBalance.collect(userId)
      ]);

      const profile = results[0].status === 'fulfilled'
        ? results[0].value
        : getDefaultProfileKnowledge(userId);

      const training = results[1].status === 'fulfilled'
        ? results[1].value
        : getDefaultTrainingKnowledge();

      const equipment = results[2].status === 'fulfilled'
        ? results[2].value
        : getDefaultEquipmentKnowledge();

      const nutrition = results[3].status === 'fulfilled'
        ? results[3].value
        : getDefaultNutritionKnowledge();

      const fasting = results[4].status === 'fulfilled'
        ? results[4].value
        : getDefaultFastingKnowledge();

      const bodyScan = results[5].status === 'fulfilled'
        ? results[5].value
        : getDefaultBodyScanKnowledge();

      const energyBase = results[6].status === 'fulfilled'
        ? results[6].value
        : getDefaultEnergyKnowledge();

      const activityAnalyses = results[7].status === 'fulfilled'
        ? results[7].value
        : { recentAnalyses: [], analysisByType: { activityAnalysis: [], trendAnalysis: [], transcription: [] }, lastAnalysisDate: null, analysisCount: 0, successRate: 0, averageProcessingTime: 0, cachedAnalysesCount: 0, hasData: false };

      const energy = {
        ...energyBase,
        activityAnalyses
      };

      const temporal = results[8].status === 'fulfilled'
        ? results[8].value
        : getDefaultTemporalKnowledge();

      this.todayData = results[9].status === 'fulfilled'
        ? results[9].value
        : null;

      const breastfeeding = results[10].status === 'fulfilled'
        ? results[10].value
        : getDefaultBreastfeedingKnowledge();

      const gamification = results[11].status === 'fulfilled'
        ? results[11].value
        : getDefaultGamificationKnowledge();

      const prediction = results[12].status === 'fulfilled'
        ? results[12].value
        : getDefaultPredictionKnowledge();

      const calorieBalance = results[13].status === 'fulfilled'
        ? results[13].value
        : { caloriesIn: 0, caloriesOut: 0, caloriesBalance: 0, dailyTarget: 2000, remainingCalories: 2000, percentageOfTarget: 0, calorieBreakdown: { meals: 0, snacks: 0, drinks: 0 }, activityBreakdown: { bmr: 0, training: 0, activities: 0, neat: 0 }, macros: { protein: 0, carbs: 0, fat: 0 }, status: 'maintenance' as const, lastMealTime: null, lastActivityTime: null, hasData: false };

      const failures = [
        { index: 0, name: 'profile' },
        { index: 1, name: 'training' },
        { index: 2, name: 'equipment' },
        { index: 3, name: 'nutrition' },
        { index: 4, name: 'fasting' },
        { index: 5, name: 'bodyScan' },
        { index: 6, name: 'energy' },
        { index: 7, name: 'activityAnalyses' },
        { index: 8, name: 'temporal' },
        { index: 9, name: 'today' },
        { index: 10, name: 'breastfeeding' },
        { index: 11, name: 'gamification' },
        { index: 12, name: 'prediction' },
        { index: 13, name: 'calorieBalance' }
      ];

      failures.forEach(({ index, name }) => {
        if (results[index].status === 'rejected') {
          logger.warn('USER_KNOWLEDGE_BASE', `Failed to load ${name} data, using defaults`, {
            error: results[index].reason
          });
        }
      });

      const knowledge: UserKnowledge = {
        profile,
        training,
        equipment,
        nutrition,
        fasting,
        bodyScan,
        energy,
        temporal,
        gamification,
        prediction,
        calorieBalance,
        today: this.todayData,
        lastUpdated: {
          training: Date.now(),
          equipment: Date.now(),
          nutrition: Date.now(),
          fasting: Date.now(),
          'body-scan': Date.now(),
          energy: Date.now(),
          temporal: Date.now()
        },
        completeness: {
          training: calculateCompleteness(training),
          equipment: calculateCompleteness(equipment),
          nutrition: calculateCompleteness(nutrition),
          fasting: calculateCompleteness(fasting),
          'body-scan': calculateCompleteness(bodyScan),
          energy: calculateCompleteness(energy),
          temporal: calculateCompleteness(temporal)
        }
      };

      this.cacheManager.set(cacheKey, knowledge, 5 * 60 * 1000);

      this.currentKnowledge = knowledge;

      const loadTime = Date.now() - startTime;
      logger.info('USER_KNOWLEDGE_BASE', 'Knowledge loaded successfully', {
        userId,
        loadTime: `${loadTime}ms`,
        trainingCompleteness: knowledge.completeness.training,
        equipmentCompleteness: knowledge.completeness.equipment,
        nutritionCompleteness: knowledge.completeness.nutrition,
        fastingCompleteness: knowledge.completeness.fasting,
        bodyScanCompleteness: knowledge.completeness['body-scan'],
        energyCompleteness: knowledge.completeness.energy,
        temporalCompleteness: knowledge.completeness.temporal,
        todayActivities: this.todayData?.totalActivities || 0
      });

      return knowledge;
    } catch (error) {
      logger.error('USER_KNOWLEDGE_BASE', 'Failed to load knowledge', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getUserKnowledge(): Promise<UserKnowledge> {
    if (!this.currentKnowledge) {
      throw new Error('Knowledge not loaded. Call loadUserKnowledge first.');
    }

    return this.currentKnowledge;
  }

  getRawProfile(): any | null {
    return this.rawProfile;
  }

  async refreshForge(userId: string, forgeType: ForgeType): Promise<void> {
    logger.info('USER_KNOWLEDGE_BASE', 'Refreshing forge data', { userId, forgeType });

    if (!this.currentKnowledge) {
      await this.loadUserKnowledge(userId);
      return;
    }

    switch (forgeType) {
      case 'training':
        this.currentKnowledge.training = await this.collectors.training.collect(userId);
        this.currentKnowledge.lastUpdated.training = Date.now();
        this.currentKnowledge.completeness.training = calculateCompleteness(
          this.currentKnowledge.training
        );
        break;
      case 'equipment':
        this.currentKnowledge.equipment = await this.collectors.equipment.collect(userId);
        this.currentKnowledge.lastUpdated.equipment = Date.now();
        this.currentKnowledge.completeness.equipment = calculateCompleteness(
          this.currentKnowledge.equipment
        );
        break;
      case 'nutrition':
        this.currentKnowledge.nutrition = await this.collectors.nutrition.collect(userId);
        this.currentKnowledge.lastUpdated.nutrition = Date.now();
        this.currentKnowledge.completeness.nutrition = calculateCompleteness(
          this.currentKnowledge.nutrition
        );
        break;
      case 'fasting':
        this.currentKnowledge.fasting = await this.collectors.fasting.collect(userId);
        this.currentKnowledge.lastUpdated.fasting = Date.now();
        this.currentKnowledge.completeness.fasting = calculateCompleteness(
          this.currentKnowledge.fasting
        );
        break;
      case 'body-scan':
        this.currentKnowledge.bodyScan = await this.collectors.bodyScan.collect(userId);
        this.currentKnowledge.lastUpdated['body-scan'] = Date.now();
        this.currentKnowledge.completeness['body-scan'] = calculateCompleteness(
          this.currentKnowledge.bodyScan
        );
        break;
      case 'energy':
        this.currentKnowledge.energy = await this.collectors.energy.collect(userId);
        this.currentKnowledge.lastUpdated.energy = Date.now();
        this.currentKnowledge.completeness.energy = calculateCompleteness(
          this.currentKnowledge.energy
        );
        break;
      case 'temporal':
        this.currentKnowledge.temporal = await this.collectors.temporal.collect(userId);
        this.currentKnowledge.lastUpdated.temporal = Date.now();
        this.currentKnowledge.completeness.temporal = calculateCompleteness(
          this.currentKnowledge.temporal
        );
        break;
      default:
        logger.warn('USER_KNOWLEDGE_BASE', 'Unknown forge type', { forgeType });
    }

    this.cacheManager.invalidateForge(forgeType);

    logger.info('USER_KNOWLEDGE_BASE', 'Forge data refreshed', { userId, forgeType });
  }

  getTodayData(): TodayData | null {
    return this.todayData;
  }
}
