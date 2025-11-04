import { supabase } from '../supabase/client';
import logger from '../../lib/utils/logger';

interface ProgressSummary {
  hasSession: boolean;
  currentStep: 'validation' | 'recipe_details_validation' | null;
  sessionId: string | null;
  updatedAt: string | null;
}

export class MealPlanProgressService {
  async getProgressSummary(userId: string): Promise<ProgressSummary> {
    try {
      const { data: session, error } = await supabase
        .from('meal_plan_generation_sessions')
        .select('id, current_step, updated_at')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .maybeSingle();

      if (error) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error fetching progress summary', { error });
        return { hasSession: false, currentStep: null, sessionId: null, updatedAt: null };
      }

      if (!session) {
        return { hasSession: false, currentStep: null, sessionId: null, updatedAt: null };
      }

      return {
        hasSession: true,
        currentStep: session.current_step as 'validation' | 'recipe_details_validation',
        sessionId: session.id,
        updatedAt: session.updated_at
      };
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in getProgressSummary', { error });
      return { hasSession: false, currentStep: null, sessionId: null, updatedAt: null };
    }
  }

  async hasActiveSession(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('meal_plan_generation_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .maybeSingle();

      if (error) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error checking active session', { error });
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in hasActiveSession', { error });
      return false;
    }
  }

  async saveSession(userId: string, sessionId: string, config: any): Promise<boolean> {
    try {
      await supabase
        .from('meal_plan_generation_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('is_completed', false);

      const { error } = await supabase
        .from('meal_plan_generation_sessions')
        .insert({
          id: sessionId,
          user_id: userId,
          config: config,
          current_step: 'validation',
          is_completed: false
        });

      if (error) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error saving session', { error, sessionId });
        return false;
      }

      logger.info('MEAL_PLAN_PROGRESS_SERVICE', 'Session saved successfully', { sessionId });
      return true;
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in saveSession', { error, sessionId });
      return false;
    }
  }

  async saveValidationProgress(sessionId: string, mealPlans: any[]): Promise<boolean> {
    try {
      await supabase
        .from('meal_plan_generation_progress')
        .delete()
        .eq('session_id', sessionId);

      const { error } = await supabase
        .from('meal_plan_generation_progress')
        .insert({
          session_id: sessionId,
          meal_plans: mealPlans
        });

      if (error) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error saving validation progress', { error, sessionId });
        return false;
      }

      logger.info('MEAL_PLAN_PROGRESS_SERVICE', 'Validation progress saved', { sessionId, plansCount: mealPlans.length });
      return true;
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in saveValidationProgress', { error, sessionId });
      return false;
    }
  }

  async saveRecipesProgress(sessionId: string, recipes: any[]): Promise<boolean> {
    try {
      await supabase
        .from('meal_plan_recipes_progress')
        .delete()
        .eq('session_id', sessionId);

      const { error } = await supabase
        .from('meal_plan_recipes_progress')
        .insert({
          session_id: sessionId,
          recipes: recipes
        });

      if (error) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error saving recipes progress', { error, sessionId });
        return false;
      }

      const { error: updateError } = await supabase
        .from('meal_plan_generation_sessions')
        .update({ current_step: 'recipe_details_validation' })
        .eq('id', sessionId);

      if (updateError) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error updating session step', { error: updateError, sessionId });
      }

      logger.info('MEAL_PLAN_PROGRESS_SERVICE', 'Recipes progress saved', { sessionId, recipesCount: recipes.length });
      return true;
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in saveRecipesProgress', { error, sessionId });
      return false;
    }
  }

  async loadValidationProgress(sessionId: string): Promise<{ config: any; mealPlans: any[] } | null> {
    try {
      const { data: session, error: sessionError } = await supabase
        .from('meal_plan_generation_sessions')
        .select('config')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError || !session) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error loading session', { error: sessionError, sessionId });
        return null;
      }

      const { data: progress, error: progressError } = await supabase
        .from('meal_plan_generation_progress')
        .select('meal_plans')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (progressError || !progress) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error loading validation progress', { error: progressError, sessionId });
        return null;
      }

      logger.info('MEAL_PLAN_PROGRESS_SERVICE', 'Validation progress loaded', { sessionId });
      return {
        config: session.config,
        mealPlans: progress.meal_plans
      };
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in loadValidationProgress', { error, sessionId });
      return null;
    }
  }

  async loadRecipesProgress(sessionId: string): Promise<{ config: any; mealPlans: any[]; recipes: any[] } | null> {
    try {
      const validationData = await this.loadValidationProgress(sessionId);
      if (!validationData) return null;

      const { data: recipes, error } = await supabase
        .from('meal_plan_recipes_progress')
        .select('recipes')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error || !recipes) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error loading recipes progress', { error, sessionId });
        return null;
      }

      logger.info('MEAL_PLAN_PROGRESS_SERVICE', 'Recipes progress loaded', { sessionId });
      return {
        ...validationData,
        recipes: recipes.recipes
      };
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in loadRecipesProgress', { error, sessionId });
      return null;
    }
  }

  async deleteProgress(sessionId: string): Promise<boolean> {
    try {
      await supabase
        .from('meal_plan_recipes_progress')
        .delete()
        .eq('session_id', sessionId);

      await supabase
        .from('meal_plan_generation_progress')
        .delete()
        .eq('session_id', sessionId);

      const { error } = await supabase
        .from('meal_plan_generation_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error deleting progress', { error, sessionId });
        return false;
      }

      logger.info('MEAL_PLAN_PROGRESS_SERVICE', 'Progress deleted successfully', { sessionId });
      return true;
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in deleteProgress', { error, sessionId });
      return false;
    }
  }

  async markSessionCompleted(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('meal_plan_generation_sessions')
        .update({ is_completed: true })
        .eq('id', sessionId);

      if (error) {
        logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Error marking session completed', { error, sessionId });
        return false;
      }

      logger.info('MEAL_PLAN_PROGRESS_SERVICE', 'Session marked as completed', { sessionId });
      return true;
    } catch (error) {
      logger.error('MEAL_PLAN_PROGRESS_SERVICE', 'Exception in markSessionCompleted', { error, sessionId });
      return false;
    }
  }
}

export const mealPlanProgressService = new MealPlanProgressService();
