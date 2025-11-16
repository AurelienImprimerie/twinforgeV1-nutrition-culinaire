/**
 * ActivityStateManager - Application Activity State Management
 * Manages different activity states: idle, navigation, training, scanning, etc.
 */

import logger from '../../../lib/utils/logger';
import type { ActivityState } from '../types';

export type ActivityTransition = {
  from: ActivityState;
  to: ActivityState;
  timestamp: number;
  trigger: string;
};

export class ActivityStateManager {
  private currentState: ActivityState = 'idle';
  private stateHistory: ActivityTransition[] = [];
  private stateChangeListeners: Array<(state: ActivityState, previous: ActivityState) => void> = [];
  private stateStartTime: number = Date.now();
  private readonly MAX_HISTORY = 20;

  /**
   * Get current activity state
   */
  getState(): ActivityState {
    return this.currentState;
  }

  /**
   * Get time in current state (seconds)
   */
  getTimeInState(): number {
    return Math.floor((Date.now() - this.stateStartTime) / 1000);
  }

  /**
   * Transition to new state
   */
  setState(newState: ActivityState, trigger: string = 'manual'): void {
    if (newState === this.currentState) {
      logger.debug('ACTIVITY_STATE_MANAGER', 'State unchanged', {
        state: newState,
        trigger
      });
      return;
    }

    const previousState = this.currentState;
    const timeInPreviousState = this.getTimeInState();

    // Validate transition
    if (!this.isValidTransition(previousState, newState)) {
      logger.warn('ACTIVITY_STATE_MANAGER', 'Invalid state transition', {
        from: previousState,
        to: newState,
        trigger
      });
      return;
    }

    // Record transition
    const transition: ActivityTransition = {
      from: previousState,
      to: newState,
      timestamp: Date.now(),
      trigger
    };

    this.stateHistory.push(transition);

    // Maintain history limit
    if (this.stateHistory.length > this.MAX_HISTORY) {
      this.stateHistory.shift();
    }

    // Update state
    this.currentState = newState;
    this.stateStartTime = Date.now();

    logger.info('ACTIVITY_STATE_MANAGER', 'State transition', {
      from: previousState,
      to: newState,
      timeInPreviousState,
      trigger,
      timestamp: this.stateStartTime
    });

    // Notify listeners
    this.notifyStateChange(newState, previousState);
  }

  /**
   * Validate state transition
   */
  private isValidTransition(from: ActivityState, to: ActivityState): boolean {
    // Define valid transitions
    const validTransitions: Record<ActivityState, ActivityState[]> = {
      'idle': ['navigation', 'training-active', 'meal-scan', 'fridge-scan', 'body-scan', 'profile-editing'],
      'navigation': ['idle', 'training-active', 'meal-scan', 'fridge-scan', 'body-scan', 'profile-editing'],
      'training-active': ['training-rest', 'navigation', 'idle'],
      'training-rest': ['training-active', 'navigation', 'idle'],
      'meal-scan': ['navigation', 'idle'],
      'fridge-scan': ['navigation', 'idle'],
      'body-scan': ['navigation', 'idle'],
      'profile-editing': ['navigation', 'idle']
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Get state history
   */
  getHistory(limit?: number): ActivityTransition[] {
    const history = [...this.stateHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Check if in training
   */
  isTraining(): boolean {
    return this.currentState === 'training-active' || this.currentState === 'training-rest';
  }

  /**
   * Check if in active training (not resting)
   */
  isActiveTraining(): boolean {
    return this.currentState === 'training-active';
  }

  /**
   * Check if resting during training
   */
  isResting(): boolean {
    return this.currentState === 'training-rest';
  }

  /**
   * Check if in scanning activity
   */
  isScanning(): boolean {
    return this.currentState === 'meal-scan' ||
           this.currentState === 'fridge-scan' ||
           this.currentState === 'body-scan';
  }

  /**
   * Check if idle
   */
  isIdle(): boolean {
    return this.currentState === 'idle';
  }

  /**
   * Register state change listener
   */
  onStateChange(listener: (state: ActivityState, previous: ActivityState) => void): () => void {
    this.stateChangeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(newState: ActivityState, previousState: ActivityState): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(newState, previousState);
      } catch (error) {
        logger.error('ACTIVITY_STATE_MANAGER', 'Error in state change listener', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Get response style based on current state
   */
  getResponseStyle(): 'ultra-short' | 'short' | 'normal' | 'detailed' {
    switch (this.currentState) {
      case 'training-active':
        return 'ultra-short'; // 5-15 words during active set
      case 'training-rest':
        return 'short'; // 15-30 words during rest
      case 'navigation':
        return 'normal'; // Normal conversational
      case 'profile-editing':
      case 'body-scan':
        return 'detailed'; // More detailed explanations
      default:
        return 'normal';
    }
  }

  /**
   * Get priority level for responses
   */
  getResponsePriority(): 'immediate' | 'high' | 'normal' | 'low' {
    switch (this.currentState) {
      case 'training-active':
        return 'immediate'; // Must respond instantly during set
      case 'training-rest':
        return 'high'; // Quick response during rest
      case 'meal-scan':
      case 'fridge-scan':
      case 'body-scan':
        return 'high'; // User waiting for scan results
      default:
        return 'normal';
    }
  }

  /**
   * Get state statistics
   */
  getStatistics() {
    const stateCounts: Record<ActivityState, number> = {
      'idle': 0,
      'navigation': 0,
      'training-active': 0,
      'training-rest': 0,
      'meal-scan': 0,
      'fridge-scan': 0,
      'body-scan': 0,
      'profile-editing': 0
    };

    let totalTime = 0;

    for (let i = 0; i < this.stateHistory.length; i++) {
      const transition = this.stateHistory[i];
      const nextTransition = this.stateHistory[i + 1];

      stateCounts[transition.to] += 1;

      if (nextTransition) {
        totalTime += nextTransition.timestamp - transition.timestamp;
      }
    }

    return {
      currentState: this.currentState,
      timeInCurrentState: this.getTimeInState(),
      transitionCount: this.stateHistory.length,
      stateCounts,
      averageTransitionTime: this.stateHistory.length > 0 ? totalTime / this.stateHistory.length : 0
    };
  }

  /**
   * Reset state to idle
   */
  reset(): void {
    this.setState('idle', 'reset');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stateChangeListeners = [];
    this.stateHistory = [];
    this.currentState = 'idle';
    this.stateStartTime = Date.now();
  }
}
