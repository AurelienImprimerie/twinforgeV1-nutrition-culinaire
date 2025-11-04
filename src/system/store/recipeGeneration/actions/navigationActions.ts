import logger from '../../../../lib/utils/logger';
import type { RecipeGenerationPipelineState, RecipeGenerationStep } from '../types';
import { RECIPE_GENERATION_STEPS } from '../constants';

export const createNavigationActions = (
  set: (partial: Partial<RecipeGenerationPipelineState>) => void,
  get: () => RecipeGenerationPipelineState
) => ({
  startPipeline: () => {
    const sessionId = crypto.randomUUID();

    logger.info('RECIPE_GENERATION_PIPELINE', 'Starting new pipeline', {
      sessionId,
      timestamp: new Date().toISOString()
    });

    set({
      currentStep: 'configuration',
      isActive: true,
      currentSessionId: sessionId,
      simulatedOverallProgress: 0,
      recipeCandidates: [],
      loadingState: 'idle',
      loadingMessage: ''
    });
  },

  goToStep: (step: RecipeGenerationStep) => {
    const stepData = RECIPE_GENERATION_STEPS.find(s => s.id === step);

    logger.info('RECIPE_GENERATION_PIPELINE', 'Navigating to step', {
      step,
      sessionId: get().currentSessionId,
      timestamp: new Date().toISOString()
    });

    set({
      currentStep: step,
      simulatedOverallProgress: stepData?.startProgress || 0
    });
  },

  resetPipeline: () => {
    logger.info('RECIPE_GENERATION_PIPELINE', 'Resetting pipeline', {
      sessionId: get().currentSessionId,
      timestamp: new Date().toISOString()
    });

    set({
      currentStep: 'configuration',
      isActive: false,
      currentSessionId: null,
      simulatedOverallProgress: 0,
      recipeCandidates: [],
      loadingState: 'idle',
      loadingMessage: '',
      config: {
        selectedInventoryId: null,
        recipeCount: 4
      }
    });
  }
});
