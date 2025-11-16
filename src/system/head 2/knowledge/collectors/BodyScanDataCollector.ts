/**
 * BodyScanDataCollector - Collect all body scan data for user
 * Aggregates body scans, measurements, and progression trends
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { BodyScanKnowledge, BodyScanSummary, BodyMeasurements, MorphologyInsightsKnowledge } from '../../types';
import { MorphologyInsightsDataCollector } from './MorphologyInsightsDataCollector';

export class BodyScanDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<BodyScanKnowledge> {
    try {
      logger.info('BODY_SCAN_DATA_COLLECTOR', 'Starting body scan data collection', { userId });

      const recentScans = await this.collectRecentScans(userId);

      // Extract latest measurements
      const latestMeasurements = recentScans.length > 0 ? recentScans[0].measurements : null;

      // Calculate progression trend
      const progressionTrend = this.calculateProgressionTrend(recentScans);

      // Collect morphology insights
      const morphologyInsightsCollector = new MorphologyInsightsDataCollector(this.supabase);
      const morphologyInsights = await morphologyInsightsCollector.collect(userId);

      const lastScanDate = recentScans.length > 0 ? recentScans[0].scanDate : null;
      const hasData = recentScans.length > 0;

      logger.info('BODY_SCAN_DATA_COLLECTOR', 'Body scan data collected', {
        userId,
        scansCount: recentScans.length,
        hasLatestMeasurements: !!latestMeasurements,
        progressionTrend,
        morphologyInsightsCount: morphologyInsights.latestInsights.length,
        hasData
      });

      return {
        recentScans,
        lastScanDate,
        latestMeasurements,
        progressionTrend,
        morphologyInsights,
        hasData
      };
    } catch (error) {
      logger.error('BODY_SCAN_DATA_COLLECTOR', 'Failed to collect body scan data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect recent body scans (last 90 days)
   */
  private async collectRecentScans(userId: string): Promise<BodyScanSummary[]> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: scans, error } = await this.supabase
      .from('body_scans')
      .select(`
        id, timestamp, created_at, weight, body_fat_percentage, bmi,
        waist_circumference, chest_circumference, hips_circumference, thigh_circumference,
        arm_circumference, calf_circumference, neck_circumference,
        morph_values, limb_masses, skin_tone, skin_tone_map_v2, resolved_gender,
        avatar_version, metrics, raw_measurements,
        lean_body_mass, bmr
      `)
      .eq('user_id', userId)
      .gte('timestamp', ninetyDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(30);

    if (error) {
      logger.error('BODY_SCAN_DATA_COLLECTOR', 'Failed to load body scans', { userId, error });
      return [];
    }

    if (!scans || scans.length === 0) {
      return [];
    }

    return scans.map((scan) => {
      // Extract measurements from JSONB or direct columns
      const metrics = scan.metrics as any || {};
      const rawMeasurements = scan.raw_measurements as any || {};

      // Normalize gender
      let resolvedGender: 'male' | 'female' | undefined;
      if (scan.resolved_gender === 'masculine') resolvedGender = 'male';
      else if (scan.resolved_gender === 'feminine') resolvedGender = 'female';
      else if (scan.resolved_gender === 'male' || scan.resolved_gender === 'female') {
        resolvedGender = scan.resolved_gender as 'male' | 'female';
      }

      // Extract skin tone (prefer V2 format)
      const skinTone = scan.skin_tone_map_v2 || scan.skin_tone || null;

      return {
        id: scan.id,
        scanDate: scan.timestamp,
        createdAt: scan.created_at,
        scanType: 'photo_scan',
        measurements: {
          weight: scan.weight || metrics.weight || rawMeasurements.weight,
          bodyFat: scan.body_fat_percentage || metrics.bodyFat || rawMeasurements.bodyFat,
          muscleMass: scan.muscle_mass_kg || metrics.muscleMass || rawMeasurements.muscleMass,
          boneMass: scan.bone_mass_kg || metrics.boneMass || rawMeasurements.boneMass,
          bodyWater: scan.body_water_percentage || metrics.bodyWater || rawMeasurements.bodyWater,
          visceralFat: scan.visceral_fat_level || metrics.visceralFat || rawMeasurements.visceralFat,
          metabolicAge: scan.metabolic_age || metrics.metabolicAge || rawMeasurements.metabolicAge,
          bmi: scan.bmi || metrics.bmi || rawMeasurements.bmi,
          waist: scan.waist_circumference || metrics.waist || rawMeasurements.waist,
          chest: scan.chest_circumference || metrics.chest || rawMeasurements.chest,
          hips: scan.hips_circumference || metrics.hips || rawMeasurements.hips,
          thigh: scan.thigh_circumference || metrics.thigh || rawMeasurements.thigh,
          arms: scan.arm_circumference || metrics.arms || rawMeasurements.arms,
          calves: scan.calf_circumference || metrics.calves || rawMeasurements.calves,
          neck: scan.neck_circumference || metrics.neck || rawMeasurements.neck,
          shoulders: metrics.shoulders || rawMeasurements.shoulders,
          legs: metrics.legs || rawMeasurements.legs
        },
        morphValues: scan.morph_values as Record<string, number> | undefined,
        limbMasses: scan.limb_masses as Record<string, number> | undefined,
        skinTone,
        resolvedGender,
        avatarVersion: scan.avatar_version || undefined,
        photos: {
          front: undefined,
          side: undefined
        },
        analysisComplete: true,
        dataQualityScore: this.calculateScanDataQuality(scan, metrics, rawMeasurements)
      };
    });
  }

  /**
   * Calculate progression trend based on recent scans
   */
  private calculateProgressionTrend(
    scans: BodyScanSummary[]
  ): 'improving' | 'stable' | 'declining' | null {
    if (scans.length < 2) {
      return null;
    }

    const latest = scans[0].measurements;
    const previous = scans.slice(1, Math.min(4, scans.length));

    let avgMuscleMass = 0;
    let avgBodyFat = 0;
    let muscleMassCount = 0;
    let bodyFatCount = 0;

    previous.forEach((scan) => {
      if (scan.measurements.muscleMass !== undefined) {
        avgMuscleMass += scan.measurements.muscleMass;
        muscleMassCount++;
      }
      if (scan.measurements.bodyFat !== undefined) {
        avgBodyFat += scan.measurements.bodyFat;
        bodyFatCount++;
      }
    });

    if (muscleMassCount > 0) avgMuscleMass /= muscleMassCount;
    if (bodyFatCount > 0) avgBodyFat /= bodyFatCount;

    let improvingScore = 0;
    let decliningScore = 0;

    if (latest.muscleMass !== undefined && muscleMassCount > 0) {
      const muscleDiff = latest.muscleMass - avgMuscleMass;
      if (muscleDiff > 0.5) improvingScore++;
      else if (muscleDiff < -0.5) decliningScore++;
    }

    if (latest.bodyFat !== undefined && bodyFatCount > 0) {
      const fatDiff = latest.bodyFat - avgBodyFat;
      if (fatDiff < -1) improvingScore++;
      else if (fatDiff > 1) decliningScore++;
    }

    if (improvingScore > decliningScore) return 'improving';
    if (decliningScore > improvingScore) return 'declining';
    return 'stable';
  }

  /**
   * Calculate scan data quality score
   */
  private calculateScanDataQuality(scan: any, metrics: any, rawMeasurements: any): number {
    let score = 0;
    let maxScore = 15;

    if (scan.weight || metrics.weight) score++;
    if (scan.body_fat_percentage || metrics.bodyFat) score++;
    if (scan.muscle_mass_kg || metrics.muscleMass) score++;
    if (scan.waist_circumference || metrics.waist) score++;
    if (scan.chest_circumference || metrics.chest) score++;
    if (scan.hips_circumference || metrics.hips) score++;
    if (scan.bmi || metrics.bmi) score++;
    if (scan.morph_values) score += 2;
    if (scan.limb_masses) score += 2;
    if (scan.skin_tone || scan.skin_tone_map_v2) score++;
    if (scan.lean_body_mass) score++;
    if (scan.bmr) score++;
    if (scan.resolved_gender) score++;

    return Math.round((score / maxScore) * 100);
  }
}
