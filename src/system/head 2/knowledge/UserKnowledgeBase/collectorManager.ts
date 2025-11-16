import type { SupabaseClient } from '@supabase/supabase-js';
import { TrainingDataCollector } from '../collectors/TrainingDataCollector';
import { EquipmentDataCollector } from '../collectors/EquipmentDataCollector';
import { NutritionDataCollector } from '../collectors/NutritionDataCollector';
import { FastingDataCollector } from '../collectors/FastingDataCollector';
import { BodyScanDataCollector } from '../collectors/BodyScanDataCollector';
import { EnergyDataCollector } from '../collectors/EnergyDataCollector';
import { ActivityAnalysisCollector } from '../collectors/ActivityAnalysisCollector';
import { TemporalDataCollector } from '../collectors/TemporalDataCollector';
import { TodayDataCollector } from '../collectors/TodayDataCollector';
import { BreastfeedingDataCollector } from '../collectors/BreastfeedingDataCollector';
import { GamificationDataCollector } from '../collectors/GamificationDataCollector';
import { TransformationPredictionDataCollector } from '../collectors/TransformationPredictionDataCollector';
import { CalorieBalanceDataCollector } from '../collectors/CalorieBalanceDataCollector';
import { AbsenceDataCollector } from '../collectors/AbsenceDataCollector';

export interface CollectorInstances {
  training: TrainingDataCollector;
  equipment: EquipmentDataCollector;
  nutrition: NutritionDataCollector;
  fasting: FastingDataCollector;
  bodyScan: BodyScanDataCollector;
  energy: EnergyDataCollector;
  activityAnalysis: ActivityAnalysisCollector;
  temporal: TemporalDataCollector;
  today: TodayDataCollector;
  breastfeeding: BreastfeedingDataCollector;
  gamification: GamificationDataCollector;
  prediction: TransformationPredictionDataCollector;
  calorieBalance: CalorieBalanceDataCollector;
  absence: AbsenceDataCollector;
}

export function createCollectors(supabase: SupabaseClient): CollectorInstances {
  return {
    training: new TrainingDataCollector(supabase),
    equipment: new EquipmentDataCollector(supabase),
    nutrition: new NutritionDataCollector(supabase),
    fasting: new FastingDataCollector(supabase),
    bodyScan: new BodyScanDataCollector(supabase),
    energy: new EnergyDataCollector(supabase),
    activityAnalysis: new ActivityAnalysisCollector(supabase),
    temporal: new TemporalDataCollector(supabase),
    today: new TodayDataCollector(supabase),
    breastfeeding: new BreastfeedingDataCollector(supabase),
    gamification: new GamificationDataCollector(supabase),
    prediction: new TransformationPredictionDataCollector(supabase),
    calorieBalance: new CalorieBalanceDataCollector(supabase),
    absence: new AbsenceDataCollector(supabase)
  };
}
