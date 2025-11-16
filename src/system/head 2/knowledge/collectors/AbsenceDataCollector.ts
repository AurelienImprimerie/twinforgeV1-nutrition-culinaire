/**
 * AbsenceDataCollector - Collect absence and reconciliation data for HEAD system
 * Provides context about user absences, pending points, and recovery status
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';

export interface AbsenceKnowledge {
  hasActiveAbsence: boolean;
  currentAbsence: {
    daysAbsent: number;
    startDate: string;
    status: string;
    estimatedXp: number;
  } | null;

  pendingRewards: {
    totalPendingXp: number;
    rewardsCount: number;
    oldestRewardDate: string | null;
    expiringRewardsCount: number; // Rewards expiring in next 7 days
  };

  recentReconciliation: {
    hasRecent: boolean;
    reconciliationDate: string | null;
    weightDelta: number;
    awardedXp: number;
    coherenceScore: number;
    wasPositiveProgress: boolean;
  } | null;

  absenceHistory: {
    totalAbsences90Days: number;
    averageAbsenceDuration: number;
    longestAbsence: number;
    lastAbsenceDate: string | null;
  };

  recoveryStatus: {
    needsWeightUpdate: boolean;
    needsBodyScan: boolean;
    needsAvatarUpdate: boolean;
    daysSinceLastWeight: number;
    daysSinceLastScan: number | null;
  };

  hasData: boolean;
}

export class AbsenceDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<AbsenceKnowledge> {
    try {
      logger.info('ABSENCE_COLLECTOR', 'Starting absence data collection', { userId });

      const [
        activeAbsence,
        pendingRewards,
        recentReconciliation,
        absenceHistory,
        recoveryStatus
      ] = await Promise.allSettled([
        this.getActiveAbsence(userId),
        this.getPendingRewards(userId),
        this.getRecentReconciliation(userId),
        this.getAbsenceHistory(userId),
        this.getRecoveryStatus(userId)
      ]);

      const absence = activeAbsence.status === 'fulfilled' ? activeAbsence.value : null;
      const pending = pendingRewards.status === 'fulfilled' ? pendingRewards.value : this.getDefaultPendingRewards();
      const reconciliation = recentReconciliation.status === 'fulfilled' ? recentReconciliation.value : null;
      const history = absenceHistory.status === 'fulfilled' ? absenceHistory.value : this.getDefaultHistory();
      const recovery = recoveryStatus.status === 'fulfilled' ? recoveryStatus.value : this.getDefaultRecoveryStatus();

      const hasData = !!absence || pending.totalPendingXp > 0 || !!reconciliation || history.totalAbsences90Days > 0;

      logger.info('ABSENCE_COLLECTOR', 'Absence data collected', {
        userId,
        hasActiveAbsence: !!absence,
        pendingXp: pending.totalPendingXp,
        hasRecentReconciliation: reconciliation?.hasRecent || false,
        hasData
      });

      return {
        hasActiveAbsence: !!absence,
        currentAbsence: absence,
        pendingRewards: pending,
        recentReconciliation: reconciliation,
        absenceHistory: history,
        recoveryStatus: recovery,
        hasData
      };
    } catch (error) {
      logger.error('ABSENCE_COLLECTOR', 'Failed to collect absence data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.getDefaultAbsenceKnowledge();
    }
  }

  /**
   * Get active absence for user
   */
  private async getActiveAbsence(userId: string) {
    const { data, error } = await this.supabase
      .from('absence_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('absence_start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    const daysAbsent = Math.floor(
      (Date.now() - new Date(data.absence_start_date).getTime()) / (24 * 60 * 60 * 1000)
    );

    const estimatedXp = data.estimated_activity_data?.total_estimated_xp || 0;

    return {
      daysAbsent,
      startDate: data.absence_start_date,
      status: data.status,
      estimatedXp
    };
  }

  /**
   * Get pending points rewards
   */
  private async getPendingRewards(userId: string) {
    const { data: rewards, error } = await this.supabase
      .from('pending_xp_rewards')
      .select('final_xp, created_at, expires_at')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;

    if (!rewards || rewards.length === 0) {
      return this.getDefaultPendingRewards();
    }

    const totalPendingXp = rewards.reduce((sum, r) => sum + r.final_xp, 0);
    const oldestReward = rewards.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];

    // Count rewards expiring in next 7 days
    const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiringRewardsCount = rewards.filter(
      r => new Date(r.expires_at).getTime() <= sevenDaysFromNow
    ).length;

    return {
      totalPendingXp,
      rewardsCount: rewards.length,
      oldestRewardDate: oldestReward.created_at,
      expiringRewardsCount
    };
  }

  /**
   * Get recent reconciliation (last 7 days)
   */
  private async getRecentReconciliation(userId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('absence_reconciliations')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        hasRecent: false,
        reconciliationDate: null,
        weightDelta: 0,
        awardedXp: 0,
        coherenceScore: 0,
        wasPositiveProgress: false
      };
    }

    return {
      hasRecent: true,
      reconciliationDate: data.created_at,
      weightDelta: data.weight_delta_kg || 0,
      awardedXp: data.total_awarded_xp + (data.bonus_xp || 0),
      coherenceScore: data.coherence_score || 0,
      wasPositiveProgress: data.is_positive_progress || false
    };
  }

  /**
   * Get absence history (last 90 days)
   */
  private async getAbsenceHistory(userId: string) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: absences, error } = await this.supabase
      .from('absence_logs')
      .select('days_absent, detected_at')
      .eq('user_id', userId)
      .gte('detected_at', ninetyDaysAgo)
      .order('detected_at', { ascending: false });

    if (error) throw error;

    if (!absences || absences.length === 0) {
      return this.getDefaultHistory();
    }

    const totalAbsences = absences.length;
    const averageDuration = absences.reduce((sum, a) => sum + a.days_absent, 0) / totalAbsences;
    const longestAbsence = Math.max(...absences.map(a => a.days_absent));
    const lastAbsenceDate = absences[0].detected_at;

    return {
      totalAbsences90Days: totalAbsences,
      averageAbsenceDuration: Math.round(averageDuration),
      longestAbsence,
      lastAbsenceDate
    };
  }

  /**
   * Get recovery status
   */
  private async getRecoveryStatus(userId: string) {
    // Get last weight update
    const { data: profile } = await this.supabase
      .from('user_profile')
      .select('updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    const daysSinceLastWeight = profile
      ? Math.floor((Date.now() - new Date(profile.updated_at).getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    // Get last body scan
    const { data: lastScan } = await this.supabase
      .from('body_scans')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const daysSinceLastScan = lastScan
      ? Math.floor((Date.now() - new Date(lastScan.created_at).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      needsWeightUpdate: daysSinceLastWeight >= 3,
      needsBodyScan: !daysSinceLastScan || daysSinceLastScan >= 30,
      needsAvatarUpdate: false, // Can be enhanced with avatar tracking
      daysSinceLastWeight,
      daysSinceLastScan
    };
  }

  /**
   * Default values for pending rewards
   */
  private getDefaultPendingRewards() {
    return {
      totalPendingXp: 0,
      rewardsCount: 0,
      oldestRewardDate: null,
      expiringRewardsCount: 0
    };
  }

  /**
   * Default values for absence history
   */
  private getDefaultHistory() {
    return {
      totalAbsences90Days: 0,
      averageAbsenceDuration: 0,
      longestAbsence: 0,
      lastAbsenceDate: null
    };
  }

  /**
   * Default values for recovery status
   */
  private getDefaultRecoveryStatus() {
    return {
      needsWeightUpdate: false,
      needsBodyScan: false,
      needsAvatarUpdate: false,
      daysSinceLastWeight: 0,
      daysSinceLastScan: null
    };
  }

  /**
   * Default absence knowledge
   */
  private getDefaultAbsenceKnowledge(): AbsenceKnowledge {
    return {
      hasActiveAbsence: false,
      currentAbsence: null,
      pendingRewards: this.getDefaultPendingRewards(),
      recentReconciliation: {
        hasRecent: false,
        reconciliationDate: null,
        weightDelta: 0,
        awardedXp: 0,
        coherenceScore: 0,
        wasPositiveProgress: false
      },
      absenceHistory: this.getDefaultHistory(),
      recoveryStatus: this.getDefaultRecoveryStatus(),
      hasData: false
    };
  }
}
