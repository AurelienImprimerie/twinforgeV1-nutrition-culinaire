/**
 * SessionAwarenessService - Real-Time Activity Tracking
 * Tracks user position in app and current activity state
 */

import logger from '../../../lib/utils/logger';
import { TrainingSessionMonitor } from './TrainingSessionMonitor';
import { ActivityStateManager } from './ActivityStateManager';
import { eventListenerHub } from '../events/EventListenerHub';
import type {
  AppContext,
  SessionAwareness,
  TrainingSessionContext,
  PageContext,
  ActivityState
} from '../types';

export class SessionAwarenessService {
  private appContext: AppContext;
  private sessionAwareness: SessionAwareness;
  private trainingMonitor: TrainingSessionMonitor;
  private activityStateManager: ActivityStateManager;

  constructor() {
    this.trainingMonitor = new TrainingSessionMonitor();
    this.activityStateManager = new ActivityStateManager();
    this.appContext = {
      currentRoute: '/',
      previousRoute: null,
      pageContext: {
        type: 'home'
      },
      activityState: 'idle',
      timestamp: Date.now()
    };

    this.sessionAwareness = {
      isActive: false,
      sessionType: null,
      timestamp: Date.now()
    };
  }

  /**
   * Update app context (called on route changes)
   */
  updateAppContext(context: Partial<AppContext>): void {
    const previousRoute = this.appContext.currentRoute;

    this.appContext = {
      ...this.appContext,
      ...context,
      previousRoute,
      timestamp: Date.now()
    };

    // Auto-detect page context from route
    if (context.currentRoute) {
      this.appContext.pageContext = this.detectPageContext(context.currentRoute);
      this.appContext.activityState = this.detectActivityState(context.currentRoute);
    }

    logger.debug('SESSION_AWARENESS', 'App context updated', {
      route: this.appContext.currentRoute,
      pageType: this.appContext.pageContext.type,
      activityState: this.appContext.activityState
    });
  }

  /**
   * Update session awareness (called during training)
   */
  updateSessionAwareness(awareness: Partial<SessionAwareness>): void {
    this.sessionAwareness = {
      ...this.sessionAwareness,
      ...awareness,
      timestamp: Date.now()
    };

    logger.debug('SESSION_AWARENESS', 'Session awareness updated', {
      isActive: this.sessionAwareness.isActive,
      sessionType: this.sessionAwareness.sessionType,
      currentExercise: this.sessionAwareness.trainingSession?.currentExercise?.name
    });
  }

  /**
   * Update training session context
   */
  updateTrainingContext(context: Partial<TrainingSessionContext>): void {
    const previousContext = this.sessionAwareness.trainingSession;

    if (!this.sessionAwareness.trainingSession) {
      this.sessionAwareness.trainingSession = {
        sessionId: context.sessionId || '',
        currentExerciseIndex: context.currentExerciseIndex || 0,
        totalExercises: context.totalExercises || 0,
        currentSet: context.currentSet || 1,
        totalSets: context.totalSets || 0,
        isResting: context.isResting || false,
        restTimeRemaining: context.restTimeRemaining || 0,
        sessionTimeElapsed: context.sessionTimeElapsed || 0,
        discipline: context.discipline || 'force'
      };
    } else {
      this.sessionAwareness.trainingSession = {
        ...this.sessionAwareness.trainingSession,
        ...context
      };
    }

    // Update activity state based on training context
    if (context.isResting !== undefined) {
      const newState = context.isResting ? 'training-rest' : 'training-active';
      this.activityStateManager.setState(newState, 'training-context-update');

      // Emit rest events
      if (context.isResting && !previousContext?.isResting) {
        eventListenerHub.emitRestStarted({
          userId: this.sessionAwareness.trainingSession.sessionId,
          sessionId: this.sessionAwareness.trainingSession.sessionId,
          exerciseName: this.sessionAwareness.trainingSession.currentExercise?.name || 'Unknown',
          setNumber: this.sessionAwareness.trainingSession.currentSet,
          duration: this.sessionAwareness.trainingSession.restTimeRemaining || 0,
        });
      } else if (!context.isResting && previousContext?.isResting) {
        eventListenerHub.emitRestEnded({
          userId: this.sessionAwareness.trainingSession.sessionId,
          sessionId: this.sessionAwareness.trainingSession.sessionId,
          exerciseName: this.sessionAwareness.trainingSession.currentExercise?.name || 'Unknown',
          setNumber: this.sessionAwareness.trainingSession.currentSet,
          actualDuration: previousContext.restTimeRemaining || 0,
        });
      }
    }

    logger.debug('SESSION_AWARENESS', 'Training context updated', {
      sessionId: this.sessionAwareness.trainingSession.sessionId,
      exerciseIndex: this.sessionAwareness.trainingSession.currentExerciseIndex,
      isResting: this.sessionAwareness.trainingSession.isResting
    });
  }

