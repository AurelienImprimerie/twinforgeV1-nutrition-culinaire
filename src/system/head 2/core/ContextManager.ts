/**
 * ContextManager - Context Building and Management
 * Builds unified BrainContext from knowledge base and awareness
 */

import logger from '../../../lib/utils/logger';
import type {
  BrainContext,
  UserKnowledge,
  AppContext,
  SessionAwareness,
  MissingDataReport
} from '../types';
import type { UserKnowledgeBase } from '../knowledge/UserKnowledgeBase';
import type { SessionAwarenessService } from '../awareness/SessionAwarenessService';
import type { CacheManager } from './CacheManager';
import { MissingDataDetector } from '../utils/MissingDataDetector';

export class ContextManager {
  private knowledgeBase: UserKnowledgeBase;
  private awarenessService: SessionAwarenessService;
  private cacheManager: CacheManager;
  private missingDataDetector: MissingDataDetector;

  constructor(
    knowledgeBase: UserKnowledgeBase,
    awarenessService: SessionAwarenessService,
    cacheManager: CacheManager
  ) {
    this.knowledgeBase = knowledgeBase;
    this.awarenessService = awarenessService;
    this.cacheManager = cacheManager;
    this.missingDataDetector = new MissingDataDetector();
  }

  /**
   * Build complete brain context
   */
  async buildContext(): Promise<BrainContext> {
    const startTime = Date.now();

    try {
      // Get user knowledge
      const userKnowledge = await this.knowledgeBase.getUserKnowledge();

      // Get app context
      const appContext = this.awarenessService.getAppContext();

      // Get session awareness
      const sessionAwareness = this.awarenessService.getSessionAwareness();

      // Get today's data
      const todayData = this.knowledgeBase.getTodayData();

      // Detect missing data
      const missingData = this.missingDataDetector.analyze(userKnowledge, appContext);

      // Generate cache key
      const cacheKey = this.generateCacheKey(userKnowledge, appContext, sessionAwareness);

      const context: BrainContext = {
        user: userKnowledge,
        app: appContext,
        session: sessionAwareness,
        missingData,
        todayData,
        timestamp: Date.now(),
        cacheKey
      };

      const buildTime = Date.now() - startTime;

      logger.debug('CONTEXT_MANAGER', 'Context built', {
        buildTime: `${buildTime}ms`,
        hasTrainingSession: !!sessionAwareness.trainingSession,
        activityState: appContext.activityState,
        missingSuggestions: missingData.suggestions.length,
        todayActivities: todayData?.totalActivities || 0
      });

      return context;
    } catch (error) {
      logger.error('CONTEXT_MANAGER', 'Failed to build context', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Generate cache key based on context
   */
  private generateCacheKey(
    user: UserKnowledge,
    app: AppContext,
    session: SessionAwareness
  ): string {
    const parts = [
      user.profile.userId,
      app.currentRoute,
      app.activityState,
      session.isActive ? 'active' : 'inactive',
      session.trainingSession?.currentExerciseIndex || 0
    ];

    return parts.join(':');
  }
}
