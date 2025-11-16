/**
 * TrainingContextProvider - Automatic Training Context Synchronization
 * Provides real-time training context to all session types
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { eventListenerHub } from '../events/EventListenerHub';
import { conversationMemoryManager } from '../memory/ConversationMemoryManager';
import { brainCore } from '../core/BrainCore';
import logger from '../../../lib/utils/logger';
import type {
  SessionStartedEvent,
  SessionCompletedEvent,
  ExerciseStartedEvent,
  ExerciseCompletedEvent,
  SetStartedEvent,
  SetCompletedEvent,
  RestStartedEvent,
  RestEndedEvent,
  RPEReportedEvent,
  LoadAdjustedEvent,
  PainReportedEvent,
} from '../events/types';

interface TrainingContextState {
  sessionId: string | null;
  userId: string | null;
  sessionType: 'force' | 'endurance' | 'functional' | 'competition' | null;
  currentExercise: string | null;
  currentSet: number;
  totalSets: number;
  isResting: boolean;
  sessionStartTime: number | null;
  lastEventTime: number | null;
}

interface TrainingContextValue {
  state: TrainingContextState;
  emitSessionStarted: (data: Omit<SessionStartedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitSessionCompleted: (data: Omit<SessionCompletedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitExerciseStarted: (data: Omit<ExerciseStartedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitExerciseCompleted: (data: Omit<ExerciseCompletedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitSetStarted: (data: Omit<SetStartedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitSetCompleted: (data: Omit<SetCompletedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitRestStarted: (data: Omit<RestStartedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitRestEnded: (data: Omit<RestEndedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitRPEReported: (data: Omit<RPEReportedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitLoadAdjusted: (data: Omit<LoadAdjustedEvent, 'type' | 'timestamp'>) => Promise<void>;
  emitPainReported: (data: Omit<PainReportedEvent, 'type' | 'timestamp'>) => Promise<void>;
  updateContext: (updates: Partial<TrainingContextState>) => void;
  resetContext: () => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function useTrainingContext() {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error('useTrainingContext must be used within TrainingContextProvider');
  }
  return context;
}

interface TrainingContextProviderProps {
  children: React.ReactNode;
}

export const TrainingContextProvider: React.FC<TrainingContextProviderProps> = ({ children }) => {
  const [state, setState] = useState<TrainingContextState>({
    sessionId: null,
    userId: null,
    sessionType: null,
    currentExercise: null,
    currentSet: 0,
    totalSets: 0,
    isResting: false,
    sessionStartTime: null,
    lastEventTime: null,
  });

  // Update context helper
  const updateContext = useCallback((updates: Partial<TrainingContextState>) => {
    setState(prev => ({
      ...prev,
      ...updates,
      lastEventTime: Date.now()
    }));
  }, []);

  // Reset context helper
  const resetContext = useCallback(() => {
    setState({
      sessionId: null,
      userId: null,
      sessionType: null,
      currentExercise: null,
      currentSet: 0,
      totalSets: 0,
      isResting: false,
      sessionStartTime: null,
      lastEventTime: null,
    });
  }, []);

  // Event emitters with automatic context tracking
  const emitSessionStarted = useCallback(async (data: Omit<SessionStartedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitSessionStarted(data);
    updateContext({
      sessionId: data.sessionId,
      userId: data.userId,
      sessionType: data.sessionType as any,
      sessionStartTime: Date.now(),
    });
    logger.info('TRAINING_CONTEXT', 'Session started', { sessionId: data.sessionId, type: data.sessionType });
  }, [updateContext]);

  const emitSessionCompleted = useCallback(async (data: Omit<SessionCompletedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitSessionCompleted(data);
    logger.info('TRAINING_CONTEXT', 'Session completed', {
      sessionId: data.sessionId,
      duration: data.totalDuration
    });
  }, []);

  const emitExerciseStarted = useCallback(async (data: Omit<ExerciseStartedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitExerciseStarted(data);
    updateContext({
      currentExercise: data.exerciseName,
      currentSet: 1,
      totalSets: data.totalSets || 0,
    });
    logger.debug('TRAINING_CONTEXT', 'Exercise started', { exercise: data.exerciseName });
  }, [updateContext]);

  const emitExerciseCompleted = useCallback(async (data: Omit<ExerciseCompletedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitExerciseCompleted(data);
    updateContext({
      currentExercise: null,
      currentSet: 0,
    });
    logger.debug('TRAINING_CONTEXT', 'Exercise completed', { exercise: data.exerciseName });
  }, [updateContext]);

  const emitSetStarted = useCallback(async (data: Omit<SetStartedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitSetStarted(data);
    updateContext({
      currentSet: data.setNumber,
      totalSets: data.totalSets,
    });
    logger.debug('TRAINING_CONTEXT', 'Set started', {
      exercise: data.exerciseName,
      set: data.setNumber
    });
  }, [updateContext]);

  const emitSetCompleted = useCallback(async (data: Omit<SetCompletedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitSetCompleted(data);
    logger.debug('TRAINING_CONTEXT', 'Set completed', {
      exercise: data.exerciseName,
      set: data.setNumber,
      reps: data.actualReps,
      rpe: data.rpe
    });
  }, []);

  const emitRestStarted = useCallback(async (data: Omit<RestStartedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitRestStarted(data);
    updateContext({ isResting: true });
    logger.debug('TRAINING_CONTEXT', 'Rest started', { duration: data.duration });
  }, [updateContext]);

  const emitRestEnded = useCallback(async (data: Omit<RestEndedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitRestEnded(data);
    updateContext({ isResting: false });
    logger.debug('TRAINING_CONTEXT', 'Rest ended');
  }, [updateContext]);

  const emitRPEReported = useCallback(async (data: Omit<RPEReportedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitRPEReported(data);
    logger.info('TRAINING_CONTEXT', 'RPE reported', {
      exercise: data.exerciseName,
      rpe: data.rpe
    });
  }, []);

  const emitLoadAdjusted = useCallback(async (data: Omit<LoadAdjustedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitLoadAdjusted(data);
    logger.info('TRAINING_CONTEXT', 'Load adjusted', {
      exercise: data.exerciseName,
      from: data.previousLoad,
      to: data.newLoad,
      direction: data.direction
    });
  }, []);

  const emitPainReported = useCallback(async (data: Omit<PainReportedEvent, 'type' | 'timestamp'>) => {
    await eventListenerHub.emitPainReported(data);
    logger.warn('TRAINING_CONTEXT', 'Pain reported', {
      location: data.location,
      severity: data.severity
    });
  }, []);

  // Sync with SessionAwarenessService on context changes
  useEffect(() => {
    if (state.sessionId && state.userId && brainCore.isInitialized()) {
      const awarenessService = brainCore.getContext().then(context => {
        // Context is automatically synced via BrainCore event listeners
        logger.debug('TRAINING_CONTEXT', 'Context synced with BrainCore', {
          sessionId: state.sessionId,
          exercise: state.currentExercise,
          isResting: state.isResting
        });
      });
    }
  }, [state.sessionId, state.userId, state.currentExercise, state.isResting]);

  const value: TrainingContextValue = {
    state,
    emitSessionStarted,
    emitSessionCompleted,
    emitExerciseStarted,
    emitExerciseCompleted,
    emitSetStarted,
    emitSetCompleted,
    emitRestStarted,
    emitRestEnded,
    emitRPEReported,
    emitLoadAdjusted,
    emitPainReported,
    updateContext,
    resetContext,
  };

  return (
    <TrainingContext.Provider value={value}>
      {children}
    </TrainingContext.Provider>
  );
};

export default TrainingContextProvider;
