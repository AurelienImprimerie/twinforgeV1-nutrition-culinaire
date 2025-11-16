/**
 * FridgeScanDataCollector - Collect detailed fridge scan data for user
 * Aggregates scan sessions, inventory, recipes, and scan statistics
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { FridgeScanKnowledge, FridgeScanSessionDetailed, FridgeInventoryItem } from '../../types';

export class FridgeScanDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<FridgeScanKnowledge> {
    try {
      logger.info('FRIDGE_SCAN_COLLECTOR', 'Starting fridge scan data collection', { userId });

      const [currentSessionResult, recentSessionsResult, statsResult] = await Promise.allSettled([
        this.collectCurrentSession(userId),
        this.collectRecentSessions(userId),
        this.collectStats(userId)
      ]);

      const currentSession = currentSessionResult.status === 'fulfilled' ? currentSessionResult.value : null;
      const recentSessions = recentSessionsResult.status === 'fulfilled' ? recentSessionsResult.value : [];
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : {
        totalCompleted: 0,
        avgItems: 0
      };

      // Extract current inventory: priority to most recent session with inventory
      // Check if there's a non-completed session with inventory first
      let currentInventory: FridgeInventoryItem[] = [];

      // Try to get inventory from most recent session (completed or not) with user_edited_inventory
      const { data: sessionWithInventory } = await this.supabase
        .from('fridge_scan_sessions')
        .select('user_edited_inventory')
        .eq('user_id', userId)
        .not('user_edited_inventory', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionWithInventory && sessionWithInventory.user_edited_inventory) {
        currentInventory = this.parseInventoryItems(sessionWithInventory.user_edited_inventory);
      }

      // Extract all generated recipes from recent sessions
      const generatedRecipes = this.extractGeneratedRecipes(recentSessions);

      const lastScanDate = recentSessions.length > 0 ? recentSessions[0].createdAt : null;
      const hasData = recentSessions.length > 0 || currentSession !== null;

      logger.info('FRIDGE_SCAN_COLLECTOR', 'Fridge scan data collected', {
        userId,
        hasCurrentSession: !!currentSession,
        currentSessionStage: currentSession?.stage,
        recentSessionsCount: recentSessions.length,
        currentInventoryItems: currentInventory.length,
        generatedRecipesCount: generatedRecipes.length,
        totalCompleted: stats.totalCompleted,
        hasData
      });

      return {
        currentSession,
        recentSessions,
        currentInventory,
        totalItemsInFridge: currentInventory.length,
        lastScanDate,
        totalScansCompleted: stats.totalCompleted,
        averageItemsPerScan: stats.avgItems,
        generatedRecipes,
        hasActiveSession: currentSession !== null && !currentSession.completed,
        hasInventory: currentInventory.length > 0,
        hasData
      };
    } catch (error) {
      logger.error('FRIDGE_SCAN_COLLECTOR', 'Failed to collect fridge scan data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect current active session (not completed)
   * IMPORTANT: A session with user_edited_inventory filled is NOT considered active
   * even if completed=false, because the inventory is already available
   */
  private async collectCurrentSession(userId: string): Promise<FridgeScanSessionDetailed | null> {
    const { data: session, error } = await this.supabase
      .from('fridge_scan_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('FRIDGE_SCAN_COLLECTOR', 'Failed to load current session', { userId, error });
      return null;
    }

    if (!session) {
      return null;
    }

    // Check if user_edited_inventory has content
    const userEditedInventory = session.user_edited_inventory;
    const hasInventoryContent = Array.isArray(userEditedInventory) && userEditedInventory.length > 0;

    // If inventory is filled, this is NOT an active session anymore
    // The user has already completed the scan and validated the inventory
    if (hasInventoryContent) {
      logger.info('FRIDGE_SCAN_COLLECTOR', 'Session has inventory content, not considering it as active', {
        userId,
        sessionId: session.session_id,
        inventoryItems: userEditedInventory.length,
        stage: session.stage
      });
      return null;
    }

    return this.mapSessionToDetailed(session);
  }

  /**
   * Collect recent completed sessions (last 10)
   */
  private async collectRecentSessions(userId: string): Promise<FridgeScanSessionDetailed[]> {
    const { data: sessions, error } = await this.supabase
      .from('fridge_scan_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('FRIDGE_SCAN_COLLECTOR', 'Failed to load recent sessions', { userId, error });
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    return sessions.map(session => this.mapSessionToDetailed(session));
  }

  /**
   * Collect statistics
   */
  private async collectStats(userId: string): Promise<{
    totalCompleted: number;
    avgItems: number;
  }> {
    // Total completed scans
    const { count: totalCompleted } = await this.supabase
      .from('fridge_scan_sessions')
      .select('session_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true);

    // Get recent sessions to calculate average items
    const { data: recentSessions } = await this.supabase
      .from('fridge_scan_sessions')
      .select('user_edited_inventory')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(10);

    let avgItems = 0;
    if (recentSessions && recentSessions.length > 0) {
      const totalItems = recentSessions.reduce((sum, session) => {
        const inventory = session.user_edited_inventory as any[];
        return sum + (Array.isArray(inventory) ? inventory.length : 0);
      }, 0);
      avgItems = Math.round(totalItems / recentSessions.length);
    }

    return {
      totalCompleted: totalCompleted || 0,
      avgItems
    };
  }

  /**
   * Map database session to FridgeScanSessionDetailed
   */
  private mapSessionToDetailed(session: any): FridgeScanSessionDetailed {
    const capturedPhotos = this.parsePhotos(session.captured_photos);
    const rawDetectedItems = this.parseInventoryItems(session.raw_detected_items);
    const userEditedInventory = this.parseInventoryItems(session.user_edited_inventory);
    const suggestedComplementaryItems = this.parseInventoryItems(session.suggested_complementary_items);
    const recipeCandidates = this.parseRecipeCandidates(session.recipe_candidates);
    const selectedRecipes = this.parseSelectedRecipes(session.selected_recipes);

    return {
      sessionId: session.session_id,
      userId: session.user_id,
      stage: session.stage || 'photo',
      completed: session.completed || false,
      capturedPhotos,
      rawDetectedItems,
      userEditedInventory,
      suggestedComplementaryItems,
      recipeCandidates,
      selectedRecipes,
      mealPlan: session.meal_plan,
      metadata: session.metadata || {},
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      expiresAt: session.expires_at
    };
  }

  /**
   * Parse photos array
   */
  private parsePhotos(photosData: any): Array<{ url: string; timestamp: string }> {
    if (!photosData || !Array.isArray(photosData)) {
      return [];
    }

    return photosData
      .filter(photo => photo && photo.url)
      .map(photo => ({
        url: photo.url,
        timestamp: photo.timestamp || new Date().toISOString()
      }));
  }

  /**
   * Parse inventory items array
   */
  private parseInventoryItems(itemsData: any): FridgeInventoryItem[] {
    if (!itemsData || !Array.isArray(itemsData)) {
      return [];
    }

    return itemsData
      .filter(item => item && (item.name || item.label))
      .map(item => ({
        id: item.id || `item-${Math.random()}`,
        name: item.name || item.label || 'Inconnu',
        label: item.label || item.name || 'Inconnu',
        category: item.category || 'autre',
        quantity: item.quantity || item.estimatedQuantity || '1',
        estimatedQuantity: item.estimatedQuantity,
        expirationDate: item.expirationDate,
        confidence: item.confidence
      }));
  }

  /**
   * Parse recipe candidates array
   */
  private parseRecipeCandidates(recipesData: any): Array<{
    id: string;
    title: string;
    cuisine: string;
    cookingTime: number;
    difficulty: string;
    ingredients: string[];
    matchScore?: number;
  }> {
    if (!recipesData || !Array.isArray(recipesData)) {
      return [];
    }

    return recipesData
      .filter(recipe => recipe && recipe.title)
      .map(recipe => ({
        id: recipe.id || `recipe-${Math.random()}`,
        title: recipe.title,
        cuisine: recipe.cuisine || 'international',
        cookingTime: recipe.cookingTime || recipe.cooking_time || 30,
        difficulty: recipe.difficulty || 'medium',
        ingredients: recipe.ingredients || [],
        matchScore: recipe.matchScore || recipe.match_score
      }));
  }

  /**
   * Parse selected recipes array
   */
  private parseSelectedRecipes(selectedData: any): string[] {
    if (!selectedData || !Array.isArray(selectedData)) {
      return [];
    }

    return selectedData.filter(id => typeof id === 'string');
  }

  /**
   * Extract all generated recipes from recent sessions
   */
  private extractGeneratedRecipes(sessions: FridgeScanSessionDetailed[]): Array<{
    id: string;
    title: string;
    cuisine: string;
    cookingTime: number;
    difficulty: string;
    createdAt: string;
  }> {
    const allRecipes: Array<{
      id: string;
      title: string;
      cuisine: string;
      cookingTime: number;
      difficulty: string;
      createdAt: string;
    }> = [];

    sessions.forEach(session => {
      session.recipeCandidates.forEach(recipe => {
        allRecipes.push({
          id: recipe.id,
          title: recipe.title,
          cuisine: recipe.cuisine,
          cookingTime: recipe.cookingTime,
          difficulty: recipe.difficulty,
          createdAt: session.createdAt
        });
      });
    });

    // Return top 20 most recent unique recipes
    const uniqueRecipes = Array.from(
      new Map(allRecipes.map(recipe => [recipe.id, recipe])).values()
    );

    return uniqueRecipes.slice(0, 20);
  }
}
