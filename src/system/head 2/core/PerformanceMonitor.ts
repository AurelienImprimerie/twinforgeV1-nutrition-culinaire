/**
 * Performance Monitor for Head System
 * Tracks metrics, health checks, and error logs
 * Provides debugging and optimization insights
 */

import { supabase } from '../../supabase/client';
import logger from '../../../lib/utils/logger';

export interface PerformanceMetric {
  operationType: string;
  operationName: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
  startedAt: Date;
}

export interface HealthCheck {
  subsystem: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTimeMs?: number;
  message?: string;
  metadata?: Record<string, any>;
  dependenciesStatus?: Record<string, string>;
}

export interface ErrorLog {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  operation?: string;
  subsystem?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceStatistics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  operationsByType: Record<string, {
    count: number;
    avgDurationMs: number;
  }>;
}

export interface HealthStatus {
  [subsystem: string]: {
    status: string;
    responseTimeMs?: number;
    message?: string;
    checkedAt: Date;
  };
}

export class PerformanceMonitor {
  private userId: string | null = null;
  private metricsBuffer: PerformanceMetric[] = [];
  private healthBuffer: HealthCheck[] = [];
  private errorBuffer: ErrorLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds
  private readonly BATCH_SIZE = 20;

  constructor() {
    this.startAutoFlush();
  }

  /**
   * Initialize monitor with user ID
   */
  initialize(userId: string): void {
    this.userId = userId;
    logger.info('PERFORMANCE_MONITOR', 'Initialized', { userId });
  }

  /**
   * Record a performance metric
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    if (!this.userId) {
      logger.warn('PERFORMANCE_MONITOR', 'Cannot record metric - not initialized');
      return;
    }

    this.metricsBuffer.push(metric);

    logger.debug('PERFORMANCE_MONITOR', 'Metric recorded', {
      operationType: metric.operationType,
      durationMs: metric.durationMs,
      success: metric.success,
    });

    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      await this.flushMetrics();
    }
  }

  /**
   * Record a health check
   */
  async recordHealthCheck(healthCheck: HealthCheck): Promise<void> {
    if (!this.userId) {
      logger.warn('PERFORMANCE_MONITOR', 'Cannot record health check - not initialized');
      return;
    }

    this.healthBuffer.push(healthCheck);

    logger.debug('PERFORMANCE_MONITOR', 'Health check recorded', {
      subsystem: healthCheck.subsystem,
      status: healthCheck.status,
    });

    if (this.healthBuffer.length >= this.BUFFER_SIZE) {
      await this.flushHealthChecks();
    }
  }

  /**
   * Record an error
   */
  async recordError(errorLog: ErrorLog): Promise<void> {
    if (!this.userId) {
      logger.warn('PERFORMANCE_MONITOR', 'Cannot record error - not initialized');
      return;
    }

    this.errorBuffer.push(errorLog);

    logger.error('PERFORMANCE_MONITOR', errorLog.errorMessage, {
      errorType: errorLog.errorType,
      severity: errorLog.severity,
      subsystem: errorLog.subsystem,
      operation: errorLog.operation,
      stackTrace: errorLog.stackTrace ? errorLog.stackTrace.substring(0, 200) : undefined
    });

    // Flush immediately for high/critical errors
    if (errorLog.severity === 'high' || errorLog.severity === 'critical') {
      await this.flushErrors();
    } else if (this.errorBuffer.length >= this.BUFFER_SIZE) {
      await this.flushErrors();
    }
  }

  /**
   * Flush all buffers to database
   */
  async flushAll(): Promise<void> {
    await Promise.all([
      this.flushMetrics(),
      this.flushHealthChecks(),
      this.flushErrors(),
    ]);
  }

  /**
   * Get performance statistics
   */
  async getStatistics(hours: number = 24): Promise<PerformanceStatistics> {
    if (!this.userId) {
      logger.warn('PERFORMANCE_MONITOR', 'Cannot get statistics - not initialized');
      return this.getEmptyStatistics();
    }

    try {
      const { data, error } = await supabase.rpc('get_performance_statistics', {
        p_user_id: this.userId,
        p_hours: hours,
      });

      if (error) {
        logger.error('PERFORMANCE_MONITOR', 'RPC error getting statistics', { error });
        return this.getEmptyStatistics();
      }

      // Handle case where data is null or empty
      if (!data) {
        logger.info('PERFORMANCE_MONITOR', 'No performance data available yet');
        return this.getEmptyStatistics();
      }

      // Map snake_case from SQL to camelCase for TypeScript
      return {
        totalOperations: Number(data.total_operations) || 0,
        successfulOperations: Number(data.successful_operations) || 0,
        failedOperations: Number(data.failed_operations) || 0,
        averageDurationMs: Number(data.average_duration_ms) || 0,
        p95DurationMs: Number(data.p95_duration_ms) || 0,
        p99DurationMs: Number(data.p99_duration_ms) || 0,
        operationsByType: data.operations_by_type || {},
      };
    } catch (error) {
      logger.error('PERFORMANCE_MONITOR', 'Exception getting statistics', { error });
      return this.getEmptyStatistics();
    }
  }

