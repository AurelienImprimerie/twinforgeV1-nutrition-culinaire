import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import { UserKnowledgeBase } from '../../knowledge/UserKnowledgeBase';
import { SessionAwarenessService } from '../../awareness/SessionAwarenessService';
import { ContextManager } from '../ContextManager';
import { CacheManager } from '../CacheManager';
import { MissingDataDetector } from '../../utils/MissingDataDetector';
import { ProactiveSuggestionEngine } from '../../integration/ProactiveSuggestionEngine';
import { performanceMonitor } from '../PerformanceMonitor';
import { healthCheckService } from '../HealthCheckService';

export async function initializeBrainCore(
  userId: string,
  supabase: SupabaseClient,
  context: {
    cacheManager: CacheManager | null;
    knowledgeBase: UserKnowledgeBase | null;
    awarenessService: SessionAwarenessService | null;
    contextManager: ContextManager | null;
    missingDataDetector: MissingDataDetector | null;
    suggestionEngine: ProactiveSuggestionEngine | null;
  }
): Promise<{
  cacheManager: CacheManager;
  knowledgeBase: UserKnowledgeBase;
  awarenessService: SessionAwarenessService;
  contextManager: ContextManager;
  missingDataDetector: MissingDataDetector;
  suggestionEngine: ProactiveSuggestionEngine;
}> {
  const startTime = Date.now();

  logger.info('BRAIN_CORE', 'Initializing brain system', { userId });

  const cacheManager = new CacheManager();
  const knowledgeBase = new UserKnowledgeBase(supabase, cacheManager);
  const awarenessService = new SessionAwarenessService();
  const contextManager = new ContextManager(
    knowledgeBase,
    awarenessService,
    cacheManager
  );
  const missingDataDetector = new MissingDataDetector();
  const suggestionEngine = new ProactiveSuggestionEngine(userId);

  performanceMonitor.initialize(userId);
  healthCheckService.start();

  try {
    await knowledgeBase.loadUserKnowledge(userId);
  } catch (knowledgeError) {
    logger.warn('BRAIN_CORE', 'Failed to load user knowledge, continuing with limited data', {
      userId,
      error: knowledgeError instanceof Error ? knowledgeError.message : String(knowledgeError)
    });
  }

  cacheManager.enableRealtimeInvalidation(supabase);

  const initTime = Date.now() - startTime;

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

  return {
    cacheManager,
    knowledgeBase,
    awarenessService,
    contextManager,
    missingDataDetector,
    suggestionEngine
  };
}
