import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import logger from '../../../lib/utils/logger';

import type { RecipeGenerationPipelineState } from './types';
import { RECIPE_GENERATION_STEPS, STORAGE_KEY, DEFAULT_RECIPE_COUNT } from './constants';

import { createGenerationActions } from './actions/generationActions';
import { createNavigationActions } from './actions/navigationActions';
import { createRecipeActions } from './actions/recipeActions';

export const useRecipeGenerationPipeline = create<RecipeGenerationPipelineState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 'configuration',
      isActive: false,
      currentSessionId: null,
      simulatedOverallProgress: 0,
      recipeCandidates: [],
      loadingState: 'idle',
      loadingMessage: '',
      steps: RECIPE_GENERATION_STEPS,
      config: {
        selectedInventoryId: null,
        recipeCount: DEFAULT_RECIPE_COUNT
      },

      // Integrate all actions
      ...createGenerationActions(set, get),
      ...createNavigationActions(set, get),
      ...createRecipeActions(set, get),

      // Config actions
      setConfig: (config) => {
        set(state => ({
          config: { ...state.config, ...config }
        }));

        logger.debug('RECIPE_GENERATION_PIPELINE', 'Config updated', {
          config: get().config,
          timestamp: new Date().toISOString()
        });
      },

      // Loading state action
      setLoadingState: (state: 'idle' | 'generating' | 'streaming') => {
        set({ loadingState: state });

        logger.debug('RECIPE_GENERATION_PIPELINE', 'Loading state updated', {
          newLoadingState: state,
          timestamp: new Date().toISOString()
        });
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
        currentSessionId: state.currentSessionId
      })
    }
  )
);

// Export types for external use
export type {
  RecipeGenerationStep,
  RecipeGenerationStepData,
  RecipeGenerationPipelineState
} from './types';
export { RECIPE_GENERATION_STEPS, RECIPE_COUNT_OPTIONS } from './constants';
