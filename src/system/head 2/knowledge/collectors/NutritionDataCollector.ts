/**
 * NutritionDataCollector - Collect all nutrition data for user
 * Aggregates meals, meal plans, dietary preferences, and nutritional stats
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { NutritionKnowledge, MealSummary } from '../../types';
import { MealPlanDataCollector } from './MealPlanDataCollector';
import { ShoppingListDataCollector } from './ShoppingListDataCollector';
import { FridgeScanDataCollector } from './FridgeScanDataCollector';
import { AITrendAnalysesCollector } from './AITrendAnalysesCollector';

export class NutritionDataCollector {
  private supabase: SupabaseClient;
  private mealPlanCollector: MealPlanDataCollector;
  private shoppingListCollector: ShoppingListDataCollector;
  private fridgeScanCollector: FridgeScanDataCollector;
  private aiTrendAnalysesCollector: AITrendAnalysesCollector;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.mealPlanCollector = new MealPlanDataCollector(supabase);
    this.shoppingListCollector = new ShoppingListDataCollector(supabase);
    this.fridgeScanCollector = new FridgeScanDataCollector(supabase);
    this.aiTrendAnalysesCollector = new AITrendAnalysesCollector(supabase);
  }

  async collect(userId: string): Promise<NutritionKnowledge> {
    try {
      logger.info('NUTRITION_DATA_COLLECTOR', 'Starting nutrition data collection', { userId });

      const [mealsResult, mealPlansResult, shoppingListsResult, fridgeScansResult, aiTrendsResult, profileResult] = await Promise.allSettled([
        this.collectRecentMeals(userId),
        this.mealPlanCollector.collect(userId),
        this.shoppingListCollector.collect(userId),
        this.fridgeScanCollector.collect(userId),
        this.aiTrendAnalysesCollector.collect(userId),
        this.getUserProfile(userId)
      ]);

      const recentMeals = mealsResult.status === 'fulfilled' ? mealsResult.value : [];
      const mealPlans = mealPlansResult.status === 'fulfilled' ? mealPlansResult.value : this.getDefaultMealPlanKnowledge();
      const shoppingLists = shoppingListsResult.status === 'fulfilled' ? shoppingListsResult.value : this.getDefaultShoppingListKnowledge();
      const fridgeScans = fridgeScansResult.status === 'fulfilled' ? fridgeScansResult.value : this.getDefaultFridgeScanKnowledge();
      const aiTrends = aiTrendsResult.status === 'fulfilled' ? aiTrendsResult.value : this.getDefaultAITrendsKnowledge();
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;

      // Calculate nutrition stats from recent meals
      const { avgCalories, avgProtein } = this.calculateNutritionStats(recentMeals);

      // Get scan frequency (last 30 days)
      const lastScanDate = recentMeals.length > 0 ? recentMeals[0].date : null;
      const scanFrequency = recentMeals.length; // Total meals in last 30 days

      // Extract culinary preferences
      const culinaryPreferences = this.extractCulinaryPreferences(profile, recentMeals, fridgeScans.generatedRecipes);

      const hasData = recentMeals.length > 0 || mealPlans.hasData || shoppingLists.hasData || fridgeScans.hasData;

      logger.info('NUTRITION_DATA_COLLECTOR', 'Nutrition data collected', {
        userId,
        mealsCount: recentMeals.length,
        mealPlansActive: mealPlans.activePlans.length,
        shoppingListsActive: shoppingLists.hasActiveList,
        fridgeItemsCount: fridgeScans.totalItemsInFridge,
        fridgeScansCompleted: fridgeScans.totalScansCompleted,
        recipesCount: fridgeScans.generatedRecipes.length,
        aiTrendsCount: aiTrends.trends.length,
        aiAdviceCount: aiTrends.strategicAdvice.length,
        avgCalories,
        avgProtein,
        hasData
      });

      return {
        recentMeals,
        mealPlans,
        shoppingLists,
        fridgeScans,
        aiTrends,
        scanFrequency,
        lastScanDate,
        averageCalories: avgCalories,
        averageProtein: avgProtein,
        dietaryPreferences: profile?.dietary_preferences || [],
        culinaryPreferences,
        hasData
      };
    } catch (error) {
      logger.error('NUTRITION_DATA_COLLECTOR', 'Failed to collect nutrition data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect recent meals (last 30 days)
   */
  private async collectRecentMeals(userId: string): Promise<MealSummary[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: meals, error } = await this.supabase
      .from('meals')
      .select(`
        id, meal_name, timestamp, consumed_at, created_at,
        total_kcal, total_calories, protein_g, carbs_g, fat_g,
        meal_type, items, photo_url
      `)
      .eq('user_id', userId)
      .gte('timestamp', thirtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('NUTRITION_DATA_COLLECTOR', 'Failed to load meals', { userId, error });
      return [];
    }

    if (!meals || meals.length === 0) {
      return [];
    }

    return meals.map((meal) => {
      const items = this.parseMealItems(meal.items);

      const itemsProtein = items.reduce((sum, item) => sum + (item.proteins || 0), 0);
      const itemsCarbs = items.reduce((sum, item) => sum + (item.carbs || 0), 0);
      const itemsFats = items.reduce((sum, item) => sum + (item.fats || 0), 0);
      const itemsCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);
      const itemsFiber = items.reduce((sum, item) => sum + (item.fiber || 0), 0);
      const itemsSugar = items.reduce((sum, item) => sum + (item.sugar || 0), 0);
      const itemsSodium = items.reduce((sum, item) => sum + (item.sodium || 0), 0);

      const totalProtein = meal.protein_g || itemsProtein;
      const totalCarbs = meal.carbs_g || itemsCarbs;
      const totalFats = meal.fat_g || itemsFats;
      const totalCalories = meal.total_calories || meal.total_kcal || itemsCalories;

      return {
        id: meal.id,
        name: meal.meal_name || 'Repas',
        date: meal.timestamp,
        consumedAt: meal.consumed_at || meal.timestamp,
        createdAt: meal.created_at,
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fats: totalFats,
        fiber: itemsFiber,
        sugar: itemsSugar,
        sodium: itemsSodium,
        mealType: meal.meal_type || 'unknown',
        items,
        itemsCount: items.length,
        photoUrl: meal.photo_url || null,
        notes: undefined,
        dataCompleteness: this.calculateMealDataCompleteness(meal, items)
      };
    });
  }

  /**
   * Parse meal items from JSONB
   */
  private parseMealItems(itemsData: any): Array<{
    name: string;
    category: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    portion_size?: string;
    confidence?: number;
  }> {
    if (!itemsData || !Array.isArray(itemsData)) {
      return [];
    }

    return itemsData
      .filter(item => item && item.name)
      .map(item => ({
        name: item.name,
        category: item.category || 'unknown',
        calories: item.calories || 0,
        proteins: item.proteins || 0,
        carbs: item.carbs || 0,
        fats: item.fats || 0,
        fiber: item.fiber,
        sugar: item.sugar,
        sodium: item.sodium,
        portion_size: item.portion_size,
        confidence: item.confidence
      }));
  }


  /**
   * Get user dietary preferences from profile
   */
  private async getUserProfile(userId: string): Promise<any> {
    const { data: profile } = await this.supabase
      .from('user_profile')
      .select('nutrition')
      .eq('user_id', userId)
      .maybeSingle();

    return profile?.nutrition || {};
  }



  private getDefaultMealPlanKnowledge() {
    return {
      activePlans: [],
      recentPlans: [],
      currentWeekPlan: null,
      totalPlansGenerated: 0,
      totalPlansCompleted: 0,
      lastPlanDate: null,
      averageWeeklyPlans: 0,
      hasActivePlan: false,
      hasData: false
    };
  }

  private getDefaultShoppingListKnowledge() {
    return {
      activeList: null,
      recentLists: [],
      totalListsGenerated: 0,
      totalListsCompleted: 0,
      lastListDate: null,
      averageItemsPerList: 0,
      averageCompletionRate: 0,
      totalBudgetSpent: 0,
      hasActiveList: false,
      hasData: false
    };
  }

  private getDefaultFridgeScanKnowledge() {
    return {
      currentSession: null,
      recentSessions: [],
      currentInventory: [],
      totalItemsInFridge: 0,
      lastScanDate: null,
      totalScansCompleted: 0,
      averageItemsPerScan: 0,
      generatedRecipes: [],
      hasActiveSession: false,
      hasInventory: false,
      hasData: false
    };
  }

  private getDefaultAITrendsKnowledge() {
    return {
      trends: [],
      strategicAdvice: [],
      mealClassifications: [],
      lastAnalysisDate: null,
      analysisPeriod: '7_days' as const,
      hasData: false
    };
  }

  /**
   * Extract culinary preferences from user data
   */
  private extractCulinaryPreferences(
    profile: any,
    meals: MealSummary[],
    recipes: Array<{ cuisine: string }>
  ): {
    favoriteCuisines: string[];
    cookingSkillLevel: string;
    mealPrepTime: { weekday: number; weekend: number };
  } {
    // Extract favorite cuisines from generated recipes
    const cuisineCounts: Record<string, number> = {};
    recipes.forEach((recipe) => {
      cuisineCounts[recipe.cuisine] = (cuisineCounts[recipe.cuisine] || 0) + 1;
    });

    const favoriteCuisines = Object.entries(cuisineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cuisine]) => cuisine);

    // Get cooking skill level from profile
    const cookingSkillLevel =
      profile?.nutrition?.meal_prep_preferences?.cooking_skill || 'intermediate';

    // Get meal prep time preferences
    const mealPrepTime = {
      weekday:
        profile?.nutrition?.meal_prep_preferences?.weekday_time_min || 30,
      weekend:
        profile?.nutrition?.meal_prep_preferences?.weekend_time_min || 60
    };

    return {
      favoriteCuisines,
      cookingSkillLevel,
      mealPrepTime
    };
  }

  /**
   * Calculate average nutrition stats
   */
  private calculateNutritionStats(meals: MealSummary[]): {
    avgCalories: number;
    avgProtein: number;
  } {
    if (meals.length === 0) {
      return { avgCalories: 0, avgProtein: 0 };
    }

    const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
    const totalProtein = meals.reduce((sum, meal) => sum + meal.protein, 0);

    return {
      avgCalories: Math.round(totalCalories / meals.length),
      avgProtein: Math.round(totalProtein / meals.length)
    };
  }

  /**
   * Calculate meal data completeness score
   */
  private calculateMealDataCompleteness(meal: any, items: any[]): number {
    let score = 0;
    let maxScore = 10;

    if (meal.meal_name) score++;
    if (meal.photo_url) score++;
    if (meal.total_calories || meal.total_kcal) score++;
    if (meal.protein_g) score++;
    if (meal.carbs_g) score++;
    if (meal.fat_g) score++;
    if (items.length > 0) score += 2;
    if (items.some(item => item.fiber)) score++;
    if (meal.consumed_at) score++;

    return Math.round((score / maxScore) * 100);
  }
}
