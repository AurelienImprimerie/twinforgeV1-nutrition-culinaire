/**
 * Menopause Data Collector
 * Collects menopause tracking data for the Head system
 */

import { supabase } from '../../../supabase/client';
import logger from '../../../../lib/utils/logger';
import {
  calculateMenopausePhase,
  formatMenopauseForAI,
  shouldSuggestTransition,
  getAllRecommendations,
} from '../../../../lib/utils/menopauseHelper';
import type {
  ReproductiveStatus,
  PerimenopauseStage,
  MenopauseTracking,
  MenopauseSymptomLog,
} from '../../../../domain/menopause';

export interface MenopauseKnowledge {
  hasActiveTracking: boolean;
  status: ReproductiveStatus | null;
  stage: PerimenopauseStage | null;
  daysSinceLastPeriod: number | null;
  daysUntilMenopauseConfirmation: number | null;
  isInTransition: boolean;
  phaseDescription: string | null;
  energyLevel: 'low' | 'moderate' | 'high' | null;
  metabolicRate: 'reduced' | 'normal' | null;
  fshLevel: number | null;
  estrogenLevel: number | null;
  recentSymptoms: MenopauseSymptomLog[];
  averageSymptomIntensity: number;
  recommendations: {
    nutrition: string[];
    exercise: string[];
    fasting: string[];
    lifestyle: string[];
  } | null;
  transitionSuggestion: {
    shouldSuggest: boolean;
    suggestedStatus: ReproductiveStatus | null;
    reason: string;
  } | null;
  formattedForAI: string | null;
  lastUpdate: string | null;
  hasData: boolean;
}

/**
 * Collect menopause data for a user
 */
export async function collectMenopauseData(userId: string): Promise<MenopauseKnowledge> {
  try {
    const tracking = await getMenopauseTracking(userId);

    if (!tracking) {
      return getEmptyKnowledge();
    }

    const phaseData = calculateMenopausePhase(
      tracking.reproductive_status,
      tracking.last_period_date,
      tracking.menopause_confirmation_date,
      tracking.perimenopause_stage
    );

    const recentSymptoms = await getRecentSymptoms(userId, 30);
    const averageIntensity = calculateAverageSymptomIntensity(recentSymptoms);

    const recommendations = tracking.reproductive_status !== 'menstruating'
      ? getAllRecommendations(tracking.reproductive_status)
      : null;

    const transitionSuggestion = phaseData
      ? shouldSuggestTransition(
          tracking.reproductive_status,
          phaseData.daysSinceLastPeriod
        )
      : null;

    const formattedForAI = phaseData ? formatMenopauseForAI(phaseData) : null;

    return {
      hasActiveTracking: true,
      status: tracking.reproductive_status,
      stage: tracking.perimenopause_stage,
      daysSinceLastPeriod: phaseData?.daysSinceLastPeriod ?? null,
      daysUntilMenopauseConfirmation: phaseData?.daysUntilMenopauseConfirmation ?? null,
      isInTransition: phaseData?.isInTransition ?? false,
      phaseDescription: phaseData?.phaseDescription ?? null,
      energyLevel: phaseData?.energyLevel ?? null,
      metabolicRate: phaseData?.metabolicRate ?? null,
      fshLevel: tracking.fsh_level,
      estrogenLevel: tracking.estrogen_level,
      recentSymptoms,
      averageSymptomIntensity: averageIntensity,
      recommendations,
      transitionSuggestion,
      formattedForAI,
      lastUpdate: tracking.updated_at,
      hasData: true,
    };
  } catch (error) {
    logger.error('MENOPAUSE_COLLECTOR', 'Failed to collect menopause data', { error, userId });
    return getEmptyKnowledge();
  }
}

/**
 * Get menopause tracking record for user
 */
async function getMenopauseTracking(userId: string): Promise<MenopauseTracking | null> {
  const { data, error } = await supabase
    .from('menopause_tracking')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('MENOPAUSE_COLLECTOR', 'Failed to fetch tracking', { error, userId });
    return null;
  }

  return data;
}

/**
 * Get recent symptom logs
 */
async function getRecentSymptoms(userId: string, days: number): Promise<MenopauseSymptomLog[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('menopause_symptoms_log')
    .select('*')
    .eq('user_id', userId)
    .gte('symptom_date', startDate.toISOString().split('T')[0])
    .order('symptom_date', { ascending: false })
    .limit(30);

  if (error) {
    logger.error('MENOPAUSE_COLLECTOR', 'Failed to fetch symptoms', { error, userId });
    return [];
  }

  return data || [];
}

/**
 * Calculate average symptom intensity from logs
 */
function calculateAverageSymptomIntensity(symptoms: MenopauseSymptomLog[]): number {
  if (symptoms.length === 0) return 0;

  const intensityFields: (keyof MenopauseSymptomLog)[] = [
    'hot_flashes_intensity',
    'night_sweats_intensity',
    'mood_changes_intensity',
    'vaginal_dryness_intensity',
    'brain_fog_intensity',
    'joint_pain_intensity',
  ];

  let total = 0;
  let count = 0;

  symptoms.forEach((symptom) => {
    intensityFields.forEach((field) => {
      const value = symptom[field];
      if (typeof value === 'number' && value !== null) {
        total += value;
        count++;
      }
    });
  });

  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Return empty knowledge structure
 */
function getEmptyKnowledge(): MenopauseKnowledge {
  return {
    hasActiveTracking: false,
    status: null,
    stage: null,
    daysSinceLastPeriod: null,
    daysUntilMenopauseConfirmation: null,
    isInTransition: false,
    phaseDescription: null,
    energyLevel: null,
    metabolicRate: null,
    fshLevel: null,
    estrogenLevel: null,
    recentSymptoms: [],
    averageSymptomIntensity: 0,
    recommendations: null,
    transitionSuggestion: null,
    formattedForAI: null,
    lastUpdate: null,
    hasData: false,
  };
}
