/**
 * CSRF Protection Utility - Sprint 3 Phase 5.2
 *
 * Provides CSRF token generation, validation, and origin checking.
 *
 * IMPORTANT: This utility NEVER modifies AI agents or their logic.
 * It only provides security validation for requests.
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { createSecurityLogger, SecurityLogger } from './securityLogger.ts';

export interface CSRFConfig {
  allowedOrigins?: string[];
  tokenValidityMinutes?: number;
  requireOriginMatch?: boolean;
}

export interface CSRFValidationResult {
  valid: boolean;
  error?: string;
  tokenValidated?: boolean;
  originValidated?: boolean;
}

export class CSRFProtection {
  private allowedOrigins: string[];
  private tokenValidityMinutes: number;
  private requireOriginMatch: boolean;
  private securityLogger: SecurityLogger;

  constructor(
    private supabase: SupabaseClient,
    config: CSRFConfig = {}
  ) {
    this.allowedOrigins = config.allowedOrigins || this.getDefaultAllowedOrigins();
    this.tokenValidityMinutes = config.tokenValidityMinutes || 60;
    this.requireOriginMatch = config.requireOriginMatch !== false;
    this.securityLogger = createSecurityLogger(supabase);
  }

  private getDefaultAllowedOrigins(): string[] {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const origins = [supabaseUrl];

    const customOrigin = Deno.env.get('ALLOWED_ORIGIN');
    if (customOrigin) {
      origins.push(customOrigin);
    }

    return origins.filter(Boolean);
  }

  async generateToken(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.rpc('generate_csrf_token', {
        p_user_id: userId,
        p_validity_minutes: this.tokenValidityMinutes
      });

      if (error) {
        console.error('❌ [CSRFProtection] Failed to generate token:', error);
        return null;
      }

      console.log('✅ [CSRFProtection] Token generated', {
        userId,
        tokenPreview: data?.substring(0, 8) + '...',
        validityMinutes: this.tokenValidityMinutes
      });

      return data;
    } catch (err) {
      console.error('❌ [CSRFProtection] Exception generating token:', err);
      return null;
    }
  }

  async validateToken(userId: string, token: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('validate_csrf_token', {
        p_user_id: userId,
        p_token: token
      });

      if (error) {
        console.error('❌ [CSRFProtection] Failed to validate token:', error);
        return false;
      }

      return data === true;
    } catch (err) {
      console.error('❌ [CSRFProtection] Exception validating token:', err);
      return false;
    }
  }

  validateOrigin(request: Request): { valid: boolean; origin?: string; error?: string } {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    if (!origin && !referer) {
      return {
        valid: false,
        error: 'Missing origin and referer headers'
      };
    }

    const requestOrigin = origin || this.extractOriginFromReferer(referer);

    if (!requestOrigin) {
      return {
        valid: false,
        error: 'Could not determine request origin'
      };
    }

    const isAllowed = this.allowedOrigins.some(allowed =>
      this.normalizeOrigin(requestOrigin) === this.normalizeOrigin(allowed)
    );

    if (!isAllowed) {
      return {
        valid: false,
        origin: requestOrigin,
        error: `Origin not allowed: ${requestOrigin}`
      };
    }

    return {
      valid: true,
      origin: requestOrigin
    };
  }

  async validateRequest(
    userId: string,
    token: string | null,
    request: Request,
    edgeFunction: string
  ): Promise<CSRFValidationResult> {
    let tokenValid = false;
    let originValid = false;

    // Validate CSRF token if provided
    if (token) {
      tokenValid = await this.validateToken(userId, token);

      if (!tokenValid) {
        await this.securityLogger.logEvent({
          userId,
          eventType: 'csrf_validation_failed',
          severity: 'high',
          ipAddress: this.extractIpAddress(request),
          userAgent: request.headers.get('user-agent') || undefined,
          edgeFunction,
          eventData: {
            reason: 'Invalid or expired CSRF token'
          }
        });

        return {
          valid: false,
          tokenValidated: false,
          error: 'Invalid or expired CSRF token'
        };
      }
    }

    // Validate origin if required
    if (this.requireOriginMatch) {
      const originValidation = this.validateOrigin(request);
      originValid = originValidation.valid;

      if (!originValid) {
        await this.securityLogger.logEvent({
          userId,
          eventType: 'csrf_validation_failed',
          severity: 'high',
          ipAddress: this.extractIpAddress(request),
          userAgent: request.headers.get('user-agent') || undefined,
          edgeFunction,
          eventData: {
            reason: 'Origin validation failed',
            origin: originValidation.origin,
            error: originValidation.error
          }
        });

        return {
          valid: false,
          tokenValidated: tokenValid,
          originValidated: false,
          error: originValidation.error
        };
      }
    }

    return {
      valid: true,
      tokenValidated: tokenValid,
      originValidated: originValid || !this.requireOriginMatch
    };
  }

  private extractOriginFromReferer(referer: string | null): string | null {
    if (!referer) return null;

    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      return null;
    }
  }

  private normalizeOrigin(origin: string): string {
    try {
      const url = new URL(origin);
      return url.origin.toLowerCase();
    } catch {
      return origin.toLowerCase();
    }
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

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('cleanup_expired_csrf_tokens');

      if (error) {
        console.error('❌ [CSRFProtection] Failed to cleanup tokens:', error);
        return 0;
      }

      return data || 0;
    } catch (err) {
      console.error('❌ [CSRFProtection] Exception cleaning up tokens:', err);
      return 0;
    }
  }

  async getActiveTokenCount(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('get_csrf_token_count', {
        p_user_id: userId
      });

      if (error) {
        console.error('❌ [CSRFProtection] Failed to get token count:', error);
        return 0;
      }

      return data || 0;
    } catch (err) {
      console.error('❌ [CSRFProtection] Exception getting token count:', err);
      return 0;
    }
  }
}

export function createCSRFProtection(
  supabase: SupabaseClient,
  config?: CSRFConfig
): CSRFProtection {
  return new CSRFProtection(supabase, config);
}

/**
 * Simple origin validation helper for Edge Functions that don't need full CSRF protection
 */
export function validateOriginSimple(
  request: Request,
  allowedOrigins?: string[]
): { valid: boolean; error?: string } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const defaultOrigins = [supabaseUrl];

  const customOrigin = Deno.env.get('ALLOWED_ORIGIN');
  if (customOrigin) {
    defaultOrigins.push(customOrigin);
  }

  const origins = allowedOrigins || defaultOrigins.filter(Boolean);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (!origin && !referer) {
    return {
      valid: false,
      error: 'Missing origin and referer headers'
    };
  }

  const requestOrigin = origin || extractOriginFromReferer(referer);

  if (!requestOrigin) {
    return {
      valid: false,
      error: 'Could not determine request origin'
    };
  }

  const isAllowed = origins.some(allowed => {
    try {
      const allowedUrl = new URL(allowed);
      const requestUrl = new URL(requestOrigin);
      return allowedUrl.origin.toLowerCase() === requestUrl.origin.toLowerCase();
    } catch {
      return allowed.toLowerCase() === requestOrigin.toLowerCase();
    }
  });

  if (!isAllowed) {
    return {
      valid: false,
      error: `Origin not allowed: ${requestOrigin}`
    };
  }

  return { valid: true };
}

function extractOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null;

  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}
