/**
 * ChatIntegration - Connects Head System to Text Chat
 * Enriches chat prompts with brain context
 */

import logger from '../../../lib/utils/logger';
import { brainCore } from '../core/BrainCore';
import { UnifiedPromptBuilder } from './UnifiedPromptBuilder';
import { textChatService } from '../../services/chat/textChatService';
import type { ChatMode } from '../../store/globalChatStore';
import type { ChatAIRequest } from '../../services/chat/chatAiService';

export class ChatIntegration {
  private promptBuilder: UnifiedPromptBuilder;

  constructor() {
    this.promptBuilder = new UnifiedPromptBuilder();
  }

  /**
   * Enrich chat request with brain context
   */
  async enrichChatRequest(
    request: ChatAIRequest,
    mode: ChatMode
  ): Promise<ChatAIRequest> {
    try {
      // Check if brain is initialized before attempting to get context
      if (!brainCore.isInitialized()) {
        logger.info('CHAT_INTEGRATION', 'Brain not initialized, skipping enrichment', {
          mode,
          messageCount: request.messages.length
        });
        return request;
      }

      // Get current brain context
      const context = await brainCore.getContext();
      const userId = brainCore.getCurrentUserId();

      // Set user context for conversation persistence
      if (userId) {
        const sessionId = context.session.isActive ? context.session.sessionId : undefined;
        const appContext = {
          currentRoute: context.app.currentRoute,
          activityState: context.app.activityState,
          sessionType: context.session.isActive ? context.session.sessionType : undefined,
          exerciseName: context.session.currentExercise,
        };

        textChatService.setUserContext(userId, sessionId, appContext);

        logger.debug('CHAT_INTEGRATION', 'User context set for conversation persistence', {
          userId,
          sessionId,
          activityState: context.app.activityState
        });
      }

      logger.info('CHAT_INTEGRATION', 'Enriching chat request with brain context', {
        mode,
        messageCount: request.messages.length,
        hasContext: true,
        userId
      });

      // Find system prompt in messages
      const systemMessageIndex = request.messages.findIndex(m => m.role === 'system');

      if (systemMessageIndex === -1) {
        logger.warn('CHAT_INTEGRATION', 'No system message found in request');
        return request;
      }

      const baseSystemPrompt = request.messages[systemMessageIndex].content;

      // Build enriched system prompt
      const enrichedSystemPrompt = this.promptBuilder.buildSystemPrompt(
        context,
        baseSystemPrompt
      );

      // Create new request with enriched system prompt
      const enrichedMessages = [...request.messages];
      enrichedMessages[systemMessageIndex] = {
        role: 'system',
        content: enrichedSystemPrompt
      };

      logger.debug('CHAT_INTEGRATION', 'System prompt enriched', {
        originalLength: baseSystemPrompt.length,
        enrichedLength: enrichedSystemPrompt.length,
        addedLength: enrichedSystemPrompt.length - baseSystemPrompt.length
      });

      return {
        ...request,
        messages: enrichedMessages,
        contextData: {
          ...request.contextData,
          brainContext: {
            timestamp: context.timestamp,
            cacheKey: context.cacheKey,
            missingData: context.missingData,
            sessionActive: context.session.isActive
          }
        }
      };
    } catch (error) {
      logger.error('CHAT_INTEGRATION', 'Failed to enrich chat request', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Return original request on error
      return request;
    }
  }

  /**
   * Check if brain is ready
   */
  isBrainReady(): boolean {
    return brainCore.isInitialized();
  }

  /**
   * Get brain health status
   */
  getBrainHealth() {
    return brainCore.getHealthStatus();
  }
}

// Export singleton
export const chatIntegration = new ChatIntegration();
