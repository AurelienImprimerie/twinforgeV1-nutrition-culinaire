/**
 * BrainCore - Central Intelligence Hub
 * Main orchestrator for the head system
 * Centralizes all user data and provides unified access to chat and realtime
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import logger from '../../../lib/utils/logger';
import type {
  BrainContext,
  UserKnowledge,
  AppContext,
  SessionAwareness,
  ForgeType,
  IForgeModule,
  PerformanceMetrics,
  HealthStatus
} from '../types';
import { UserKnowledgeBase } from '../knowledge/UserKnowledgeBase';
import { SessionAwarenessService } from '../awareness/SessionAwarenessService';
import { ContextManager } from './ContextManager';
import { CacheManager } from './CacheManager';
import { MissingDataDetector } from '../utils/MissingDataDetector';
import { ForgeRegistry } from '../forge-modules/ForgeRegistry';
import { eventListenerHub } from '../events/EventListenerHub';
import { ProactiveSuggestionEngine } from '../integration/ProactiveSuggestionEngine';
import { performanceMonitor } from './PerformanceMonitor';
import { healthCheckService } from './HealthCheckService';
import type {
  RPEReportedEvent,
  LoadAdjustedEvent,
  PainReportedEvent,
  RecordAchievedEvent,
  SetCompletedEvent,
} from '../events/types';
import type { ProactiveSuggestion, MissingDataReport } from '../types';

class BrainCoreService {
  private static instance: BrainCoreService;
  private supabase: SupabaseClient | null = null;
  private knowledgeBase: UserKnowledgeBase | null = null;
  private awarenessService: SessionAwarenessService | null = null;
  private contextManager: ContextManager | null = null;
  private cacheManager: CacheManager | null = null;
  private forgeRegistry: ForgeRegistry | null = null;
  private missingDataDetector: MissingDataDetector | null = null;
  private suggestionEngine: ProactiveSuggestionEngine | null = null;

  private initialized = false;
  private currentUserId: string | null = null;
  private performanceMetrics: PerformanceMetrics = {
    dataCollectionLatency: 0,
    contextBuildingLatency: 0,
    promptGenerationLatency: 0,
    cacheHitRate: 0,
    totalLatency: 0
  };

  private constructor() {}

  static getInstance(): BrainCoreService {
    if (!BrainCoreService.instance) {
      BrainCoreService.instance = new BrainCoreService();
    }
    return BrainCoreService.instance;
  }

  /**
   * Initialize the brain system
   */
  async initialize(userId: string): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('BRAIN_CORE', 'Initializing brain system', { userId });

      this.currentUserId = userId;

      // Use singleton authenticated Supabase client
      this.supabase = supabase;

      // Initialize core services
      this.cacheManager = new CacheManager();
      this.forgeRegistry = new ForgeRegistry();
      this.knowledgeBase = new UserKnowledgeBase(this.supabase, this.cacheManager);
      this.awarenessService = new SessionAwarenessService();
      this.contextManager = new ContextManager(
        this.knowledgeBase,
        this.awarenessService,
        this.cacheManager
      );
      this.missingDataDetector = new MissingDataDetector();
      this.suggestionEngine = new ProactiveSuggestionEngine(userId);

      // Initialize performance monitoring
      performanceMonitor.initialize(userId);
      healthCheckService.start();

      // Load initial data (gracefully handle errors)
      try {
        await this.knowledgeBase.loadUserKnowledge(userId);
      } catch (knowledgeError) {
        logger.warn('BRAIN_CORE', 'Failed to load user knowledge, continuing with limited data', {
          userId,
          error: knowledgeError instanceof Error ? knowledgeError.message : String(knowledgeError)
        });
        // Continue initialization even if knowledge loading fails
      }

      // Setup event listeners for reactive coaching
      this.setupEventListeners();

      this.initialized = true;

      const initTime = Date.now() - startTime;

      // Record initialization metric
      await performanceMonitor.recordMetric({
        operationType: 'initialization',
        operationName: 'brain_core_init',
        durationMs: initTime,
        success: true,
        startedAt: new Date(startTime),
      });

      logger.info('BRAIN_CORE', 'Brain system initialized successfully', {
        userId,
        initTime: `${initTime}ms`
      });
    } catch (error) {
      const initTime = Date.now() - startTime;

      // Record initialization error
      await performanceMonitor.recordError({
        errorType: 'InitializationError',
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        operation: 'brain_core_init',
        subsystem: 'brain_core',
        severity: 'critical',
      });

      logger.error('BRAIN_CORE', 'Failed to initialize brain system', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get current brain context
   * This is the main method used by chat and realtime
   */
  async getContext(): Promise<BrainContext> {
    const endTimer = performanceMonitor.startTimer('context_retrieval', 'get_context');
    const startTime = Date.now();

    if (!this.initialized || !this.contextManager) {
      await endTimer(false, 'Brain not initialized');
      throw new Error('Brain not initialized. Call initialize() first.');
    }

    try {
      const context = await this.contextManager.buildContext();

      const latency = Date.now() - startTime;
      this.performanceMetrics.totalLatency = latency;

      await endTimer(true, undefined, { latency });

      logger.debug('BRAIN_CORE', 'Context retrieved', {
        userId: this.currentUserId,
        latency: `${latency}ms`,
        cacheHit: context.timestamp < Date.now() - 1000
      });

      return context;
    } catch (error) {
      await endTimer(false, error instanceof Error ? error.message : String(error));
      await performanceMonitor.recordError({
        errorType: 'ContextRetrievalError',
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        operation: 'get_context',
        subsystem: 'brain_core',
        severity: 'high',
      });

      logger.error('BRAIN_CORE', 'Failed to get context', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get context for a specific forge
   */
  async getForgeContext(forgeType: ForgeType): Promise<any> {
    if (!this.knowledgeBase) {
      throw new Error('Brain not initialized');
    }

    const knowledge = await this.knowledgeBase.getUserKnowledge();

    switch (forgeType) {
      case 'training':
        return knowledge.training;
      case 'equipment':
        return knowledge.equipment;
      case 'nutrition':
        return knowledge.nutrition;
      case 'fasting':
        return knowledge.fasting;
      case 'body-scan':
        return knowledge.bodyScan;
      default:
        throw new Error(`Unknown forge type: ${forgeType}`);
    }
  }

  /**
   * Update app context (route changes, activity changes)
   */
  updateAppContext(context: Partial<AppContext>): void {
    if (!this.awarenessService) {
      logger.warn('BRAIN_CORE', 'Awareness service not initialized');
      return;
    }

    this.awarenessService.updateAppContext(context);

    logger.debug('BRAIN_CORE', 'App context updated', { context });
  }

  /**
   * Update session awareness (training progress)
   */
  updateSessionAwareness(awareness: Partial<SessionAwareness>): void {
    if (!this.awarenessService) {
      logger.warn('BRAIN_CORE', 'Awareness service not initialized');
      return;
    }

    this.awarenessService.updateSessionAwareness(awareness);

    logger.debug('BRAIN_CORE', 'Session awareness updated', { awareness });
  }

  /**
   * Invalidate cache for specific forge
   */
  invalidateCache(forgeType: ForgeType): void {
    if (!this.cacheManager) {
      return;
    }

    this.cacheManager.invalidateForge(forgeType);

    logger.info('BRAIN_CORE', 'Cache invalidated', { forgeType });
  }

  /**
   * Force refresh all data
   */
  async refresh(): Promise<void> {
    if (!this.knowledgeBase || !this.currentUserId) {
      throw new Error('Brain not initialized');
    }

    logger.info('BRAIN_CORE', 'Refreshing all data', { userId: this.currentUserId });

    // Clear cache
    if (this.cacheManager) {
      this.cacheManager.clearAll();
    }

    // Reload knowledge
    await this.knowledgeBase.loadUserKnowledge(this.currentUserId);

    logger.info('BRAIN_CORE', 'Data refreshed successfully');
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    const now = Date.now();

    return {
      brain: this.initialized ? 'healthy' : 'down',
      supabase: this.supabase ? 'connected' : 'disconnected',
      cache: this.cacheManager?.isHealthy() ? 'fresh' : 'stale',
      lastCheck: now
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Register a forge module
   */
  registerForge(module: IForgeModule): void {
    if (!this.forgeRegistry) {
      throw new Error('Brain not initialized');
    }

    this.forgeRegistry.register(module);

    logger.info('BRAIN_CORE', 'Forge module registered', {
      forgeType: module.forgeType
    });
  }

  /**
   * Get registered forge module
   */
  getForgeModule(forgeType: ForgeType): IForgeModule | null {
    if (!this.forgeRegistry) {
      return null;
    }

    return this.forgeRegistry.get(forgeType);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.info('BRAIN_CORE', 'Cleaning up brain system');

    if (this.cacheManager) {
      this.cacheManager.clearAll();
    }

    this.initialized = false;
    this.currentUserId = null;
    this.supabase = null;
    this.knowledgeBase = null;
    this.awarenessService = null;
    this.contextManager = null;
    this.cacheManager = null;
    this.forgeRegistry = null;

    logger.info('BRAIN_CORE', 'Brain system cleaned up');
  }

  /**
   * Check if brain is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Setup event listeners for reactive coaching
   */
  private setupEventListeners(): void {
    logger.info('BRAIN_CORE', 'Setting up event listeners for reactive coaching');

    // Listen for pain reports - immediate coach intervention
    eventListenerHub.on('pain:reported', async (event: PainReportedEvent) => {
      logger.warn('BRAIN_CORE', 'Pain reported - triggering coach intervention', {
        userId: event.userId,
        location: event.location,
        severity: event.severity
      });

      // Create a system notification for pain
      if (this.awarenessService) {
        this.awarenessService.updateAppContext({
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

      // Trigger notification to coach (will be picked up by chat integration)
      logger.info('BRAIN_CORE', 'Pain alert dispatched to coaching system', {
        painLocation: event.location,
        severity: event.severity
      });
    });

    // Listen for high RPE - suggest load adjustments
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

    // Listen for load adjustments - track user adaptation
    eventListenerHub.on('load:adjusted', async (event: LoadAdjustedEvent) => {
      logger.info('BRAIN_CORE', 'Load adjustment tracked', {
        userId: event.userId,
        exerciseName: event.exerciseName,
        direction: event.direction,
        previousLoad: event.previousLoad,
        newLoad: event.newLoad
      });

      // This data will be used for future recommendations
      if (this.cacheManager) {
        this.cacheManager.invalidate('training');
      }
    });

    // Listen for records - celebration and motivation
    eventListenerHub.on('record:achieved', async (event: RecordAchievedEvent) => {
      logger.info('BRAIN_CORE', '🏆 Record achieved - triggering celebration', {
        userId: event.userId,
        recordType: event.recordType,
        exerciseName: event.exerciseName,
        value: event.value
      });

      // Update awareness to show celebration state
      if (this.awarenessService) {
        this.awarenessService.updateAppContext({
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

    // Listen for set completions - track session progress
    eventListenerHub.on('set:completed', async (event: SetCompletedEvent) => {
      logger.debug('BRAIN_CORE', 'Set completed tracked', {
        userId: event.userId,
        exerciseName: event.exerciseName,
        setNumber: event.setNumber,
        actualReps: event.actualReps,
        rpe: event.rpe
      });

      // Invalidate training cache to reflect latest progress
      if (this.cacheManager && event.setNumber === event.totalSets) {
        this.cacheManager.invalidate('training');
      }
    });

    logger.info('BRAIN_CORE', 'Event listeners setup complete - reactive coaching enabled');
  }

  /**
   * Get event listener hub
   */
  getEventHub() {
    return eventListenerHub;
  }

  /**
   * Get proactive suggestions based on current context and missing data
   * UNIFIED with profileCompletionService via ProfileKnowledgeAdapter
   */
  async getProactiveSuggestions(): Promise<ProactiveSuggestion[]> {
    if (!this.initialized || !this.knowledgeBase || !this.awarenessService || !this.missingDataDetector || !this.suggestionEngine) {
      logger.warn('BRAIN_CORE', 'Cannot get suggestions - brain not fully initialized');
      return [];
    }

    try {
      const knowledge = await this.knowledgeBase.getUserKnowledge();
      const appContext = this.awarenessService.getAppContext();
      const sessionContext = {
        lastSessionDate: knowledge.training.lastSessionDate
      };

      // CRITICAL: Set raw profile for unified profile completeness detection
      const rawProfile = this.knowledgeBase.getRawProfile();
      this.missingDataDetector.setRawProfile(rawProfile);

      const missingDataReport = this.missingDataDetector.analyze(knowledge, appContext);

      const suggestions = await this.suggestionEngine.getActiveSuggestions(
        missingDataReport,
        appContext,
        sessionContext
      );

      logger.debug('BRAIN_CORE', 'Generated proactive suggestions', {
        count: suggestions.length,
        hasRawProfile: !!rawProfile
      });

      return suggestions;
    } catch (error) {
      logger.error('BRAIN_CORE', 'Error getting proactive suggestions', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Record that a suggestion was shown to the user
   */
  async recordSuggestionShown(suggestion: ProactiveSuggestion): Promise<void> {
    if (!this.suggestionEngine) {
      logger.warn('BRAIN_CORE', 'Cannot record suggestion - engine not initialized');
      return;
    }

    await this.suggestionEngine.recordShown(suggestion);
  }

  /**
   * Record that a suggestion was dismissed by the user
   */
  async dismissSuggestion(suggestionId: string): Promise<void> {
    if (!this.suggestionEngine) {
      logger.warn('BRAIN_CORE', 'Cannot dismiss suggestion - engine not initialized');
      return;
    }

    await this.suggestionEngine.recordDismissed(suggestionId);
  }

  /**
   * Record that a suggestion action was completed by the user
   */
  async completeSuggestion(suggestionId: string): Promise<void> {
    if (!this.suggestionEngine) {
      logger.warn('BRAIN_CORE', 'Cannot complete suggestion - engine not initialized');
      return;
    }

    await this.suggestionEngine.recordCompleted(suggestionId);
  }

  /**
   * Cleanup and destroy the brain system
   */
  destroy(): void {
    logger.info('BRAIN_CORE', 'Destroying brain system');

    // Stop health checks
    healthCheckService.stop();

    // Flush and destroy performance monitor
    performanceMonitor.destroy();

    // Reset state
    this.initialized = false;
    this.currentUserId = null;
    this.supabase = null;
    this.knowledgeBase = null;
    this.awarenessService = null;
    this.contextManager = null;
    this.cacheManager = null;
    this.forgeRegistry = null;
    this.missingDataDetector = null;
    this.suggestionEngine = null;

    logger.info('BRAIN_CORE', 'Brain system destroyed');
  }
}

// Export singleton instance
export const brainCore = BrainCoreService.getInstance();
