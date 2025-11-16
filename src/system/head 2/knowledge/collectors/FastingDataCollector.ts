/**
 * FastingDataCollector - Collect all fasting data for user
 * Aggregates fasting sessions, protocols, and statistics
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { FastingKnowledge, FastingSessionSummary } from '../../types';

export class FastingDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<FastingKnowledge> {
    try {
      logger.info('FASTING_DATA_COLLECTOR', 'Starting fasting data collection', { userId });

      const [sessionsResult, currentSessionResult] = await Promise.allSettled([
        this.collectRecentSessions(userId),
        this.getCurrentSession(userId)
      ]);

      const recentSessions =
        sessionsResult.status === 'fulfilled' ? sessionsResult.value : [];
      const currentSession =
        currentSessionResult.status === 'fulfilled' ? currentSessionResult.value : null;

      // Calculate statistics
      const completedSessions = recentSessions.filter((s) => s.status === 'completed');
      const totalSessionsCompleted = completedSessions.length;
      const averageFastingDuration =
        completedSessions.length > 0
          ? completedSessions.reduce((sum, s) => sum + (s.actualDuration || 0), 0) /
            completedSessions.length
          : 0;

      // Find most common protocol
      const protocolCounts: Record<string, number> = {};
      completedSessions.forEach((session) => {
        protocolCounts[session.protocol] = (protocolCounts[session.protocol] || 0) + 1;
      });
      const preferredProtocol =
        Object.keys(protocolCounts).length > 0
          ? Object.entries(protocolCounts).sort((a, b) => b[1] - a[1])[0][0]
          : null;

      const lastSessionDate =
        recentSessions.length > 0 ? recentSessions[0].startTime : null;
      const hasData = recentSessions.length > 0 || !!currentSession;

      logger.info('FASTING_DATA_COLLECTOR', 'Fasting data collected', {
        userId,
        sessionsCount: recentSessions.length,
        currentSession: !!currentSession,
        totalCompleted: totalSessionsCompleted,
        avgDuration: averageFastingDuration,
        hasData
      });

      return {
        recentSessions,
        currentSession,
        averageFastingDuration: Math.round(averageFastingDuration),
        totalSessionsCompleted,
        preferredProtocol,
        lastSessionDate,
        hasData
      };
    } catch (error) {
      logger.error('FASTING_DATA_COLLECTOR', 'Failed to collect fasting data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect recent fasting sessions (last 60 days)
   */
  private async collectRecentSessions(userId: string): Promise<FastingSessionSummary[]> {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: sessions, error } = await this.supabase
      .from('fasting_sessions')
      .select(`
        id, start_time, end_time, target_hours, actual_duration_hours,
        protocol_id, status, outcome_quality, metabolic_phase_reached,
        is_scientifically_valid, completion_percentage, notes, created_at
      `)
      .eq('user_id', userId)
      .gte('start_time', sixtyDaysAgo.toISOString())
      .order('start_time', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('FASTING_DATA_COLLECTOR', 'Failed to load fasting sessions', {
        userId,
        error
      });
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    return sessions.map((session) => {
      const actualDuration = session.actual_duration_hours || null;
      const targetDuration = session.target_hours || 0;
      const completion = actualDuration && targetDuration
        ? Math.round((actualDuration / targetDuration) * 100)
        : session.completion_percentage || null;

      return {
        id: session.id,
        startTime: session.start_time,
        endTime: session.end_time,
        createdAt: session.created_at,
        targetDuration,
        actualDuration,
        protocol: session.protocol_id || 'custom',
        status: session.status as 'in_progress' | 'completed' | 'cancelled',
        quality: session.outcome_quality || null,
        metabolicPhase: session.metabolic_phase_reached || null,
        isScientificallyValid: session.is_scientifically_valid || false,
        completionPercentage: completion,
        notes: session.notes || null,
        dataCompleteness: this.calculateSessionCompleteness(session)
      };
    });
  }

  /**
   * Get current active fasting session
   */
  private async getCurrentSession(userId: string): Promise<FastingSessionSummary | null> {
    const { data: session, error } = await this.supabase
      .from('fasting_sessions')
      .select(`
        id, start_time, end_time, target_hours, actual_duration_hours,
        protocol_id, status, notes, created_at
      `)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !session) {
      return null;
    }

    const startTime = new Date(session.start_time);
    const now = new Date();
    const currentDuration = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const targetDuration = session.target_hours || 0;
    const completion = targetDuration > 0
      ? Math.round((currentDuration / targetDuration) * 100)
      : 0;

    return {
      id: session.id,
      startTime: session.start_time,
      endTime: session.end_time,
      createdAt: session.created_at,
      targetDuration,
      actualDuration: Math.round(currentDuration * 10) / 10,
      protocol: session.protocol_id || 'custom',
      status: 'in_progress',
      quality: null,
      metabolicPhase: null,
      isScientificallyValid: false,
      completionPercentage: completion,
      notes: session.notes || null,
      dataCompleteness: 50
    };
  }

  /**
   * Calculate session data completeness score
   */
  private calculateSessionCompleteness(session: any): number {
    let score = 0;
    let maxScore = 8;

    if (session.start_time) score++;
    if (session.end_time) score++;
    if (session.actual_duration_hours) score++;
    if (session.outcome_quality) score++;
    if (session.metabolic_phase_reached) score++;
    if (session.is_scientifically_valid !== null) score++;
    if (session.completion_percentage) score++;
    if (session.notes) score++;

    return Math.round((score / maxScore) * 100);
  }
}
