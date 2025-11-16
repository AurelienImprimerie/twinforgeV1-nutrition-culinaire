import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../supabase/client';
import logger from '../../../../lib/utils/logger';
import type {
  BrainContext,
  ForgeType,
  IForgeModule,
  PerformanceMetrics,
  HealthStatus,
  AppContext,
  SessionAwareness,
  ProactiveSuggestion
} from '../../types';
import { UserKnowledgeBase } from '../../knowledge/UserKnowledgeBase';
import { SessionAwarenessService } from '../../awareness/SessionAwarenessService';
import { ContextManager } from '../ContextManager';
import { CacheManager } from '../CacheManager';
import { MissingDataDetector } from '../../utils/MissingDataDetector';
import { ForgeRegistry } from '../../forge-modules/ForgeRegistry';
import { eventListenerHub } from '../../events/EventListenerHub';
import { ProactiveSuggestionEngine } from '../../integration/ProactiveSuggestionEngine';
import { performanceMonitor } from '../PerformanceMonitor';
import { healthCheckService } from '../HealthCheckService';
import { initializeBrainCore } from './initialization';
import { setupEventListeners } from './eventHandlers';
import {
  getProactiveSuggestions,
  recordSuggestionShown,
  dismissSuggestion,
  completeSuggestion
} from './suggestions';
import { getBodyScanWithInsights, getMorphologyInsightsContext } from './bodyScan';

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

  async initialize(userId: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.currentUserId = userId;
      this.supabase = supabase;
      this.forgeRegistry = new ForgeRegistry();

      const services = await initializeBrainCore(userId, this.supabase, {
        cacheManager: this.cacheManager,
        knowledgeBase: this.knowledgeBase,
        awarenessService: this.awarenessService,
        contextManager: this.contextManager,
        missingDataDetector: this.missingDataDetector,
        suggestionEngine: this.suggestionEngine
      });

      this.cacheManager = services.cacheManager;
      this.knowledgeBase = services.knowledgeBase;
      this.awarenessService = services.awarenessService;
      this.contextManager = services.contextManager;
      this.missingDataDetector = services.missingDataDetector;
      this.suggestionEngine = services.suggestionEngine;

      setupEventListeners(this.awarenessService, this.cacheManager);

      this.initialized = true;
    } catch (error) {
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

  updateAppContext(context: Partial<AppContext>): void {
    if (!this.awarenessService) {
      logger.warn('BRAIN_CORE', 'Awareness service not initialized');
      return;
    }

    this.awarenessService.updateAppContext(context);
    logger.debug('BRAIN_CORE', 'App context updated', { context });
  }

  updateSessionAwareness(awareness: Partial<SessionAwareness>): void {
    if (!this.awarenessService) {
      logger.warn('BRAIN_CORE', 'Awareness service not initialized');
      return;
    }

    this.awarenessService.updateSessionAwareness(awareness);
    logger.debug('BRAIN_CORE', 'Session awareness updated', { awareness });
  }

  invalidateCache(forgeType: ForgeType): void {
    if (!this.cacheManager) {
      return;
    }

    this.cacheManager.invalidateForge(forgeType);
    logger.info('BRAIN_CORE', 'Cache invalidated', { forgeType });
  }

  async getBodyScanWithInsights(scanId?: string) {
    return getBodyScanWithInsights(this.knowledgeBase, this.currentUserId, scanId);
  }

  async getMorphologyInsightsContext(): Promise<string> {
    return getMorphologyInsightsContext(this.knowledgeBase);
  }

  async refresh(): Promise<void> {
    if (!this.knowledgeBase || !this.currentUserId) {
      throw new Error('Brain not initialized');
    }

    logger.info('BRAIN_CORE', 'Refreshing all data', { userId: this.currentUserId });

    if (this.cacheManager) {
      this.cacheManager.clearAll();
    }

    await this.knowledgeBase.loadUserKnowledge(this.currentUserId);
    logger.info('BRAIN_CORE', 'Data refreshed successfully');
  }

  getHealthStatus(): HealthStatus {
    const now = Date.now();

    return {
      brain: this.initialized ? 'healthy' : 'down',
      supabase: this.supabase ? 'connected' : 'disconnected',
      cache: this.cacheManager?.isHealthy() ? 'fresh' : 'stale',
      lastCheck: now
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  registerForge(module: IForgeModule): void {
    if (!this.forgeRegistry) {
      throw new Error('Brain not initialized');
    }

    this.forgeRegistry.register(module);
    logger.info('BRAIN_CORE', 'Forge module registered', {
      forgeType: module.forgeType
    });
  }

  getForgeModule(forgeType: ForgeType): IForgeModule | null {
    if (!this.forgeRegistry) {
      return null;
    }

    return this.forgeRegistry.get(forgeType);
  }

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

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getEventHub() {
    return eventListenerHub;
  }

  async getProactiveSuggestions(): Promise<ProactiveSuggestion[]> {
    return getProactiveSuggestions(
      this.knowledgeBase,
      this.awarenessService,
      this.missingDataDetector,
      this.suggestionEngine
    );
  }

  async recordSuggestionShown(suggestion: ProactiveSuggestion): Promise<void> {
    return recordSuggestionShown(this.suggestionEngine, suggestion);
  }

  async dismissSuggestion(suggestionId: string): Promise<void> {
    return dismissSuggestion(this.suggestionEngine, suggestionId);
  }

  async completeSuggestion(suggestionId: string): Promise<void> {
    return completeSuggestion(this.suggestionEngine, suggestionId);
  }

  destroy(): void {
    logger.info('BRAIN_CORE', 'Destroying brain system');

    healthCheckService.stop();
    performanceMonitor.destroy();

    if (this.cacheManager) {
      this.cacheManager.disableRealtimeInvalidation();
    }

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

export const brainCore = BrainCoreService.getInstance();
