import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { DataProvider } from './DataProvider';
import { ToastProvider } from '../../ui/components/ToastProvider';
import { DeviceProvider } from '../../system/device/DeviceProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { IllustrationCacheProvider } from '../../system/context/IllustrationCacheContext';
import { PerformanceModeProvider } from '../../system/context/PerformanceModeContext';
import { useDevicePerformance } from '../../hooks/useDevicePerformance';
import { useAutoSync } from '../../hooks/useAutoSync';
import { useTokenRefresh } from '../../hooks/useTokenRefresh';
import { useUserStore } from '../../system/store/userStore';
import logger from '../../lib/utils/logger';
import { BackgroundManager } from '../../ui/components/BackgroundManager';
import PerformanceRecommendationAlert, { usePerformanceRecommendationAlert } from '../../ui/components/PerformanceRecommendationAlert';
import { BrainInitializer } from './BrainInitializer';
import PointsGainNotification from '../../ui/components/PointsGainNotification';

// Create QueryClient with enhanced cache configuration for persistence
// Export for use in stores and services
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes - increased for better persistence
      gcTime: 8 * 60 * 60 * 1000, // 8 hours - optimized (was 24h, too aggressive for frequent data)
      retry: 1,
      refetchOnWindowFocus: false, // Prevent unnecessary refetches
      refetchOnMount: (query) => {
        // CRITICAL: Allow refetch on mount for real-time data that changes frequently
        const queryKey = query.queryKey;

        // Always refetch gamification data on mount (user just earned XP)
        if (queryKey.includes('gamification-progress')) return true;
        if (queryKey.includes('xp-events')) return true;
        if (queryKey.includes('daily-actions')) return true;

        // Always refetch meals data on mount (user just saved a meal)
        if (queryKey.includes('meals-today')) return true;
        if (queryKey.includes('meals-week')) return true;
        if (queryKey.includes('meals-recent')) return true;

        // Always refetch daily summaries (depends on meals data)
        if (queryKey.includes('daily-ai-summary')) return true;

        // Don't refetch other queries on mount
        return false;
      },
      refetchOnReconnect: false, // Prevent refetch on network reconnect
    },
    mutations: {
      retry: 1,
    },
  },
});

// Create localStorage persister for React Query cache
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'twinforge-react-query-cache',
  serialize: JSON.stringify,
  deserialize: (cachedString) => {
    try {
      // ISO 8601 date string pattern
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      
      // Reviver function to convert ISO date strings back to Date objects
      const dateReviver = (key: string, value: any) => {
        if (typeof value === 'string' && isoDateRegex.test(value)) {
          const date = new Date(value);
          // Only return the Date object if it's valid
          return isNaN(date.getTime()) ? value : date;
        }
        return value;
      };
      
      const parsed = JSON.parse(cachedString, dateReviver);
      
      // Fix invalid timestamps in queries to prevent RangeError: Invalid time value
      if (parsed && parsed.queries) {
        parsed.queries.forEach((query: any) => {
          if (query.state) {
            // Ensure dataUpdatedAt and fetchedAt are valid timestamps
            if (query.state.dataUpdatedAt === null || query.state.dataUpdatedAt === undefined) {
              query.state.dataUpdatedAt = 0;
            }
            if (query.state.fetchedAt === null || query.state.fetchedAt === undefined) {
              query.state.fetchedAt = 0;
            }
            
            // Validate timestamp values
            if (typeof query.state.dataUpdatedAt === 'number' && isNaN(query.state.dataUpdatedAt)) {
              query.state.dataUpdatedAt = 0;
            }
            if (typeof query.state.fetchedAt === 'number' && isNaN(query.state.fetchedAt)) {
              query.state.fetchedAt = 0;
            }
          }
        });
      }
      
      return parsed;
    } catch (error) {
      logger.error('REACT_QUERY_PERSISTENCE', 'Failed to deserialize cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return null;
    }
  },
});

// Initialize cache persistence
let persistenceInitialized = false;

