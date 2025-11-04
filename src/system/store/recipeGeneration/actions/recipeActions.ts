import logger from '../../../../lib/utils/logger';
import type { RecipeGenerationPipelineState } from '../types';

export const createRecipeActions = (
  set: (partial: Partial<RecipeGenerationPipelineState>) => void,
  get: () => RecipeGenerationPipelineState
) => ({
  saveRecipes: async () => {
    const state = get();

    logger.info('RECIPE_GENERATION_PIPELINE', 'Saving recipes to database', {
      sessionId: state.currentSessionId,
      recipeCount: state.recipeCandidates.length,
      timestamp: new Date().toISOString()
    });

    try {
      const { supabase } = await import('../../../supabase/client');
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User must be authenticated to save recipes');
      }

      // Get or create recipe_session
      let sessionId = state.currentSessionId;

      if (!sessionId) {
        // Create new session
        const { data: newSession, error: sessionError } = await supabase
          .from('recipe_sessions')
          .insert({
            user_id: user.id,
            inventory_final: []
          })
          .select('id')
          .single();

        if (sessionError || !newSession) {
          throw new Error('Failed to create recipe session');
        }

        sessionId = newSession.id;
      }

      // Save recipes to database
      const recipesToSave = state.recipeCandidates
        .filter(recipe => recipe.status === 'ready')
        .map(recipe => ({
          session_id: sessionId,
          user_id: user.id,
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prep_time_min: recipe.prepTimeMin,
          cook_time_min: recipe.cookTimeMin,
          servings: recipe.servings,
          dietary_tags: recipe.dietaryTags,
          nutritional_info: recipe.nutritionalInfo,
          image_url: recipe.imageUrl,
          image_signature: recipe.imageSignature,
          reasons: recipe.reasons
        }));

      const { error: recipesError } = await supabase
        .from('recipes')
        .insert(recipesToSave);

      if (recipesError) {
        throw recipesError;
      }

      // Update session with selected recipe IDs
      const recipeIds = state.recipeCandidates.map(r => r.id);
      await supabase
        .from('recipe_sessions')
        .update({ selected_recipe_ids: recipeIds })
        .eq('id', sessionId);

      logger.info('RECIPE_GENERATION_PIPELINE', 'Recipes saved successfully', {
        sessionId,
        savedCount: recipesToSave.length,
        timestamp: new Date().toISOString()
      });

      // Reset pipeline after save
      get().resetPipeline();

    } catch (error) {
      logger.error('RECIPE_GENERATION_PIPELINE', 'Failed to save recipes', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  },

  discardRecipes: () => {
    logger.info('RECIPE_GENERATION_PIPELINE', 'Discarding recipes', {
      sessionId: get().currentSessionId,
      recipeCount: get().recipeCandidates.length,
      timestamp: new Date().toISOString()
    });

    set({
      recipeCandidates: [],
      currentStep: 'configuration',
      simulatedOverallProgress: 0,
      loadingState: 'idle',
      loadingMessage: ''
    });
  },

  updateRecipeImageUrlInCandidates: (
    recipeId: string,
    imageUrl?: string,
    isGeneratingImage: boolean = false,
    hasError: boolean = false
  ) => {
    const currentCandidates = get().recipeCandidates;
    const updatedCandidates = currentCandidates.map(recipe => {
      if (recipe.id === recipeId) {
        return {
          ...recipe,
          imageUrl,
          isGeneratingImage,
          imageGenerationError: hasError
        };
      }
      return recipe;
    });
    set({ recipeCandidates: updatedCandidates });
  }
});
