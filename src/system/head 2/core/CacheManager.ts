/**
 * CacheManager - Intelligent Caching System
 * Manages cache with TTL and smart invalidation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../lib/utils/logger';
import type { CacheEntry, ForgeType, CacheInvalidationRule } from '../types';

const DEFAULT_TTLS: Record<ForgeType, number> = {
  training: 5 * 60 * 1000, // 5 minutes
  equipment: 30 * 60 * 1000, // 30 minutes
  nutrition: 10 * 60 * 1000, // 10 minutes (includes all culinary data)
  fasting: 10 * 60 * 1000, // 10 minutes
  'body-scan': 60 * 60 * 1000, // 1 hour
  energy: 15 * 60 * 1000, // 15 minutes
  temporal: 60 * 60 * 1000 // 1 hour
};

export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private invalidationRules: CacheInvalidationRule[];
  private supabase: SupabaseClient | null = null;
  private subscriptions: Map<string, any> = new Map();
  private isRealtimeEnabled = false;

  constructor() {
    this.cache = new Map();
    this.invalidationRules = this.initializeInvalidationRules();
  }

  /**
   * Initialize realtime subscriptions for automatic cache invalidation
   */
  enableRealtimeInvalidation(supabase: SupabaseClient): void {
    if (this.isRealtimeEnabled) {
      logger.warn('CACHE_MANAGER', 'Realtime invalidation already enabled');
      return;
    }

    this.supabase = supabase;
    this.isRealtimeEnabled = true;

    logger.info('CACHE_MANAGER', 'Enabling realtime cache invalidation');

    // Subscribe to all relevant tables
    const tables = new Set<string>();
    this.invalidationRules.forEach(rule => {
      rule.events.forEach(table => tables.add(table));
    });

    tables.forEach(table => {
      this.subscribeToTable(table);
    });

    logger.info('CACHE_MANAGER', 'Realtime cache invalidation enabled', {
      subscribedTables: tables.size
    });
  }

  /**
   * Subscribe to a specific table for cache invalidation
   */
  private subscribeToTable(table: string): void {
    if (!this.supabase) return;

    const channel = this.supabase
      .channel(`cache-invalidation-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        (payload) => {
          logger.debug('CACHE_MANAGER', 'Database change detected', {
            table,
            event: payload.eventType
          });

          // Find which forges are affected by this table
          const affectedForges = this.invalidationRules
            .filter(rule => rule.events.includes(table))
            .map(rule => rule.forge);

          // Invalidate cache for affected forges
          affectedForges.forEach(forge => {
            this.invalidateForge(forge);
          });
        }
      )
      .subscribe();

    this.subscriptions.set(table, channel);

    logger.debug('CACHE_MANAGER', 'Subscribed to table', { table });
  }

  /**
   * Disable realtime invalidation and cleanup subscriptions
   */
  disableRealtimeInvalidation(): void {
    if (!this.isRealtimeEnabled) return;

    logger.info('CACHE_MANAGER', 'Disabling realtime cache invalidation');

    // Unsubscribe from all channels
    this.subscriptions.forEach((channel, table) => {
      if (this.supabase) {
        this.supabase.removeChannel(channel);
      }
      logger.debug('CACHE_MANAGER', 'Unsubscribed from table', { table });
    });

    this.subscriptions.clear();
    this.isRealtimeEnabled = false;
    this.supabase = null;

    logger.info('CACHE_MANAGER', 'Realtime cache invalidation disabled');
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      logger.debug('CACHE_MANAGER', 'Cache entry expired', { key });
      this.cache.delete(key);
      return null;
    }

    logger.debug('CACHE_MANAGER', 'Cache hit', { key });
    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || 5 * 60 * 1000, // Default 5 minutes
      key
    };

    this.cache.set(key, entry);

    logger.debug('CACHE_MANAGER', 'Cache set', { key, ttl: entry.ttl });
  }

  /**
   * Invalidate cache for specific forge
   */
  invalidateForge(forgeType: ForgeType): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(forgeType)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    logger.info('CACHE_MANAGER', 'Forge cache invalidated', {
      forgeType,
      keysDeleted: keysToDelete.length
    });
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();

    logger.info('CACHE_MANAGER', 'All cache cleared', { entriesCleared: size });
  }

  /**
   * Invalidate cache based on a database table change
   */
  invalidateByTable(table: string): void {
    logger.debug('CACHE_MANAGER', 'Manual table invalidation', { table });

    // Find which forges are affected by this table
    const affectedForges = this.invalidationRules
      .filter(rule => rule.events.includes(table))
      .map(rule => rule.forge);

    // Invalidate cache for affected forges
    affectedForges.forEach(forge => {
      this.invalidateForge(forge);
    });

    logger.info('CACHE_MANAGER', 'Table cache invalidated', {
      table,
      affectedForges
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let freshEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp <= entry.ttl) {
        freshEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      total: this.cache.size,
      fresh: freshEntries,
      expired: expiredEntries,
      realtimeEnabled: this.isRealtimeEnabled,
      activeSubscriptions: this.subscriptions.size
    };
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    return stats.fresh > 0 || stats.total === 0;
  }

  /**
   * Initialize invalidation rules
   */
  private initializeInvalidationRules(): CacheInvalidationRule[] {
    return [
      {
        forge: 'training',
        events: ['training_sessions', 'training_feedbacks'],
        ttl: DEFAULT_TTLS.training
      },
      {
        forge: 'equipment',
        events: ['training_locations', 'equipment_detections'],
        ttl: DEFAULT_TTLS.equipment
      },
      {
        forge: 'nutrition',
        events: [
          'meals',
          'meal_plans',
          'shopping_lists',
          'shopping_list_items',
          'fridge_scan_sessions',
          'recipes'
        ],
        ttl: DEFAULT_TTLS.nutrition
      },
      {
        forge: 'fasting',
        events: ['fasting_sessions'],
        ttl: DEFAULT_TTLS.fasting
      },
      {
        forge: 'body-scan',
        events: ['body_scans', 'ai_morphology_insights'],
        ttl: DEFAULT_TTLS['body-scan']
      },
      {
        forge: 'energy',
        events: ['activities', 'activity_sessions', 'wearable_data', 'connected_devices', 'ai_analysis_jobs'],
        ttl: DEFAULT_TTLS.energy
      },
      {
        forge: 'temporal',
        events: ['user_profile'],
        ttl: DEFAULT_TTLS.temporal
      }
    ];
  }
}