  /**
   * Get latest health status for all subsystems
   */
  async getHealthStatus(): Promise<HealthStatus | null> {
    if (!this.userId) {
      logger.warn('PERFORMANCE_MONITOR', 'Cannot get health status - not initialized');
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('get_latest_health_status', {
        p_user_id: this.userId,
      });

      if (error) throw error;

      return data as HealthStatus;
    } catch (error) {
      logger.error('PERFORMANCE_MONITOR', 'Error getting health status', { error });
      return null;
    }
  }

  /**
   * Get recent error logs
   */
  async getRecentErrors(limit: number = 50): Promise<ErrorLog[]> {
    if (!this.userId) {
      logger.warn('PERFORMANCE_MONITOR', 'Cannot get errors - not initialized');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('head_error_logs')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(row => ({
        errorType: row.error_type,
        errorMessage: row.error_message,
        stackTrace: row.stack_trace,
        operation: row.operation,
        subsystem: row.subsystem,
        metadata: row.metadata,
        severity: row.severity,
      }));
    } catch (error) {
      logger.error('PERFORMANCE_MONITOR', 'Error getting error logs', { error });
      return [];
    }
  }

  /**
   * Create a performance timer for easy tracking
   */
  startTimer(operationType: string, operationName: string): () => Promise<void> {
    const startTime = Date.now();

    return async (success: boolean = true, errorMessage?: string, metadata?: Record<string, any>) => {
      const durationMs = Date.now() - startTime;

      await this.recordMetric({
        operationType,
        operationName,
        durationMs,
        success,
        errorMessage,
        metadata,
        startedAt: new Date(startTime),
      });
    };
  }

  /**
   * Cleanup and stop monitoring
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flushAll().catch(error => {
      logger.error('PERFORMANCE_MONITOR', 'Error flushing on destroy', { error });
    });

    logger.info('PERFORMANCE_MONITOR', 'Destroyed');
  }

  // Private methods

  private getEmptyStatistics(): PerformanceStatistics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDurationMs: 0,
      p95DurationMs: 0,
      p99DurationMs: 0,
      operationsByType: {},
    };
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushAll();
    }, this.FLUSH_INTERVAL_MS);
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0 || !this.userId) return;

    const toFlush = this.metricsBuffer.splice(0, this.BATCH_SIZE);

    try {
      const rows = toFlush.map(metric => ({
        user_id: this.userId,
        operation_type: metric.operationType,
        operation_name: metric.operationName,
        duration_ms: metric.durationMs,
        success: metric.success,
        error_message: metric.errorMessage,
        metadata: metric.metadata || {},
        started_at: metric.startedAt.toISOString(),
      }));

      const { error } = await supabase
        .from('head_performance_metrics')
        .insert(rows);

      if (error) throw error;

      logger.debug('PERFORMANCE_MONITOR', 'Flushed metrics', { count: rows.length });
    } catch (error) {
      logger.error('PERFORMANCE_MONITOR', 'Error flushing metrics', { error });
      // Put back in buffer on error
      this.metricsBuffer.unshift(...toFlush);
    }
  }

  private async flushHealthChecks(): Promise<void> {
    if (this.healthBuffer.length === 0 || !this.userId) return;

    const toFlush = this.healthBuffer.splice(0, this.BATCH_SIZE);

    try {
      const rows = toFlush.map(check => ({
        user_id: this.userId,
        subsystem: check.subsystem,
        status: check.status,
        response_time_ms: check.responseTimeMs,
        message: check.message,
        metadata: check.metadata || {},
        dependencies_status: check.dependenciesStatus || {},
      }));

      const { error } = await supabase
        .from('head_health_checks')
        .insert(rows);

      if (error) throw error;

      logger.debug('PERFORMANCE_MONITOR', 'Flushed health checks', { count: rows.length });
    } catch (error) {
      logger.error('PERFORMANCE_MONITOR', 'Error flushing health checks', { error });
      this.healthBuffer.unshift(...toFlush);
    }
  }

  private async flushErrors(): Promise<void> {
    if (this.errorBuffer.length === 0 || !this.userId) return;

    const toFlush = this.errorBuffer.splice(0, this.BATCH_SIZE);

    try {
      const rows = toFlush.map(errorLog => ({
        user_id: this.userId,
        error_type: errorLog.errorType,
        error_message: errorLog.errorMessage,
        stack_trace: errorLog.stackTrace,
        operation: errorLog.operation,
        subsystem: errorLog.subsystem,
        metadata: errorLog.metadata || {},
        severity: errorLog.severity,
      }));

      const { error } = await supabase
        .from('head_error_logs')
        .insert(rows);

      if (error) throw error;

      logger.debug('PERFORMANCE_MONITOR', 'Flushed error logs', { count: rows.length });
    } catch (error) {
      logger.error('PERFORMANCE_MONITOR', 'Error flushing error logs', { error });
      this.errorBuffer.unshift(...toFlush);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
