/**
 * TrainingSessionMonitor - Real-Time Training Session Tracking
 * Monitors current exercise, set, rest state, and timing during active training
 */

import logger from '../../../lib/utils/logger';
import type { TrainingSessionContext } from '../types';

interface SetMetrics {
  setNumber: number;
  reps: number | string;
  load?: number;
  rpe?: number;
  completedAt: number;
  notes?: string;
}

export class TrainingSessionMonitor {
  private sessionContext: TrainingSessionContext | null = null;
  private sessionStartTime: number = 0;
  private currentSetStartTime: number = 0;
  private restStartTime: number = 0;
  private completedSets: Map<string, SetMetrics[]> = new Map();
  private restTimerId: NodeJS.Timeout | null = null;

  /**
   * Start monitoring a training session
   */
  startSession(sessionId: string, totalExercises: number, discipline: string): void {
    this.sessionStartTime = Date.now();

    this.sessionContext = {
      sessionId,
      currentExerciseIndex: 0,
      totalExercises,
      currentSet: 0,
      totalSets: 0,
      isResting: false,
      restTimeRemaining: 0,
      discipline,
      sessionTimeElapsed: 0
    };

    this.completedSets.clear();

    logger.info('TRAINING_SESSION_MONITOR', 'Session started', {
      sessionId,
      totalExercises,
      discipline,
      timestamp: this.sessionStartTime
    });
  }

  /**
   * Start a new exercise
   */
  startExercise(
    exerciseIndex: number,
    exerciseName: string,
    load: number | undefined,
    reps: string,
    totalSets: number,
    restTime: number
  ): void {
    if (!this.sessionContext) {
      logger.warn('TRAINING_SESSION_MONITOR', 'Cannot start exercise: no active session');
      return;
    }

    this.sessionContext.currentExerciseIndex = exerciseIndex;
    this.sessionContext.totalSets = totalSets;
    this.sessionContext.currentSet = 1;
    this.sessionContext.isResting = false;
    this.sessionContext.restTimeRemaining = 0;
    this.sessionContext.currentExercise = {
      name: exerciseName,
      load,
      reps,
      sets: totalSets,
      rest: restTime
    };

    this.currentSetStartTime = Date.now();

    logger.info('TRAINING_SESSION_MONITOR', 'Exercise started', {
      exerciseIndex,
      exerciseName,
      totalSets,
      load,
      reps
    });
  }

  /**
   * Complete current set
   */
  completeSet(rpe?: number, actualReps?: number, notes?: string): void {
    if (!this.sessionContext || !this.sessionContext.currentExercise) {
      logger.warn('TRAINING_SESSION_MONITOR', 'Cannot complete set: no active exercise');
      return;
    }

    const exerciseName = this.sessionContext.currentExercise.name;
    const setMetrics: SetMetrics = {
      setNumber: this.sessionContext.currentSet,
      reps: actualReps || this.sessionContext.currentExercise.reps,
      load: this.sessionContext.currentExercise.load,
      rpe,
      completedAt: Date.now(),
      notes
    };

    // Store completed set
    if (!this.completedSets.has(exerciseName)) {
      this.completedSets.set(exerciseName, []);
    }
    this.completedSets.get(exerciseName)!.push(setMetrics);

    logger.info('TRAINING_SESSION_MONITOR', 'Set completed', {
      exercise: exerciseName,
      set: `${this.sessionContext.currentSet}/${this.sessionContext.totalSets}`,
      rpe,
      actualReps
    });

    // Move to next set or rest
    if (this.sessionContext.currentSet < this.sessionContext.totalSets) {
      this.startRest(this.sessionContext.currentExercise.rest);
    } else {
      // Exercise complete
      logger.info('TRAINING_SESSION_MONITOR', 'Exercise completed', {
        exercise: exerciseName,
        totalSets: this.sessionContext.totalSets
      });
    }
  }

