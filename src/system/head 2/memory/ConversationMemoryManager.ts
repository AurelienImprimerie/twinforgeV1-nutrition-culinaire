/**
 * ConversationMemoryManager - Persistent Chat & Voice History
 * Manages conversation history storage and retrieval for contextual coaching
 */

import { supabase } from '../../supabase/client';
import logger from '../../../lib/utils/logger';

export interface ConversationMessage {
  id: string;
  userId: string;
  sessionId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: 'text' | 'voice' | 'system';
  context?: {
    currentRoute?: string;
    activityState?: string;
    sessionType?: string;
    exerciseName?: string;
    setNumber?: number;
  };
  metadata?: Record<string, any>;
  timestamp: number;
  createdAt: string;
}

export interface ConversationSummary {
  totalMessages: number;
  textMessages: number;
  voiceMessages: number;
  systemMessages: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
}

export interface StoredConversationSummary {
  id: string;
  userId: string;
  sessionId?: string;
  summaryText: string;
  messageCount: number;
  startTimestamp: number;
  endTimestamp: number;
  keyTopics: string[];
  createdAt: string;
}

export interface ConversationContextWindow {
  summary?: {
    text: string;
    messageCount: number;
    keyTopics: string[];
    timeRange: {
      start: number;
      end: number;
    };
  };
  recentMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    messageType: 'text' | 'voice' | 'system';
    timestamp: number;
  }>;
  totalMessageCount: number;
}

export class ConversationMemoryManager {
  private memoryCache: Map<string, ConversationMessage[]> = new Map();
  private maxCacheSize = 50;
  private cacheExpiration = 5 * 60 * 1000; // 5 minutes

  constructor() {
    logger.info('CONVERSATION_MEMORY', 'ConversationMemoryManager initialized');
  }

