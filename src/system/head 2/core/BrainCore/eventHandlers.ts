import logger from '../../../../lib/utils/logger';
import { eventListenerHub } from '../../events/EventListenerHub';
import type { SessionAwarenessService } from '../../awareness/SessionAwarenessService';
import type { CacheManager } from '../CacheManager';
import type {
  RPEReportedEvent,
  LoadAdjustedEvent,
  PainReportedEvent,
  RecordAchievedEvent,
  SetCompletedEvent,
} from '../../events/types';

export function setupEventListeners(
  awarenessService: SessionAwarenessService | null,
  cacheManager: CacheManager | null
): void {
  logger.info('BRAIN_CORE', 'Setting up event listeners for reactive coaching');

  eventListenerHub.on('pain:reported', async (event: PainReportedEvent) => {
    logger.warn('BRAIN_CORE', 'Pain reported - triggering coach intervention', {
      userId: event.userId,
      location: event.location,
      severity: event.severity
    });

    if (awarenessService) {
      awarenessService.updateAppContext({
        currentRoute: '/training/pipeline/seance',
        previousRoute: null,
        pageContext: {
          type: 'training',
          subContext: 'pain-alert'
        },
        activityState: 'training-active',
        timestamp: Date.now()
      });
    }

    logger.info('BRAIN_CORE', 'Pain alert dispatched to coaching system', {
      painLocation: event.location,
      severity: event.severity
    });
  });

  eventListenerHub.on('rpe:reported', async (event: RPEReportedEvent) => {
    if (event.rpe >= 9) {
      logger.warn('BRAIN_CORE', 'High RPE detected - suggesting load decrease', {
        userId: event.userId,
        rpe: event.rpe,
        exerciseName: event.exerciseName
      });
    } else if (event.rpe <= 5 && event.rpe > 0) {
      logger.info('BRAIN_CORE', 'Low RPE detected - suggesting load increase', {
        userId: event.userId,
        rpe: event.rpe,
        exerciseName: event.exerciseName
      });
    }
  });

  eventListenerHub.on('load:adjusted', async (event: LoadAdjustedEvent) => {
    logger.info('BRAIN_CORE', 'Load adjustment tracked', {
      userId: event.userId,
      exerciseName: event.exerciseName,
      direction: event.direction,
      previousLoad: event.previousLoad,
      newLoad: event.newLoad
    });

    if (cacheManager) {
      cacheManager.invalidate('training');
    }
  });

  eventListenerHub.on('record:achieved', async (event: RecordAchievedEvent) => {
    logger.info('BRAIN_CORE', '🏆 Record achieved - triggering celebration', {
      userId: event.userId,
      recordType: event.recordType,
      exerciseName: event.exerciseName,
      value: event.value
    });

    if (awarenessService) {
      awarenessService.updateAppContext({
        currentRoute: '/training/pipeline/seance',
        previousRoute: null,
        pageContext: {
          type: 'training',
          subContext: 'record-celebration'
        },
        activityState: 'training-active',
        timestamp: Date.now()
      });
    }
  });

  eventListenerHub.on('set:completed', async (event: SetCompletedEvent) => {
    logger.debug('BRAIN_CORE', 'Set completed tracked', {
      userId: event.userId,
      exerciseName: event.exerciseName,
      setNumber: event.setNumber,
      actualReps: event.actualReps,
      rpe: event.rpe
    });

    if (cacheManager && event.setNumber === event.totalSets) {
      cacheManager.invalidate('training');
    }
  });

  logger.info('BRAIN_CORE', 'Event listeners setup complete - reactive coaching enabled');
}
