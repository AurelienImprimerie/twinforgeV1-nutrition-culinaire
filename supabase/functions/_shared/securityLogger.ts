/**
 * Security Logger Utility - Sprint 3 Phase 4.2
 *
 * Centralized security event logging for all Edge Functions.
 *
 * IMPORTANT: This utility NEVER modifies AI agents or their logic.
 * It only logs security events to the security_logs table.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type SecurityEventType =
  | 'auth_login_success'
  | 'auth_login_failed'
  | 'auth_logout'
  | 'validation_error'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'unauthorized_access'
  | 'token_expired'
  | 'session_created'
  | 'session_terminated'
  | 'csrf_validation_failed'
  | 'input_validation_failed';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityLogParams {
  userId?: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ipAddress?: string;
  userAgent?: string;
  edgeFunction: string;
  eventData?: Record<string, any>;
}

export class SecurityLogger {
  constructor(private supabase: SupabaseClient) {}

  async logEvent(params: SecurityLogParams): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('log_security_event', {
        p_user_id: params.userId || null,
        p_event_type: params.eventType,
        p_severity: params.severity,
        p_ip_address: params.ipAddress || null,
        p_user_agent: params.userAgent || null,
        p_edge_function: params.edgeFunction,
        p_event_data: params.eventData || {}
      });

      if (error) {
        console.error('❌ [SecurityLogger] Failed to log event:', error);
      }
    } catch (err) {
      console.error('❌ [SecurityLogger] Exception logging event:', err);
    }
  }

  async logValidationError(
    edgeFunction: string,
    error: string,
    request: Request,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'input_validation_failed',
      severity: 'medium',
      ipAddress: this.extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || undefined,
      edgeFunction,
      eventData: {
        error,
        url: request.url,
        method: request.method
      }
    });
  }

  async logSuspiciousActivity(
    edgeFunction: string,
    reason: string,
    request: Request,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'suspicious_activity',
      severity: 'high',
      ipAddress: this.extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || undefined,
      edgeFunction,
      eventData: {
        reason,
        url: request.url
      }
    });
  }

  async logRateLimitExceeded(
    edgeFunction: string,
    request: Request,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'rate_limit_exceeded',
      severity: 'medium',
      ipAddress: this.extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || undefined,
      edgeFunction,
      eventData: {
        url: request.url
      }
    });
  }

  async logUnauthorizedAccess(
    edgeFunction: string,
    request: Request,
    userId?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'unauthorized_access',
      severity: 'high',
      ipAddress: this.extractIpAddress(request),
      userAgent: request.headers.get('user-agent') || undefined,
      edgeFunction,
      eventData: {
        url: request.url
      }
    });
  }

  private extractIpAddress(request: Request): string | undefined {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    return undefined;
  }
}

export function createSecurityLogger(supabase: SupabaseClient): SecurityLogger {
  return new SecurityLogger(supabase);
}