  /**
   * Save a conversation message
   */
  async saveMessage(message: Omit<ConversationMessage, 'id' | 'createdAt'>): Promise<ConversationMessage | null> {
    try {
      const { data, error } = await supabase
        .from('conversation_history')
        .insert({
          user_id: message.userId,
          session_id: message.sessionId,
          role: message.role,
          content: message.content,
          message_type: message.messageType,
          context: message.context || {},
          metadata: message.metadata || {},
          timestamp: message.timestamp,
        })
        .select()
        .single();

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to save message', {
          error: error.message,
          userId: message.userId,
        });
        return null;
      }

      const savedMessage: ConversationMessage = {
        id: data.id,
        userId: data.user_id,
        sessionId: data.session_id,
        role: data.role,
        content: data.content,
        messageType: data.message_type,
        context: data.context,
        metadata: data.metadata,
        timestamp: data.timestamp,
        createdAt: data.created_at,
      };

      // Invalidate cache for this user
      this.memoryCache.delete(message.userId);

      logger.debug('CONVERSATION_MEMORY', 'Message saved', {
        messageId: savedMessage.id,
        userId: message.userId,
        messageType: message.messageType,
      });

      return savedMessage;
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception saving message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get conversation history for a user
   */
  async getHistory(
    userId: string,
    options: {
      sessionId?: string;
      limit?: number;
      offset?: number;
      messageType?: 'text' | 'voice' | 'system';
      since?: Date;
    } = {}
  ): Promise<ConversationMessage[]> {
    try {
      const cacheKey = `${userId}-${options.sessionId || 'all'}-${options.limit || 'all'}`;

      // Check cache
      const cached = this.memoryCache.get(cacheKey);
      if (cached) {
        logger.debug('CONVERSATION_MEMORY', 'Returning cached history', {
          userId,
          messageCount: cached.length,
        });
        return cached;
      }

      // Build query
      let query = supabase
        .from('conversation_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (options.sessionId) {
        query = query.eq('session_id', options.sessionId);
      }

      if (options.messageType) {
        query = query.eq('message_type', options.messageType);
      }

      if (options.since) {
        query = query.gte('timestamp', options.since.getTime());
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to get history', {
          error: error.message,
          userId,
        });
        return [];
      }

      const messages: ConversationMessage[] = (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        messageType: row.message_type,
        context: row.context,
        metadata: row.metadata,
        timestamp: row.timestamp,
        createdAt: row.created_at,
      }));

      // Reverse to get chronological order
      messages.reverse();

      // Cache the result
      this.memoryCache.set(cacheKey, messages);

      logger.debug('CONVERSATION_MEMORY', 'History retrieved', {
        userId,
        messageCount: messages.length,
      });

      return messages;
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception getting history', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get recent conversation context (for AI prompts)
   */
  async getRecentContext(
    userId: string,
    sessionId?: string,
    limit: number = 10
  ): Promise<ConversationMessage[]> {
    return this.getHistory(userId, { sessionId, limit });
  }

  /**
   * Get conversation summary
   */
  async getSummary(userId: string, sessionId?: string): Promise<ConversationSummary> {
    try {
      let query = supabase
        .from('conversation_history')
        .select('message_type, timestamp, created_at')
        .eq('user_id', userId);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to get summary', {
          error: error.message,
          userId,
        });
        return {
          totalMessages: 0,
          textMessages: 0,
          voiceMessages: 0,
          systemMessages: 0,
        };
      }

      const messages = data || [];
      const textMessages = messages.filter((m) => m.message_type === 'text').length;
      const voiceMessages = messages.filter((m) => m.message_type === 'voice').length;
      const systemMessages = messages.filter((m) => m.message_type === 'system').length;

      const timestamps = messages.map((m) => new Date(m.created_at).getTime());
      const firstMessageAt = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : undefined;
      const lastMessageAt = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : undefined;

      return {
        totalMessages: messages.length,
        textMessages,
        voiceMessages,
        systemMessages,
        firstMessageAt,
        lastMessageAt,
      };
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception getting summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalMessages: 0,
        textMessages: 0,
        voiceMessages: 0,
        systemMessages: 0,
      };
    }
  }

  /**
   * Delete conversation history
   */
  async deleteHistory(userId: string, sessionId?: string): Promise<boolean> {
    try {
      let query = supabase.from('conversation_history').delete().eq('user_id', userId);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { error } = await query;

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to delete history', {
          error: error.message,
          userId,
        });
        return false;
      }

      // Clear cache
      this.memoryCache.clear();

      logger.info('CONVERSATION_MEMORY', 'History deleted', {
        userId,
        sessionId,
      });

      return true;
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception deleting history', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Clear memory cache
   */
  clearCache(): void {
    this.memoryCache.clear();
    logger.debug('CONVERSATION_MEMORY', 'Cache cleared');
  }

  /**
   * Cleanup old messages (retention policy)
   */
  async cleanupOldMessages(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await supabase
        .from('conversation_history')
        .delete()
        .lt('timestamp', cutoffDate.getTime())
        .select('id');

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to cleanup old messages', {
          error: error.message,
        });
        return 0;
      }

      const deletedCount = data?.length || 0;

      logger.info('CONVERSATION_MEMORY', 'Old messages cleaned up', {
        deletedCount,
        retentionDays,
      });

      return deletedCount;
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception cleaning up messages', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get conversation context window (summary + recent messages)
   * Optimized for AI prompts - limited to last 20 messages + summary
   */
  async getContextWindow(
    userId: string,
    sessionId?: string,
    recentMessagesLimit: number = 20
  ): Promise<ConversationContextWindow> {
    try {
      const { data, error } = await supabase.rpc('get_conversation_context_with_summary', {
        p_user_id: userId,
        p_session_id: sessionId || null,
        p_recent_messages_limit: recentMessagesLimit,
      });

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to get context window', {
          error: error.message,
          userId,
        });
        return {
          recentMessages: [],
          totalMessageCount: 0,
        };
      }

      logger.debug('CONVERSATION_MEMORY', 'Context window retrieved', {
        userId,
        hasSummary: !!data?.summary,
        recentMessageCount: data?.recent_messages?.length || 0,
        totalMessages: data?.total_message_count || 0,
      });

      return {
        summary: data?.summary || undefined,
        recentMessages: data?.recent_messages || [],
        totalMessageCount: data?.total_message_count || 0,
      };
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception getting context window', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        recentMessages: [],
        totalMessageCount: 0,
      };
    }
  }

  /**
   * Create conversation summary
   * Should be called periodically (e.g., after 50 messages or at session end)
   */
  async createSummary(
    userId: string,
    sessionId: string | undefined,
    summaryText: string,
    options: {
      messageCount: number;
      startTimestamp: number;
      endTimestamp: number;
      keyTopics?: string[];
    }
  ): Promise<StoredConversationSummary | null> {
    try {
      const { data, error } = await supabase
        .from('conversation_summaries')
        .insert({
          user_id: userId,
          session_id: sessionId,
          summary_text: summaryText,
          message_count: options.messageCount,
          start_timestamp: options.startTimestamp,
          end_timestamp: options.endTimestamp,
          key_topics: options.keyTopics || [],
        })
        .select()
        .single();

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to create summary', {
          error: error.message,
          userId,
        });
        return null;
      }

      logger.info('CONVERSATION_MEMORY', 'Summary created', {
        summaryId: data.id,
        userId,
        messageCount: options.messageCount,
      });

      return {
        id: data.id,
        userId: data.user_id,
        sessionId: data.session_id,
        summaryText: data.summary_text,
        messageCount: data.message_count,
        startTimestamp: data.start_timestamp,
        endTimestamp: data.end_timestamp,
        keyTopics: data.key_topics || [],
        createdAt: data.created_at,
      };
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception creating summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get latest summary for a user/session
   */
  async getLatestSummary(
    userId: string,
    sessionId?: string
  ): Promise<StoredConversationSummary | null> {
    try {
      const { data, error } = await supabase.rpc('get_latest_conversation_summary', {
        p_user_id: userId,
        p_session_id: sessionId || null,
      });

      if (error) {
        logger.error('CONVERSATION_MEMORY', 'Failed to get latest summary', {
          error: error.message,
          userId,
        });
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const summary = data[0];

      return {
        id: summary.id,
        userId,
        sessionId: sessionId,
        summaryText: summary.summary_text,
        messageCount: summary.message_count,
        startTimestamp: summary.start_timestamp,
        endTimestamp: summary.end_timestamp,
        keyTopics: summary.key_topics || [],
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception getting latest summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Check if summary should be created
   * Returns true if more than 50 unsummarized messages exist
   */
  async shouldCreateSummary(userId: string, sessionId?: string): Promise<boolean> {
    try {
      const latestSummary = await this.getLatestSummary(userId, sessionId);

      const { data, error } = await supabase
        .from('conversation_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        return false;
      }

      const totalMessages = (data as any)?.count || 0;

      if (!latestSummary) {
        return totalMessages >= 50;
      }

      // Count messages after last summary
      const { data: newMessagesData, error: newMessagesError } = await supabase
        .from('conversation_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('timestamp', latestSummary.endTimestamp);

      if (newMessagesError) {
        return false;
      }

      const unsummarizedCount = (newMessagesData as any)?.count || 0;

      return unsummarizedCount >= 50;
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception checking if summary needed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get conversation statistics
   */
  async getStatistics(userId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    mostActiveHour: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('conversation_history')
        .select('session_id, timestamp')
        .eq('user_id', userId);

      if (error || !data) {
        return {
          totalConversations: 0,
          totalMessages: 0,
          avgMessagesPerSession: 0,
          mostActiveHour: 0,
        };
      }

      const uniqueSessions = new Set(data.filter((m) => m.session_id).map((m) => m.session_id));
      const totalConversations = uniqueSessions.size;
      const totalMessages = data.length;
      const avgMessagesPerSession = totalConversations > 0 ? totalMessages / totalConversations : 0;

      // Calculate most active hour
      const hourCounts = new Map<number, number>();
      data.forEach((m) => {
        const hour = new Date(m.timestamp).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });

      let mostActiveHour = 0;
      let maxCount = 0;
      hourCounts.forEach((count, hour) => {
        if (count > maxCount) {
          maxCount = count;
          mostActiveHour = hour;
        }
      });

      return {
        totalConversations,
        totalMessages,
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
        mostActiveHour,
      };
    } catch (error) {
      logger.error('CONVERSATION_MEMORY', 'Exception getting statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalConversations: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        mostActiveHour: 0,
      };
    }
  }
}

// Export singleton instance
export const conversationMemoryManager = new ConversationMemoryManager();
