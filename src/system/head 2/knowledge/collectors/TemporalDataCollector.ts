/**
 * TemporalDataCollector - Collect temporal and scheduling data
 * Analyzes training patterns, availability, and optimal timing
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { TemporalKnowledge, TrainingPattern, AvailabilityWindow } from '../../types';

export class TemporalDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<TemporalKnowledge> {
    try {
      logger.info('TEMPORAL_DATA_COLLECTOR', 'Starting temporal data collection', { userId });

      const [sessionsResult, profileResult] = await Promise.allSettled([
        this.collectTrainingSessions(userId),
        this.getUserProfile(userId)
      ]);

      const sessions = sessionsResult.status === 'fulfilled' ? sessionsResult.value : [];
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;

      // Analyze training patterns
      const patterns = this.analyzeTrainingPatterns(sessions);

      // Extract availability windows from profile or infer from patterns
      const availabilityWindows = this.extractAvailabilityWindows(profile, patterns);

      // Calculate optimal training times
      const optimalTrainingTimes = this.calculateOptimalTimes(patterns);

      // Analyze rest day patterns
      const restDayPatterns = this.analyzeRestDayPatterns(sessions);

      const hasData = sessions.length > 0 || availabilityWindows.length > 0;

      logger.info('TEMPORAL_DATA_COLLECTOR', 'Temporal data collected', {
        userId,
        sessionsCount: sessions.length,
        patternsCount: patterns.length,
        availabilityWindowsCount: availabilityWindows.length,
        hasData
      });

      return {
        trainingPatterns: patterns,
        availabilityWindows,
        optimalTrainingTimes,
        restDayPatterns,
        weeklyFrequency: this.calculateWeeklyFrequency(sessions),
        preferredTimeOfDay: this.getPreferredTimeOfDay(sessions),
        averageSessionDuration: this.getAverageSessionDuration(sessions),
        consistencyScore: this.calculateConsistencyScore(sessions),
        hasData
      };
    } catch (error) {
      logger.error('TEMPORAL_DATA_COLLECTOR', 'Failed to collect temporal data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect training sessions for pattern analysis (last 90 days)
   */
  private async collectTrainingSessions(userId: string): Promise<Array<{
    id: string;
    timestamp: string;
    discipline: string;
    duration: number;
    dayOfWeek: number;
    hourOfDay: number;
    completed: boolean;
  }>> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: sessions, error } = await this.supabase
      .from('training_sessions')
      .select('id, completed_at, started_at, discipline, duration_actual_min, status')
      .eq('user_id', userId)
      .gte('completed_at', ninetyDaysAgo.toISOString())
      .order('completed_at', { ascending: false });

    if (error || !sessions) {
      return [];
    }

    return sessions.map((session) => {
      // Use completed_at if available, otherwise started_at
      const timestamp = session.completed_at || session.started_at;
      if (!timestamp) return null;

      const date = new Date(timestamp);
      return {
        id: session.id,
        timestamp: timestamp,
        discipline: session.discipline || 'unknown',
        duration: session.duration_actual_min || 0,
        dayOfWeek: date.getDay(), // 0 = Sunday, 6 = Saturday
        hourOfDay: date.getHours(),
        completed: session.status === 'completed'
      };
    }).filter((session): session is NonNullable<typeof session> => session !== null);
  }

  /**
   * Get user profile for availability info
   */
  private async getUserProfile(userId: string): Promise<any> {
    const { data: profile } = await this.supabase
      .from('user_profile')
      .select('job_category')
      .eq('user_id', userId)
      .maybeSingle();

    return profile;
  }

  /**
   * Analyze training patterns
   */
  private analyzeTrainingPatterns(sessions: Array<{
    dayOfWeek: number;
    hourOfDay: number;
    discipline: string;
    completed: boolean;
  }>): TrainingPattern[] {
    if (sessions.length === 0) {
      return [];
    }

    // Group by day of week and time of day
    const patterns: Map<string, {
      dayOfWeek: number;
      timeOfDay: 'morning' | 'afternoon' | 'evening';
      frequency: number;
      discipline: string;
      completionRate: number;
    }> = new Map();

    sessions.forEach((session) => {
      const timeOfDay = this.getTimeOfDayCategory(session.hourOfDay);
      const key = `${session.dayOfWeek}-${timeOfDay}`;

      if (!patterns.has(key)) {
        patterns.set(key, {
          dayOfWeek: session.dayOfWeek,
          timeOfDay,
          frequency: 0,
          discipline: session.discipline,
          completionRate: 0
        });
      }

      const pattern = patterns.get(key)!;
      pattern.frequency += 1;
      if (session.completed) {
        pattern.completionRate += 1;
      }
    });

    // Calculate completion rate percentage
    const result: TrainingPattern[] = Array.from(patterns.values()).map(pattern => ({
      ...pattern,
      completionRate: Math.round((pattern.completionRate / pattern.frequency) * 100)
    }));

    // Sort by frequency
    return result.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extract availability windows
   */
  private extractAvailabilityWindows(
    profile: any,
    patterns: TrainingPattern[]
  ): AvailabilityWindow[] {
    // Note: availability_windows column does not exist in user_profile yet
    // We always infer from training patterns
    const windows: AvailabilityWindow[] = [];

    // Group patterns by day of week
    const dayPatterns = new Map<number, TrainingPattern[]>();
    patterns.forEach(pattern => {
      if (!dayPatterns.has(pattern.dayOfWeek)) {
        dayPatterns.set(pattern.dayOfWeek, []);
      }
      dayPatterns.get(pattern.dayOfWeek)!.push(pattern);
    });

    // Create availability windows from patterns
    dayPatterns.forEach((patternsForDay, dayOfWeek) => {
      patternsForDay.forEach(pattern => {
        const { startHour, endHour } = this.getTimeRange(pattern.timeOfDay);
        windows.push({
          dayOfWeek,
          startHour,
          endHour,
          label: `${this.getDayName(dayOfWeek)} ${pattern.timeOfDay}`,
          isPreferred: pattern.frequency >= 3 // Considered preferred if done 3+ times
        });
      });
    });

    return windows;
  }

  /**
   * Calculate optimal training times based on patterns
   */
  private calculateOptimalTimes(patterns: TrainingPattern[]): Array<{
    dayOfWeek: number;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
    score: number;
  }> {
    return patterns.map(pattern => ({
      dayOfWeek: pattern.dayOfWeek,
      timeOfDay: pattern.timeOfDay,
      score: Math.round(
        (pattern.frequency * 10) + // Frequency weight
        (pattern.completionRate * 0.5) // Completion weight
      )
    })).sort((a, b) => b.score - a.score).slice(0, 5); // Top 5
  }

  /**
   * Analyze rest day patterns
   */
  private analyzeRestDayPatterns(sessions: Array<{
    timestamp: string;
    dayOfWeek: number;
  }>): {
    preferredRestDays: number[];
    averageRestDaysBetweenSessions: number;
  } {
    if (sessions.length < 2) {
      return {
        preferredRestDays: [],
        averageRestDaysBetweenSessions: 0
      };
    }

    // Count sessions per day of week
    const sessionsByDay = new Map<number, number>();
    for (let i = 0; i < 7; i++) {
      sessionsByDay.set(i, 0);
    }

    sessions.forEach(session => {
      const count = sessionsByDay.get(session.dayOfWeek) || 0;
      sessionsByDay.set(session.dayOfWeek, count + 1);
    });

    // Find days with least activity (rest days)
    const sortedDays = Array.from(sessionsByDay.entries())
      .sort((a, b) => a[1] - b[1]);
    const preferredRestDays = sortedDays.slice(0, 2).map(([day]) => day);

    // Calculate average days between sessions
    let totalDaysBetween = 0;
    for (let i = 0; i < sessions.length - 1; i++) {
      const date1 = new Date(sessions[i].timestamp);
      const date2 = new Date(sessions[i + 1].timestamp);
      const daysBetween = Math.abs(
        Math.floor((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
      );
      totalDaysBetween += daysBetween;
    }

    const averageRestDaysBetweenSessions = Math.round(
      totalDaysBetween / (sessions.length - 1)
    );

    return {
      preferredRestDays,
      averageRestDaysBetweenSessions
    };
  }

  /**
   * Calculate weekly frequency
   */
  private calculateWeeklyFrequency(sessions: Array<{ timestamp: string }>): number {
    if (sessions.length === 0) return 0;

    const last30Days = sessions.filter(s => {
      const sessionDate = new Date(s.timestamp);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return sessionDate > thirtyDaysAgo;
    });

    return Math.round((last30Days.length / 30) * 7);
  }

  /**
   * Get preferred time of day
   */
  private getPreferredTimeOfDay(sessions: Array<{ hourOfDay: number }>): 'morning' | 'afternoon' | 'evening' | null {
    if (sessions.length === 0) return null;

    const timeSlots = { morning: 0, afternoon: 0, evening: 0 };

    sessions.forEach(session => {
      const timeOfDay = this.getTimeOfDayCategory(session.hourOfDay);
      timeSlots[timeOfDay]++;
    });

    const preferred = Object.entries(timeSlots)
      .sort((a, b) => b[1] - a[1])[0];

    return preferred[0] as 'morning' | 'afternoon' | 'evening';
  }

  /**
   * Get average session duration
   */
  private getAverageSessionDuration(sessions: Array<{ duration: number }>): number {
    if (sessions.length === 0) return 0;

    const total = sessions.reduce((sum, s) => sum + s.duration, 0);
    return Math.round(total / sessions.length);
  }

  /**
   * Calculate consistency score (0-100)
   */
  private calculateConsistencyScore(sessions: Array<{ timestamp: string; completed: boolean }>): number {
    if (sessions.length === 0) return 0;

    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSessions = sessions.filter(s => new Date(s.timestamp) > thirtyDaysAgo);

    if (recentSessions.length === 0) return 0;

    // Factors: frequency, completion rate, regularity
    const frequency = Math.min(100, (recentSessions.length / 30) * 100); // Max at 1 session per day
    const completionRate = (recentSessions.filter(s => s.completed).length / recentSessions.length) * 100;

    // Calculate regularity (standard deviation of days between sessions)
    const daysBetween: number[] = [];
    for (let i = 0; i < recentSessions.length - 1; i++) {
      const date1 = new Date(recentSessions[i].timestamp);
      const date2 = new Date(recentSessions[i + 1].timestamp);
      const days = Math.abs(
        Math.floor((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
      );
      daysBetween.push(days);
    }

    const avgDaysBetween = daysBetween.length > 0
      ? daysBetween.reduce((sum, d) => sum + d, 0) / daysBetween.length
      : 0;

    const variance = daysBetween.length > 0
      ? daysBetween.reduce((sum, d) => sum + Math.pow(d - avgDaysBetween, 2), 0) / daysBetween.length
      : 0;

    const stdDev = Math.sqrt(variance);
    const regularityScore = Math.max(0, 100 - (stdDev * 10)); // Lower std dev = higher score

    // Weighted average
    const consistencyScore = (frequency * 0.4) + (completionRate * 0.3) + (regularityScore * 0.3);

    return Math.round(consistencyScore);
  }

  /**
   * Helper: Get time of day category
   */
  private getTimeOfDayCategory(hour: number): 'morning' | 'afternoon' | 'evening' {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * Helper: Get time range for category
   */
  private getTimeRange(timeOfDay: 'morning' | 'afternoon' | 'evening'): { startHour: number; endHour: number } {
    switch (timeOfDay) {
      case 'morning':
        return { startHour: 5, endHour: 12 };
      case 'afternoon':
        return { startHour: 12, endHour: 17 };
      case 'evening':
        return { startHour: 17, endHour: 23 };
    }
  }

  /**
   * Helper: Get day name
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayOfWeek];
  }
}