const initializeCachePersistence = async () => {
  if (persistenceInitialized) return;
  
  try {
    logger.info('REACT_QUERY_PERSISTENCE', 'Initializing cache persistence', {
      persisterKey: 'twinforge-react-query-cache',
      storage: 'localStorage',
      timestamp: new Date().toISOString()
    });

    await persistQueryClient({
      queryClient,
      persister: localStoragePersister,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      hydrateOptions: {
        defaultOptions: {
          queries: {
            staleTime: 10 * 60 * 1000, // 10 minutes
          },
        },
      },
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          // Only persist specific query types to avoid bloating localStorage
          const queryKey = query.queryKey;
          const queryState = query.state;

          // CRITICAL: Don't persist queries that are currently fetching or in pending state
          // This prevents "CancelledError" warnings during persistence
          if (queryState.fetchStatus === 'fetching') {
            logger.debug('REACT_QUERY_PERSISTENCE', 'Skipping query in fetching state', {
              queryKey,
              fetchStatus: queryState.fetchStatus,
              timestamp: new Date().toISOString()
            });
            return false;
          }

          // Don't persist queries with errors (including CancelledError)
          if (queryState.status === 'error') {
            logger.debug('REACT_QUERY_PERSISTENCE', 'Skipping query with error state', {
              queryKey,
              status: queryState.status,
              timestamp: new Date().toISOString()
            });
            return false;
          }

          // Don't persist fasting queries - they change in real-time and cause persistence loops
          if (queryKey.includes('fasting')) return false;

          // CRITICAL FIX: Don't persist meals queries - they change frequently and refetch often
          // This eliminates CancelledError warnings during meal scanning
          if (queryKey.includes('meals-today')) return false;
          if (queryKey.includes('meals-week')) return false;
          if (queryKey.includes('meals-recent')) return false;
          if (queryKey.includes('meals-history')) return false;
          if (queryKey.includes('meals-month')) return false;

          // Persist activity insights (expensive AI calls)
          if (queryKey.includes('insights')) return true;

          // Persist activity progression data
          if (queryKey.includes('progression')) return true;

          // Persist trend analyses
          if (queryKey.includes('trend-analysis')) return true;

          // Persist daily summaries (but not meals summaries which change frequently)
          if (queryKey.includes('daily-summary')) return true;
          if (queryKey.includes('daily-ai-summary')) return false;

          // Don't persist real-time data like daily activities
          if (queryKey.includes('daily') && !queryKey.includes('summary')) return false;

          // Don't persist user profile (changes frequently)
          if (queryKey.includes('profile')) return false;

          // Default: persist other queries
          return true;
        },
      },
    });
    
    persistenceInitialized = true;
    
    logger.info('REACT_QUERY_PERSISTENCE', 'Cache persistence initialized successfully', {
      cacheSize: Object.keys(localStorage).filter(key => key.startsWith('twinforge-react-query')).length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('REACT_QUERY_PERSISTENCE', 'Failed to initialize cache persistence', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};

function PerformanceInitializer({ children }: { children: React.ReactNode }) {
  useDevicePerformance();
  return <>{children}</>;
}

function AutoSyncInitializer({ children }: { children: React.ReactNode }) {
  const { profile } = useUserStore();
  useAutoSync(profile?.id || null, { enabled: true, intervalMinutes: 60 });
  return <>{children}</>;
}

function TokenRefreshManager({ children }: { children: React.ReactNode }) {
  const { isRefreshing, lastRefresh, nextRefreshAt, failureCount } = useTokenRefresh();

  useEffect(() => {
    if (isRefreshing) {
      logger.debug('TOKEN_REFRESH_MANAGER', 'Token refresh in progress');
    }
    if (lastRefresh) {
      logger.debug('TOKEN_REFRESH_MANAGER', 'Last token refresh', {
        lastRefresh: lastRefresh.toISOString(),
        nextRefreshAt: nextRefreshAt?.toISOString(),
        failureCount,
      });
    }
  }, [isRefreshing, lastRefresh, nextRefreshAt, failureCount]);

  return <>{children}</>;
}

function PerformanceAlertManager() {
  const { showAlert, recommendation, dismissAlert } = usePerformanceRecommendationAlert();

  if (!showAlert || !recommendation) return null;

  return (
    <PerformanceRecommendationAlert
      recommendation={recommendation}
      onDismiss={dismissAlert}
      onNavigateToSettings={dismissAlert}
    />
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Initialize cache persistence on mount
  React.useEffect(() => {
    initializeCachePersistence();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <DeviceProvider>
            <PerformanceModeProvider>
              {/* Background Manager - Gère le fond selon le mode performance */}
              <BackgroundManager />
              <IllustrationCacheProvider>
                <ToastProvider>
                  <PerformanceInitializer>
                    <AutoSyncInitializer>
                      <TokenRefreshManager>
                        <BrainInitializer>
                          <PerformanceAlertManager />
                          <PointsGainNotification />
                          {children}
                        </BrainInitializer>
                      </TokenRefreshManager>
                    </AutoSyncInitializer>
                  </PerformanceInitializer>
                </ToastProvider>
              </IllustrationCacheProvider>
            </PerformanceModeProvider>
          </DeviceProvider>
        </DataProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}