  /**
   * Start rest period
   */
  startRest(restDuration: number): void {
    if (!this.sessionContext) {
      return;
    }

    this.sessionContext.isResting = true;
    this.sessionContext.restTimeRemaining = restDuration;
    this.restStartTime = Date.now();

    // Clear any existing timer
    if (this.restTimerId) {
      clearInterval(this.restTimerId);
    }

    // Update rest time every second
    this.restTimerId = setInterval(() => {
      if (!this.sessionContext) {
        this.clearRestTimer();
        return;
      }

      const elapsed = Math.floor((Date.now() - this.restStartTime) / 1000);
      this.sessionContext.restTimeRemaining = Math.max(0, restDuration - elapsed);

      if (this.sessionContext.restTimeRemaining === 0) {
        this.endRest();
      }
    }, 1000);

    logger.debug('TRAINING_SESSION_MONITOR', 'Rest started', {
      duration: restDuration,
      timestamp: this.restStartTime
    });
  }

  /**
   * End rest period (automatically or manually)
   */
  endRest(): void {
    if (!this.sessionContext) {
      return;
    }

    this.clearRestTimer();

    this.sessionContext.isResting = false;
    this.sessionContext.restTimeRemaining = 0;
    this.sessionContext.currentSet += 1;
    this.currentSetStartTime = Date.now();

    logger.debug('TRAINING_SESSION_MONITOR', 'Rest ended', {
      nextSet: this.sessionContext.currentSet
    });
  }

  /**
   * Skip rest period
   */
  skipRest(): void {
    this.endRest();
  }

  /**
   * Update session elapsed time
   */
  private updateSessionTime(): void {
    if (!this.sessionContext || !this.sessionStartTime) {
      return;
    }

    this.sessionContext.sessionTimeElapsed = Math.floor(
      (Date.now() - this.sessionStartTime) / 1000
    );
  }

  /**
   * Get current session context
   */
  getContext(): TrainingSessionContext | null {
    if (!this.sessionContext) {
      return null;
    }

    this.updateSessionTime();
    return { ...this.sessionContext };
  }

  /**
   * Get completed sets for exercise
   */
  getCompletedSets(exerciseName: string): SetMetrics[] {
    return this.completedSets.get(exerciseName) || [];
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    if (!this.sessionContext) {
      return null;
    }

    const totalSetsCompleted = Array.from(this.completedSets.values())
      .reduce((sum, sets) => sum + sets.length, 0);

    return {
      sessionId: this.sessionContext.sessionId,
      discipline: this.sessionContext.discipline,
      currentExercise: this.sessionContext.currentExerciseIndex + 1,
      totalExercises: this.sessionContext.totalExercises,
      totalSetsCompleted,
      sessionDuration: this.sessionContext.sessionTimeElapsed,
      exercisesCompleted: this.completedSets.size,
      isActive: true
    };
  }

  /**
   * Check if currently in active set (not resting)
   */
  isActiveSet(): boolean {
    return this.sessionContext !== null && !this.sessionContext.isResting;
  }

  /**
   * Check if currently resting
   */
  isResting(): boolean {
    return this.sessionContext !== null && this.sessionContext.isResting;
  }

  /**
   * End current session
   */
  endSession(): void {
    if (!this.sessionContext) {
      return;
    }

    this.clearRestTimer();

    const summary = this.getSessionSummary();

    logger.info('TRAINING_SESSION_MONITOR', 'Session ended', {
      summary,
      timestamp: Date.now()
    });

    this.sessionContext = null;
    this.sessionStartTime = 0;
    this.completedSets.clear();
  }

  /**
   * Clear rest timer
   */
  private clearRestTimer(): void {
    if (this.restTimerId) {
      clearInterval(this.restTimerId);
      this.restTimerId = null;
    }
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.sessionContext !== null;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.clearRestTimer();
    this.sessionContext = null;
    this.completedSets.clear();
  }
}
