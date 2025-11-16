/**
 * Health Check Service
 * Monitors subsystem health and availability
 * Provides diagnostic information for debugging
 */

import type { HealthCheck } from './PerformanceMonitor';
import { performanceMonitor } from './PerformanceMonitor';
import { supabase } from '../../supabase/client';
import logger from '../../../lib/utils/logger';

interface SubsystemHealthChecker {
  name: string;
  check: () => Promise<HealthCheck>;
}

export class HealthCheckService {
  private checkers: SubsystemHealthChecker[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 300000; // 5 minutes

  constructor() {
    this.registerDefaultCheckers();
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.checkInterval) {
      logger.warn('HEALTH_CHECK_SERVICE', 'Already started');
      return;
    }

    // Run initial check
    this.runAllChecks().catch(error => {
      logger.error('HEALTH_CHECK_SERVICE', 'Error in initial health check', { error });
    });

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runAllChecks().catch(error => {
        logger.error('HEALTH_CHECK_SERVICE', 'Error in periodic health check', { error });
      });
    }, this.CHECK_INTERVAL_MS);

    logger.info('HEALTH_CHECK_SERVICE', 'Started');
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info('HEALTH_CHECK_SERVICE', 'Stopped');
  }

  /**
   * Run all registered health checks
   */
  async runAllChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];

    for (const checker of this.checkers) {
      try {
        const result = await checker.check();
        results.push(result);
        await performanceMonitor.recordHealthCheck(result);
      } catch (error) {
        const errorResult: HealthCheck = {
          subsystem: checker.name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        results.push(errorResult);
        await performanceMonitor.recordHealthCheck(errorResult);
      }
    }

    logger.info('HEALTH_CHECK_SERVICE', 'Completed health checks', {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
    });

    return results;
  }

  /**
   * Run a specific health check
   */
  async runCheck(subsystemName: string): Promise<HealthCheck | null> {
    const checker = this.checkers.find(c => c.name === subsystemName);

    if (!checker) {
      logger.warn('HEALTH_CHECK_SERVICE', 'Checker not found', { subsystemName });
      return null;
    }

    try {
      const result = await checker.check();
      await performanceMonitor.recordHealthCheck(result);
      return result;
    } catch (error) {
      const errorResult: HealthCheck = {
        subsystem: checker.name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      await performanceMonitor.recordHealthCheck(errorResult);
      return errorResult;
    }
  }

  /**
   * Register a custom health checker
   */
  registerChecker(checker: SubsystemHealthChecker): void {
    this.checkers.push(checker);
    logger.debug('HEALTH_CHECK_SERVICE', 'Registered checker', { name: checker.name });
  }

  // Private methods

  private registerDefaultCheckers(): void {
    // Supabase connection check
    this.registerChecker({
      name: 'supabase',
      check: async () => {
        const start = Date.now();

        try {
          const { error } = await supabase
            .from('user_profile')
            .select('user_id')
            .limit(1);

          const responseTimeMs = Date.now() - start;

          if (error) {
            return {
              subsystem: 'supabase',
              status: 'unhealthy',
              responseTimeMs,
              message: `Database error: ${error.message}`,
            };
          }

          return {
            subsystem: 'supabase',
            status: responseTimeMs < 500 ? 'healthy' : 'degraded',
            responseTimeMs,
            message: responseTimeMs < 500 ? 'Connection OK' : 'Slow response time',
          };
        } catch (error) {
          return {
            subsystem: 'supabase',
            status: 'unhealthy',
            responseTimeMs: Date.now() - start,
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });

    // Browser storage check
    this.registerChecker({
      name: 'browser_storage',
      check: async () => {
        const start = Date.now();

        try {
          const testKey = '__health_check__';
          const testValue = Date.now().toString();

          localStorage.setItem(testKey, testValue);
          const retrieved = localStorage.getItem(testKey);
          localStorage.removeItem(testKey);

          const responseTimeMs = Date.now() - start;

          if (retrieved !== testValue) {
            return {
              subsystem: 'browser_storage',
              status: 'unhealthy',
              responseTimeMs,
              message: 'Storage read/write mismatch',
            };
          }

          return {
            subsystem: 'browser_storage',
            status: 'healthy',
            responseTimeMs,
            message: 'Storage OK',
          };
        } catch (error) {
          return {
            subsystem: 'browser_storage',
            status: 'unhealthy',
            responseTimeMs: Date.now() - start,
            message: error instanceof Error ? error.message : 'Storage unavailable',
          };
        }
      },
    });

    // Memory check
    this.registerChecker({
      name: 'memory',
      check: async () => {
        const start = Date.now();

        try {
          // @ts-ignore - performance.memory is Chrome-specific
          if (performance.memory) {
            // @ts-ignore
            const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
            const usagePercent = (usedJSHeapSize / jsHeapSizeLimit) * 100;

            return {
              subsystem: 'memory',
              status: usagePercent < 70 ? 'healthy' : usagePercent < 85 ? 'degraded' : 'unhealthy',
              responseTimeMs: Date.now() - start,
              message: `${usagePercent.toFixed(1)}% heap used`,
              metadata: {
                usedMB: Math.round(usedJSHeapSize / 1024 / 1024),
                limitMB: Math.round(jsHeapSizeLimit / 1024 / 1024),
              },
            };
          }

          return {
            subsystem: 'memory',
            status: 'unknown',
            responseTimeMs: Date.now() - start,
            message: 'Memory API not available',
          };
        } catch (error) {
          return {
            subsystem: 'memory',
            status: 'unknown',
            responseTimeMs: Date.now() - start,
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });

    // Network connectivity check
    this.registerChecker({
      name: 'network',
      check: async () => {
        const start = Date.now();

        try {
          const online = navigator.onLine;

          if (!online) {
            return {
              subsystem: 'network',
              status: 'unhealthy',
              responseTimeMs: Date.now() - start,
              message: 'Offline',
            };
          }

          // @ts-ignore - connection API is experimental
          const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

          if (connection) {
            const effectiveType = connection.effectiveType;
            const status = effectiveType === '4g' ? 'healthy' : effectiveType === '3g' ? 'degraded' : 'unhealthy';

            return {
              subsystem: 'network',
              status,
              responseTimeMs: Date.now() - start,
              message: `Connection: ${effectiveType}`,
              metadata: {
                effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
              },
            };
          }

          return {
            subsystem: 'network',
            status: 'healthy',
            responseTimeMs: Date.now() - start,
            message: 'Online',
          };
        } catch (error) {
          return {
            subsystem: 'network',
            status: 'unknown',
            responseTimeMs: Date.now() - start,
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });

    logger.info('HEALTH_CHECK_SERVICE', 'Registered default health checkers', {
      count: this.checkers.length,
    });
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();
