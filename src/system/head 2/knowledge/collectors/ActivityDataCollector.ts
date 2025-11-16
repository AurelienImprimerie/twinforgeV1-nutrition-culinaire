/**
 * ActivityDataCollector - Collect all activity data for user
 * Aggregates physical activities with wearable enrichment
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { ActivityKnowledge, ActivitySummary } from '../../types';

export class ActivityDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<ActivityKnowledge> {
    try {
      logger.info('ACTIVITY_DATA_COLLECTOR', 'Starting activity data collection', { userId });

      const [recentActivities, wearableDevices, activityStats] = await Promise.all([
        this.collectRecentActivities(userId),
        this.getConnectedWearableDevices(userId),
        this.calculateActivityStats(userId)
      ]);

      const lastActivityDate = recentActivities.length > 0 ? recentActivities[0].timestamp : null;
      const hasData = recentActivities.length > 0;

      logger.info('ACTIVITY_DATA_COLLECTOR', 'Activity data collected', {
        userId,
        activitiesCount: recentActivities.length,
        wearableDevicesCount: wearableDevices.length,
        hasData
      });

      return {
        recentActivities,
        wearableDevices,
        stats: activityStats,
        lastActivityDate,
        hasData
      };
    } catch (error) {
      logger.error('ACTIVITY_DATA_COLLECTOR', 'Failed to collect activity data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect recent activities (last 30 days) with all wearable data
   */
  private async collectRecentActivities(userId: string): Promise<ActivitySummary[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities, error } = await this.supabase
      .from('activities')
      .select(`
        id, timestamp, type, duration_min, calories_est, notes, created_at,
        intensity, hr_avg, hr_max, hr_min, hr_resting_pre, hr_recovery_1min,
        hr_zone1_minutes, hr_zone2_minutes, hr_zone3_minutes, hr_zone4_minutes, hr_zone5_minutes,
        hrv_pre_activity, hrv_post_activity, hrv_avg_overnight,
        vo2max_estimated, training_load_score, efficiency_score, fatigue_index,
        distance_meters, avg_pace, avg_speed_kmh,
        elevation_gain_meters, elevation_loss_meters,
        avg_cadence_rpm, max_cadence_rpm, avg_power_watts, max_power_watts, normalized_power,
        sleep_quality_score, sleep_duration_hours, recovery_score,
        stress_level_pre, body_battery_pre,
        wearable_device_id, wearable_activity_id, wearable_synced_at, wearable_raw_data,
        data_completeness_score, gps_accuracy_meters, sensor_quality_score
      `)
      .eq('user_id', userId)
      .gte('timestamp', thirtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('ACTIVITY_DATA_COLLECTOR', 'Failed to load activities', { userId, error });
      return [];
    }

    if (!activities || activities.length === 0) {
      return [];
    }

    return activities.map((activity) => {
      const wearableRawData = activity.wearable_raw_data as any || {};
      const hasWearableData = !!activity.wearable_device_id;

      return {
        id: activity.id,
        timestamp: activity.timestamp,
        createdAt: activity.created_at,
        type: activity.type,
        duration: activity.duration_min,
        calories: activity.calories_est,
        notes: activity.notes,
        intensity: activity.intensity,
        heartRate: {
          avg: activity.hr_avg,
          max: activity.hr_max,
          min: activity.hr_min,
          restingPre: activity.hr_resting_pre,
          recovery1min: activity.hr_recovery_1min,
          zones: {
            zone1Minutes: activity.hr_zone1_minutes,
            zone2Minutes: activity.hr_zone2_minutes,
            zone3Minutes: activity.hr_zone3_minutes,
            zone4Minutes: activity.hr_zone4_minutes,
            zone5Minutes: activity.hr_zone5_minutes
          }
        },
        hrv: {
          preActivity: activity.hrv_pre_activity,
          postActivity: activity.hrv_post_activity,
          avgOvernight: activity.hrv_avg_overnight
        },
        performance: {
          vo2max: activity.vo2max_estimated,
          trainingLoad: activity.training_load_score,
          efficiency: activity.efficiency_score,
          fatigue: activity.fatigue_index
        },
        movement: {
          distance: activity.distance_meters,
          avgPace: activity.avg_pace,
          avgSpeed: activity.avg_speed_kmh,
          elevationGain: activity.elevation_gain_meters,
          elevationLoss: activity.elevation_loss_meters
        },
        power: {
          avgCadence: activity.avg_cadence_rpm,
          maxCadence: activity.max_cadence_rpm,
          avgPower: activity.avg_power_watts,
          maxPower: activity.max_power_watts,
          normalizedPower: activity.normalized_power
        },
        recovery: {
          sleepQuality: activity.sleep_quality_score,
          sleepDuration: activity.sleep_duration_hours,
          recoveryScore: activity.recovery_score,
          stressLevel: activity.stress_level_pre,
          bodyBattery: activity.body_battery_pre
        },
        wearable: {
          hasData: hasWearableData,
          deviceId: activity.wearable_device_id,
          activityId: activity.wearable_activity_id,
          syncedAt: activity.wearable_synced_at,
          rawData: wearableRawData
        },
        dataQuality: {
          completeness: activity.data_completeness_score || this.calculateActivityDataCompleteness(activity),
          gpsAccuracy: activity.gps_accuracy_meters,
          sensorQuality: activity.sensor_quality_score
        }
      };
    });
  }

  /**
   * Get connected wearable devices
   */
  private async getConnectedWearableDevices(userId: string): Promise<any[]> {
    const { data: devices, error } = await this.supabase
      .from('connected_devices')
      .select('id, provider, display_name, status, last_sync_at, device_type, scopes')
      .eq('user_id', userId)
      .eq('status', 'connected');

    if (error) {
      logger.error('ACTIVITY_DATA_COLLECTOR', 'Failed to load wearable devices', { userId, error });
      return [];
    }

    return devices || [];
  }

  /**
   * Calculate aggregate activity stats
   */
  private async calculateActivityStats(userId: string): Promise<{
    totalActivities: number;
    totalDuration: number;
    totalCalories: number;
    totalDistance: number;
    avgHeartRate: number;
    avgIntensity: string;
    wearableEnrichedCount: number;
    wearableEnrichmentRate: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities } = await this.supabase
      .from('activities')
      .select('duration_min, calories_est, distance_meters, hr_avg, intensity, wearable_device_id')
      .eq('user_id', userId)
      .gte('timestamp', thirtyDaysAgo.toISOString());

    if (!activities || activities.length === 0) {
      return {
        totalActivities: 0,
        totalDuration: 0,
        totalCalories: 0,
        totalDistance: 0,
        avgHeartRate: 0,
        avgIntensity: 'unknown',
        wearableEnrichedCount: 0,
        wearableEnrichmentRate: 0
      };
    }

    const totalDuration = activities.reduce((sum, a) => sum + (a.duration_min || 0), 0);
    const totalCalories = activities.reduce((sum, a) => sum + (a.calories_est || 0), 0);
    const totalDistance = activities.reduce((sum, a) => sum + (a.distance_meters || 0), 0);

    const hrActivities = activities.filter(a => a.hr_avg);
    const avgHeartRate = hrActivities.length > 0
      ? hrActivities.reduce((sum, a) => sum + (a.hr_avg || 0), 0) / hrActivities.length
      : 0;

    const intensityCounts: Record<string, number> = {};
    activities.forEach(a => {
      if (a.intensity) {
        intensityCounts[a.intensity] = (intensityCounts[a.intensity] || 0) + 1;
      }
    });
    const avgIntensity = Object.keys(intensityCounts).length > 0
      ? Object.entries(intensityCounts).sort((a, b) => b[1] - a[1])[0][0]
      : 'unknown';

    const wearableEnrichedCount = activities.filter(a => a.wearable_device_id).length;
    const wearableEnrichmentRate = Math.round((wearableEnrichedCount / activities.length) * 100);

    return {
      totalActivities: activities.length,
      totalDuration,
      totalCalories,
      totalDistance,
      avgHeartRate: Math.round(avgHeartRate),
      avgIntensity,
      wearableEnrichedCount,
      wearableEnrichmentRate
    };
  }

  /**
   * Calculate activity data completeness score
   */
  private calculateActivityDataCompleteness(activity: any): number {
    let score = 0;
    let maxScore = 20;

    if (activity.type) score++;
    if (activity.duration_min) score++;
    if (activity.calories_est) score++;
    if (activity.intensity) score++;
    if (activity.hr_avg) score++;
    if (activity.hr_max) score++;
    if (activity.hr_zone1_minutes !== null) score++;
    if (activity.hrv_pre_activity) score++;
    if (activity.vo2max_estimated) score++;
    if (activity.training_load_score) score++;
    if (activity.distance_meters) score++;
    if (activity.avg_speed_kmh) score++;
    if (activity.elevation_gain_meters !== null) score++;
    if (activity.avg_cadence_rpm) score++;
    if (activity.avg_power_watts) score++;
    if (activity.recovery_score) score++;
    if (activity.sleep_quality_score) score++;
    if (activity.wearable_device_id) score += 2;
    if (activity.wearable_raw_data) score++;

    return Math.round((score / maxScore) * 100);
  }
}