  /**
   * Get training monitor
   */
  getTrainingMonitor(): TrainingSessionMonitor {
    return this.trainingMonitor;
  }

  /**
   * Get activity state manager
   */
  getActivityStateManager(): ActivityStateManager {
    return this.activityStateManager;
  }

  /**
   * Get event listener hub
   */
  getEventHub() {
    return eventListenerHub;
  }

  /**
   * Get response style based on current activity
   */
  getResponseStyle(): 'ultra-short' | 'short' | 'normal' | 'detailed' {
    return this.activityStateManager.getResponseStyle();
  }

  /**
   * Get response priority based on current activity
   */
  getResponsePriority(): 'immediate' | 'high' | 'normal' | 'low' {
    return this.activityStateManager.getResponsePriority();
  }

  /**
   * Get current app context
   */
  getAppContext(): AppContext {
    return { ...this.appContext };
  }

  /**
   * Get current session awareness
   */
  getSessionAwareness(): SessionAwareness {
    return { ...this.sessionAwareness };
  }

  /**
   * Check if user is in training
   */
  isInTraining(): boolean {
    return (
      this.sessionAwareness.isActive &&
      this.sessionAwareness.sessionType === 'training'
    );
  }

  /**
   * Check if user is actively exercising (not resting)
   */
  isActivelyExercising(): boolean {
    return (
      this.isInTraining() &&
      this.sessionAwareness.trainingSession?.isResting === false
    );
  }

  /**
   * Get current activity state
   */
  getActivityState(): ActivityState {
    return this.appContext.activityState;
  }

  /**
   * Reset session (called when session ends)
   */
  resetSession(): void {
    this.sessionAwareness = {
      isActive: false,
      sessionType: null,
      timestamp: Date.now()
    };

    this.trainingMonitor.endSession();
    this.activityStateManager.reset();

    logger.info('SESSION_AWARENESS', 'Session reset');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.trainingMonitor.cleanup();
    this.activityStateManager.cleanup();
  }

  /**
   * Detect page context from route
   */
  private detectPageContext(route: string): PageContext {
    if (route.startsWith('/training/pipeline')) {
      const stepMatch = route.match(/\/training\/pipeline\/(.+)/);
      return {
        type: 'training',
        subContext: stepMatch ? `pipeline-${stepMatch[1]}` : 'pipeline'
      };
    }

    if (route.startsWith('/training')) {
      return { type: 'training' };
    }

    if (route.startsWith('/profile')) {
      const tabMatch = route.match(/\/profile\/(.+)/);
      return {
        type: 'profile',
        subContext: tabMatch ? `profile-${tabMatch[1]}` : undefined
      };
    }

    if (route.startsWith('/settings')) {
      return { type: 'settings' };
    }

    if (route === '/' || route === '/home') {
      return { type: 'home' };
    }

    return { type: 'other' };
  }

  /**
   * Detect activity state from route
   */
  private detectActivityState(route: string): ActivityState {
    if (route.includes('/training/pipeline/seance')) {
      return 'training-active';
    }

    if (route.includes('/training/pipeline')) {
      return 'navigation';
    }

    if (route.includes('/meals/scan') || route.includes('/meal-scan')) {
      return 'meal-scan';
    }

    if (route.includes('/fridge/scan')) {
      return 'fridge-scan';
    }

    if (route.includes('/body-scan')) {
      return 'body-scan';
    }

    if (route.startsWith('/profile')) {
      return 'profile-editing';
    }

    return 'idle';
  }
}
