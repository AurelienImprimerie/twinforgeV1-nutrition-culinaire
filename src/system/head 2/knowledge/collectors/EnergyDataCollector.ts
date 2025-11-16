/**
 * EnergyDataCollector - Collect biometric and energy data
 * Aggregates wearable data, HRV, VO2max, fatigue, recovery scores
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { EnergyKnowledge, BiometricActivity } from '../../types';

export class EnergyDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<EnergyKnowledge> {
    try {
      logger.info('ENERGY_DATA_COLLECTOR', 'Starting energy data collection', { userId });

      const [activitiesResult, devicesResult] = await Promise.allSettled([
        this.collectRecentActivities(userId),
        this.collectConnectedDevices(userId)
      ]);

      const recentActivities =
        activitiesResult.status === 'fulfilled' ? activitiesResult.value : [];
      const connectedDevices =
        devicesResult.status === 'fulfilled' ? devicesResult.value : [];

      // Calculate biometric stats
      const biometrics = this.calculateBiometricStats(recentActivities);

      // Calculate recovery and fatigue
      const { recoveryScore, fatigueScore, trainingLoad7d } = this.calculateRecoveryMetrics(recentActivities);

      const hasData = recentActivities.length > 0 || connectedDevices.length > 0;

      logger.info('ENERGY_DATA_COLLECTOR', 'Energy data collected', {
        userId,
        activitiesCount: recentActivities.length,
        devicesCount: connectedDevices.length,
        hrRestingAvg: biometrics.hrResting,
        hrvAvg: biometrics.hrvAvg,
        hasData
      });

      return {
        recentActivities,
        connectedDevices,
        hasWearableConnected: connectedDevices.length > 0,
        biometrics,
        recoveryScore,
        fatigueScore,
        trainingLoad7d,
        lastActivityDate: recentActivities.length > 0 ? recentActivities[0].timestamp : null,
        hasData
      };
    } catch (error) {
      logger.error('ENERGY_DATA_COLLECTOR', 'Failed to collect energy data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect recent activities (last 30 days)
   * Includes ALL activities, with or without wearable data
   */
  private async collectRecentActivities(userId: string): Promise<BiometricActivity[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities, error } = await this.supabase
      .from('activities')
      .select(`
        id,
        user_id,
        timestamp,
        created_at,
        type,
        duration_min,
        distance_meters,
        calories_est,
        notes,
        intensity,
        hr_avg,
        hr_max,
        hr_min,
        hr_resting_pre,
        hr_recovery_1min,
        hr_zone1_minutes,
        hr_zone2_minutes,
        hr_zone3_minutes,
        hr_zone4_minutes,
        hr_zone5_minutes,
        hrv_pre_activity,
        hrv_post_activity,
        hrv_avg_overnight,
        vo2max_estimated,
        training_load_score,
        recovery_score,
        fatigue_index,
        efficiency_score,
        avg_pace,
        avg_speed_kmh,
        elevation_gain_meters,
        elevation_loss_meters,
        avg_cadence_rpm,
        max_cadence_rpm,
        avg_power_watts,
        max_power_watts,
        normalized_power,
        sleep_quality_score,
        sleep_duration_hours,
        stress_level_pre,
        body_battery_pre,
        wearable_device_id,
        wearable_activity_id,
        wearable_synced_at,
        data_completeness_score,
        gps_accuracy_meters,
        sensor_quality_score
      `)
      .eq('user_id', userId)
      .gte('timestamp', thirtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('ENERGY_DATA_COLLECTOR', 'Failed to load activities', { userId, error });
      return [];
    }

    if (!activities || activities.length === 0) {
      return [];
    }

    return activities.map((activity) => ({
      id: activity.id,
      userId: activity.user_id,
      timestamp: activity.timestamp,
      createdAt: activity.created_at,
      discipline: activity.type || 'unknown',
      duration: activity.duration_min || 0,
      distance: activity.distance_meters || null,
      caloriesBurned: activity.calories_est || 0,
      notes: activity.notes || null,
      intensity: activity.intensity || null,
      hrAvg: activity.hr_avg || null,
      hrMax: activity.hr_max || null,
      hrMin: activity.hr_min || null,
      hrRestingPre: activity.hr_resting_pre || null,
      hrRecovery1Min: activity.hr_recovery_1min || null,
      hrZone1Minutes: activity.hr_zone1_minutes || null,
      hrZone2Minutes: activity.hr_zone2_minutes || null,
      hrZone3Minutes: activity.hr_zone3_minutes || null,
      hrZone4Minutes: activity.hr_zone4_minutes || null,
      hrZone5Minutes: activity.hr_zone5_minutes || null,
      hrvPreActivity: activity.hrv_pre_activity || null,
      hrvPostActivity: activity.hrv_post_activity || null,
      hrvAvgOvernight: activity.hrv_avg_overnight || null,
      vo2maxEstimated: activity.vo2max_estimated || null,
      trainingLoadScore: activity.training_load_score || null,
      recoveryScore: activity.recovery_score || null,
      fatigueLevel: activity.fatigue_index || null,
      efficiencyScore: activity.efficiency_score || null,
      avgPace: activity.avg_pace || null,
      avgSpeedKmh: activity.avg_speed_kmh || null,
      elevationGainMeters: activity.elevation_gain_meters || null,
      elevationLossMeters: activity.elevation_loss_meters || null,
      avgCadenceRpm: activity.avg_cadence_rpm || null,
      maxCadenceRpm: activity.max_cadence_rpm || null,
      avgPowerWatts: activity.avg_power_watts || null,
      maxPowerWatts: activity.max_power_watts || null,
      normalizedPower: activity.normalized_power || null,
      sleepQualityScore: activity.sleep_quality_score || null,
      sleepDurationHours: activity.sleep_duration_hours || null,
      stressLevelPre: activity.stress_level_pre || null,
      bodyBatteryPre: activity.body_battery_pre || null,
      wearableDeviceId: activity.wearable_device_id || null,
      wearableActivityId: activity.wearable_activity_id || null,
      wearableSyncedAt: activity.wearable_synced_at || null,
      dataCompletenessScore: activity.data_completeness_score || null,
      gpsAccuracyMeters: activity.gps_accuracy_meters || null,
      sensorQualityScore: activity.sensor_quality_score || null,
      weatherConditions: null,
      perceivedEffort: activity.intensity || null
    }));
  }

  /**
   * Collect connected wearable devices
   */
  private async collectConnectedDevices(userId: string): Promise<Array<{
    id: string;
    userId: string;
    provider: string;
    providerUserId: string;
    deviceType: string;
    deviceName: string;
    isActive: boolean;
    status: string;
    scopes: string[];
    lastSyncDate: string | null;
    metadata: any;
    connectedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>> {
    const { data: devices, error } = await this.supabase
      .from('connected_devices')
      .select(`
        id,
        user_id,
        provider,
        provider_user_id,
        device_type,
        display_name,
        status,
        scopes,
        last_sync_at,
        metadata,
        connected_at,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .eq('status', 'connected');

    if (error || !devices) {
      return [];
    }

    return devices.map((device) => ({
      id: device.id,
      userId: device.user_id,
      provider: device.provider || 'unknown',
      providerUserId: device.provider_user_id || '',
      deviceType: device.device_type || 'other',
      deviceName: device.display_name || 'Unknown Device',
      isActive: device.status === 'connected',
      status: device.status || 'unknown',
      scopes: Array.isArray(device.scopes) ? device.scopes : [],
      lastSyncDate: device.last_sync_at,
      metadata: device.metadata || null,
      connectedAt: device.connected_at || null,
      createdAt: device.created_at || null,
      updatedAt: device.updated_at || null
    }));
  }

  /**
   * Calculate biometric statistics from activities
   */
  private calculateBiometricStats(activities: BiometricActivity[]): {
    hrResting: number | null;
    hrMax: number | null;
    hrAvg: number | null;
    hrvAvg: number | null;
    vo2maxEstimated: number | null;
  } {
    if (activities.length === 0) {
      return {
        hrResting: null,
        hrMax: null,
        hrAvg: null,
        hrvAvg: null,
        vo2maxEstimated: null
      };
    }

    // Calculate averages from activities with data
    const activitiesWithHR = activities.filter(a => a.hrAvg !== null);
    const activitiesWithHRV = activities.filter(a => a.hrvPreActivity !== null);
    const activitiesWithVO2 = activities.filter(a => a.vo2maxEstimated !== null);

    const hrAvg = activitiesWithHR.length > 0
      ? activitiesWithHR.reduce((sum, a) => sum + (a.hrAvg || 0), 0) / activitiesWithHR.length
      : null;

    const hrMax = activitiesWithHR.length > 0
      ? Math.max(...activitiesWithHR.map(a => a.hrMax || 0))
      : null;

    const hrResting = hrAvg ? Math.round(hrAvg * 0.65) : null; // Estimation

    const hrvAvg = activitiesWithHRV.length > 0
      ? activitiesWithHRV.reduce((sum, a) => sum + (a.hrvPreActivity || 0), 0) / activitiesWithHRV.length
      : null;

    const vo2maxEstimated = activitiesWithVO2.length > 0
      ? activitiesWithVO2.reduce((sum, a) => sum + (a.vo2maxEstimated || 0), 0) / activitiesWithVO2.length
      : null;

    return {
      hrResting: hrResting ? Math.round(hrResting) : null,
      hrMax: hrMax ? Math.round(hrMax) : null,
      hrAvg: hrAvg ? Math.round(hrAvg) : null,
      hrvAvg: hrvAvg ? Math.round(hrvAvg) : null,
      vo2maxEstimated: vo2maxEstimated ? Math.round(vo2maxEstimated * 10) / 10 : null
    };
  }

  /**
   * Calculate recovery and fatigue metrics
   */
  private calculateRecoveryMetrics(activities: BiometricActivity[]): {
    recoveryScore: number;
    fatigueScore: number;
    trainingLoad7d: number;
  } {
    if (activities.length === 0) {
      return {
        recoveryScore: 50, // Neutral
        fatigueScore: 50,
        trainingLoad7d: 0
      };
    }

    // Get last 7 days activities
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7Days = activities.filter(
      a => new Date(a.timestamp) > sevenDaysAgo
    );

    // Calculate training load (sum of training load scores)
    const trainingLoad7d = last7Days.reduce(
      (sum, a) => sum + (a.trainingLoadScore || 0),
      0
    );

    // Calculate recovery score (average of recovery scores)
    const activitiesWithRecovery = last7Days.filter(a => a.recoveryScore !== null);
    const recoveryScore = activitiesWithRecovery.length > 0
      ? activitiesWithRecovery.reduce((sum, a) => sum + (a.recoveryScore || 0), 0) / activitiesWithRecovery.length
      : 50;

    // Calculate fatigue score (inverse of recovery, adjusted by training load)
    const fatigueScore = Math.min(100, Math.max(0,
      100 - recoveryScore + (trainingLoad7d / 100)
    ));

    return {
      recoveryScore: Math.round(recoveryScore),
      fatigueScore: Math.round(fatigueScore),
      trainingLoad7d: Math.round(trainingLoad7d)
    };
  }
}
