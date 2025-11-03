/**
 * Session Manager Utility - Sprint 3 Phase 4.3
 *
 * Manages concurrent sessions and enforces session limits per user.
 *
 * IMPORTANT: This utility NEVER modifies AI agents or their logic.
 * It only manages user sessions and enforces security policies.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface SessionConfig {
  maxConcurrentSessions?: number;
  sessionExpiryHours?: number;
}

export interface SessionInfo {
  sessionToken: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export class SessionManager {
  private maxConcurrentSessions: number;
  private sessionExpiryHours: number;

  constructor(
    private supabase: SupabaseClient,
    config: SessionConfig = {}
  ) {
    this.maxConcurrentSessions = config.maxConcurrentSessions || 5;
    this.sessionExpiryHours = config.sessionExpiryHours || 24;
  }

  async createSession(
    userId: string,
    request: Request
  ): Promise<{ success: boolean; sessionToken?: string; error?: string }> {
    try {
      const activeCount = await this.getActiveSessionCount(userId);

      if (activeCount >= this.maxConcurrentSessions) {
        console.warn('⚠️ [SessionManager] Max concurrent sessions reached', {
          userId,
          activeCount,
          maxAllowed: this.maxConcurrentSessions
        });

        return {
          success: false,
          error: `Maximum concurrent sessions (${this.maxConcurrentSessions}) reached. Please log out from another device.`
        };
      }

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + this.sessionExpiryHours * 60 * 60 * 1000);

      const { error } = await this.supabase
        .from('session_tracking')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          ip_address: this.extractIpAddress(request),
          user_agent: request.headers.get('user-agent') || null,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        console.error('❌ [SessionManager] Failed to create session:', error);
        return {
          success: false,
          error: 'Failed to create session'
        };
      }

      console.log('✅ [SessionManager] Session created', {
        userId,
        sessionToken: sessionToken.substring(0, 8) + '...',
        expiresAt: expiresAt.toISOString()
      });

      return {
        success: true,
        sessionToken
      };
    } catch (err) {
      console.error('❌ [SessionManager] Exception creating session:', err);
      return {
        success: false,
        error: 'Internal error creating session'
      };
    }
  }

  async validateSession(sessionToken: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('session_tracking')
        .select('user_id, expires_at')
        .eq('session_token', sessionToken)
        .single();

      if (error || !data) {
        return { valid: false };
      }

      const expiresAt = new Date(data.expires_at);
      const isExpired = expiresAt < new Date();

      if (isExpired) {
        await this.terminateSession(sessionToken);
        return { valid: false };
      }

      await this.updateSessionActivity(sessionToken);

      return {
        valid: true,
        userId: data.user_id
      };
    } catch (err) {
      console.error('❌ [SessionManager] Exception validating session:', err);
      return { valid: false };
    }
  }

  async updateSessionActivity(sessionToken: string): Promise<void> {
    try {
      await this.supabase.rpc('update_session_activity', {
        p_session_token: sessionToken
      });
    } catch (err) {
      console.error('❌ [SessionManager] Exception updating session activity:', err);
    }
  }

  async terminateSession(sessionToken: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('session_tracking')
        .delete()
        .eq('session_token', sessionToken);

      if (error) {
        console.error('❌ [SessionManager] Failed to terminate session:', error);
      }
    } catch (err) {
      console.error('❌ [SessionManager] Exception terminating session:', err);
    }
  }

  async terminateAllUserSessions(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('session_tracking')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [SessionManager] Failed to terminate user sessions:', error);
      } else {
        console.log('✅ [SessionManager] All sessions terminated for user', { userId });
      }
    } catch (err) {
      console.error('❌ [SessionManager] Exception terminating user sessions:', err);
    }
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('get_active_session_count', {
        p_user_id: userId
      });

      if (error) {
        console.error('❌ [SessionManager] Failed to get session count:', error);
        return 0;
      }

      return data || 0;
    } catch (err) {
      console.error('❌ [SessionManager] Exception getting session count:', err);
      return 0;
    }
  }

  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const { data, error } = await this.supabase
        .from('session_tracking')
        .select('session_token, user_id, ip_address, user_agent, expires_at')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [SessionManager] Failed to get user sessions:', error);
        return [];
      }

      return (data || []).map(session => ({
        sessionToken: session.session_token,
        userId: session.user_id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        expiresAt: new Date(session.expires_at)
      }));
    } catch (err) {
      console.error('❌ [SessionManager] Exception getting user sessions:', err);
      return [];
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('cleanup_expired_sessions');

      if (error) {
        console.error('❌ [SessionManager] Failed to cleanup expired sessions:', error);
        return 0;
      }

      console.log('✅ [SessionManager] Cleaned up expired sessions', { count: data });
      return data || 0;
    } catch (err) {
      console.error('❌ [SessionManager] Exception cleaning up sessions:', err);
      return 0;
    }
  }

  private extractIpAddress(request: Request): string | null {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    return null;
  }
}

export function createSessionManager(
  supabase: SupabaseClient,
  config?: SessionConfig
): SessionManager {
  return new SessionManager(supabase, config);
}
