/**
 * App Context Tracker
 * Updates BrainCore with current app context for proactive suggestions
 * Tracks route changes and activity states
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { brainCore } from '../index';
import type { ActivityState, PageContext } from '../types';
import logger from '../../../lib/utils/logger';

function getPageContextFromRoute(pathname: string): PageContext {
  if (pathname === '/' || pathname === '/home') {
    return { type: 'home' };
  }

  if (pathname.startsWith('/training')) {
    if (pathname.includes('/pipeline/preparer')) {
      return { type: 'training', subContext: 'pipeline-step-1' };
    }
    if (pathname.includes('/pipeline/activer')) {
      return { type: 'training', subContext: 'pipeline-step-2' };
    }
    if (pathname.includes('/pipeline/seance')) {
      return { type: 'training', subContext: 'pipeline-step-3' };
    }
    if (pathname.includes('/pipeline/adapter')) {
      return { type: 'training', subContext: 'pipeline-step-4' };
    }
    if (pathname.includes('/pipeline/avancer')) {
      return { type: 'training', subContext: 'pipeline-step-5' };
    }
    return { type: 'training' };
  }

  if (pathname.startsWith('/profile')) {
    return { type: 'profile' };
  }

  if (pathname.startsWith('/settings')) {
    return { type: 'settings' };
  }

  return { type: 'other' };
}

function getActivityStateFromRoute(pathname: string): ActivityState {
  if (pathname.includes('/pipeline/seance')) {
    return 'training-active';
  }

  if (pathname.includes('/pipeline/adapter') || pathname.includes('/pipeline/avancer')) {
    return 'post-training';
  }

  if (pathname.includes('/meals/scan') || pathname.includes('/meal-scan-flow')) {
    return 'meal-scan';
  }

  if (pathname.includes('/fridge-scan')) {
    return 'fridge-scan';
  }

  if (pathname.includes('/body-scan')) {
    return 'body-scan';
  }

  if (pathname.startsWith('/profile')) {
    return 'profile-editing';
  }

  return 'idle';
}

export function AppContextTracker() {
  const location = useLocation();

  useEffect(() => {
    const updateContext = () => {
      if (!brainCore.isInitialized()) {
        logger.debug('APP_CONTEXT_TRACKER', 'Brain not initialized, skipping update');
        return;
      }

      const pathname = location.pathname;
      const pageContext = getPageContextFromRoute(pathname);
      const activityState = getActivityStateFromRoute(pathname);

      brainCore.updateAppContext({
        currentRoute: pathname,
        previousRoute: null,
        pageContext,
        activityState,
        timestamp: Date.now(),
      });

      logger.debug('APP_CONTEXT_TRACKER', 'App context updated', {
        pathname,
        pageContext: pageContext.type,
        subContext: pageContext.subContext,
        activityState,
      });
    };

    updateContext();
  }, [location.pathname]);

  return null;
}
