/**
 * ShoppingListDataCollector - Collect all shopping list data for user
 * Aggregates shopping lists, items, completion stats, and budget tracking
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import type { ShoppingListKnowledge, ShoppingListSummary, ShoppingListItem } from '../../types';

export class ShoppingListDataCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async collect(userId: string): Promise<ShoppingListKnowledge> {
    try {
      logger.info('SHOPPING_LIST_COLLECTOR', 'Starting shopping list data collection', { userId });

      const [activeListResult, recentListsResult, statsResult] = await Promise.allSettled([
        this.collectActiveList(userId),
        this.collectRecentLists(userId),
        this.collectStats(userId)
      ]);

      const activeList = activeListResult.status === 'fulfilled' ? activeListResult.value : null;
      const recentLists = recentListsResult.status === 'fulfilled' ? recentListsResult.value : [];
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : {
        total: 0,
        completed: 0,
        avgItems: 0,
        avgCompletionRate: 0,
        totalBudget: 0
      };

      const lastListDate = recentLists.length > 0 ? recentLists[0].createdAt : null;
      const hasData = recentLists.length > 0 || activeList !== null;

      logger.info('SHOPPING_LIST_COLLECTOR', 'Shopping list data collected', {
        userId,
        hasActiveList: !!activeList,
        recentListsCount: recentLists.length,
        totalGenerated: stats.total,
        totalCompleted: stats.completed,
        hasData
      });

      return {
        activeList,
        recentLists,
        totalListsGenerated: stats.total,
        totalListsCompleted: stats.completed,
        lastListDate,
        averageItemsPerList: stats.avgItems,
        averageCompletionRate: stats.avgCompletionRate,
        totalBudgetSpent: stats.totalBudget,
        hasActiveList: activeList !== null,
        hasData
      };
    } catch (error) {
      logger.error('SHOPPING_LIST_COLLECTOR', 'Failed to collect shopping list data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Collect active shopping list
   */
  private async collectActiveList(userId: string): Promise<ShoppingListSummary | null> {
    const { data: lists, error } = await this.supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('SHOPPING_LIST_COLLECTOR', 'Failed to load active list', { userId, error });
      return null;
    }

    if (!lists) {
      return null;
    }

    // Load items for this list
    const items = await this.collectListItems(lists.id);

    return this.mapListToSummary(lists, items);
  }

  /**
   * Collect recent shopping lists (last 30 days)
   */
  private async collectRecentLists(userId: string): Promise<ShoppingListSummary[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: lists, error } = await this.supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('SHOPPING_LIST_COLLECTOR', 'Failed to load recent lists', { userId, error });
      return [];
    }

    if (!lists || lists.length === 0) {
      return [];
    }

    // Load items for each list in parallel
    const listsWithItems = await Promise.all(
      lists.map(async (list) => {
        const items = await this.collectListItems(list.id);
        return this.mapListToSummary(list, items);
      })
    );

    return listsWithItems;
  }

  /**
   * Collect items for a specific shopping list
   */
  private async collectListItems(listId: string): Promise<ShoppingListItem[]> {
    const { data: items, error } = await this.supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', listId)
      .order('category_name', { ascending: true })
      .order('item_name', { ascending: true });

    if (error) {
      logger.error('SHOPPING_LIST_COLLECTOR', 'Failed to load list items', { listId, error });
      return [];
    }

    if (!items || items.length === 0) {
      return [];
    }

    return items.map(item => ({
      id: item.id,
      categoryName: item.category_name,
      categoryIcon: item.category_icon || 'Package',
      categoryColor: item.category_color || '#fb923c',
      itemName: item.item_name,
      quantity: item.quantity || '1',
      priority: item.priority || 'medium',
      isChecked: item.is_checked || false,
      estimatedPriceCents: item.estimated_price_cents || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  }

  /**
   * Collect statistics
   */
  private async collectStats(userId: string): Promise<{
    total: number;
    completed: number;
    avgItems: number;
    avgCompletionRate: number;
    totalBudget: number;
  }> {
    // Total lists generated
    const { count: totalCount } = await this.supabase
      .from('shopping_lists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Completed lists
    const { count: completedCount } = await this.supabase
      .from('shopping_lists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    // Get recent lists to calculate averages
    const { data: recentLists } = await this.supabase
      .from('shopping_lists')
      .select('total_items, completed_count, estimated_budget_cents')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    let avgItems = 0;
    let avgCompletionRate = 0;
    let totalBudget = 0;

    if (recentLists && recentLists.length > 0) {
      const totalItems = recentLists.reduce((sum, list) => sum + (list.total_items || 0), 0);
      avgItems = Math.round(totalItems / recentLists.length);

      const completionRates = recentLists
        .filter(list => list.total_items > 0)
        .map(list => (list.completed_count || 0) / list.total_items);

      if (completionRates.length > 0) {
        avgCompletionRate = Number(
          (completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length).toFixed(2)
        );
      }

      totalBudget = recentLists
        .filter(list => list.status === 'completed')
        .reduce((sum, list) => sum + (list.estimated_budget_cents || 0), 0);
    }

    return {
      total: totalCount || 0,
      completed: completedCount || 0,
      avgItems,
      avgCompletionRate,
      totalBudget
    };
  }

  /**
   * Map database list to ShoppingListSummary
   */
  private mapListToSummary(list: any, items: ShoppingListItem[]): ShoppingListSummary {
    return {
      id: list.id,
      sessionId: list.session_id,
      title: list.title || 'Liste de Courses',
      status: list.status || 'active',
      isArchived: list.is_archived || false,
      totalItems: list.total_items || items.length,
      completedCount: list.completed_count || items.filter(i => i.isChecked).length,
      estimatedBudgetCents: list.estimated_budget_cents || 0,
      advice: list.advice,
      items,
      mealPlanId: list.meal_plan_id,
      createdAt: list.created_at,
      updatedAt: list.updated_at
    };
  }
}
