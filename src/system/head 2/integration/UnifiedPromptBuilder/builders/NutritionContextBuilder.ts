import type { UserKnowledge } from '../../../types';

export class NutritionContextBuilder {
  buildNutritionContext(user: UserKnowledge): string[] {
    const parts: string[] = [];

    if (!user.nutrition.hasData) {
      return parts;
    }

    parts.push('\n### NUTRITION & CONTEXTE CULINAIRE');

    if (user.nutrition.recentMeals.length > 0) {
      parts.push(`\n  🍽️ Repas Scannés:`);
      parts.push(`    • Total récents: ${user.nutrition.recentMeals.length} enregistrés`);

      const lastMeals = user.nutrition.recentMeals.slice(0, 3);
      lastMeals.forEach((meal, idx) => {
        const date = new Date(meal.date).toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' });
        parts.push(`    ${idx + 1}. ${meal.name} (${meal.mealType}) - ${date}`);
        parts.push(`       Calories: ${meal.calories} kcal | Protéines: ${Math.round(meal.protein)}g | Glucides: ${Math.round(meal.carbs)}g | Lipides: ${Math.round(meal.fats)}g`);

        if (meal.items && meal.items.length > 0) {
          const itemNames = meal.items.map(item => item.name).join(', ');
          parts.push(`       Aliments: ${itemNames}`);
        }
      });
    }

    if (user.nutrition.averageCalories > 0) {
      parts.push(`    • Apport moyen: ${Math.round(user.nutrition.averageCalories)} kcal/jour`);
    }

    if (user.nutrition.averageProtein > 0) {
      parts.push(`    • Protéines moyennes: ${Math.round(user.nutrition.averageProtein)}g/jour`);
    }

    if (user.nutrition.dietaryPreferences.length > 0) {
      parts.push(`    • Préférences alimentaires: ${user.nutrition.dietaryPreferences.join(', ')}`);
    }

    if (user.nutrition.scanFrequency > 0) {
      parts.push(`    • Fréquence de scan: ${user.nutrition.scanFrequency} repas/30 jours`);
    }

    if (user.nutrition.mealPlans.hasData) {
      parts.push('\n  📋 Plans Alimentaires:');
      if (user.nutrition.mealPlans.hasActivePlan) {
        parts.push(`    • Plans actifs: ${user.nutrition.mealPlans.activePlans.length}`);
        if (user.nutrition.mealPlans.currentWeekPlan) {
          const plan = user.nutrition.mealPlans.currentWeekPlan;
          parts.push(`    • Plan de la semaine: "${plan.title}" (${plan.weekNumber}e semaine)`);
          if (plan.batchCookingEnabled) {
            parts.push(`    • Batch cooking activé`);
          }
          if (plan.nutritionalSummary.averageCaloriesPerDay) {
            parts.push(`    • Cible: ${Math.round(plan.nutritionalSummary.averageCaloriesPerDay)} kcal/jour`);
          }

          if (plan.recipes && plan.recipes.length > 0) {
            parts.push(`    • Recettes du plan (${plan.recipes.length} au total):`);

            const recipesByDate: Record<string, typeof plan.recipes> = {};
            plan.recipes.forEach(recipe => {
              if (!recipesByDate[recipe.date]) {
                recipesByDate[recipe.date] = [];
              }
              recipesByDate[recipe.date].push(recipe);
            });

            const dates = Object.keys(recipesByDate).sort().slice(0, 3);
            dates.forEach(date => {
              const dayRecipes = recipesByDate[date];
              const recipeTitles = dayRecipes.map(r => `${r.title} (${r.mealType})`).join(', ');
              parts.push(`      - ${date}: ${recipeTitles}`);
            });

            if (Object.keys(recipesByDate).length > 3) {
              parts.push(`      ... et ${Object.keys(recipesByDate).length - 3} autres jours`);
            }
          }
        }
      }
      parts.push(`    • Total générés: ${user.nutrition.mealPlans.totalPlansGenerated}`);
      parts.push(`    • Complétés: ${user.nutrition.mealPlans.totalPlansCompleted}`);
      if (user.nutrition.mealPlans.averageWeeklyPlans > 0) {
        parts.push(`    • Fréquence: ${user.nutrition.mealPlans.averageWeeklyPlans.toFixed(1)} plans/semaine`);
      }
    }

    if (user.nutrition.shoppingLists.hasData) {
      parts.push('\n  🛒 Listes de Courses:');
      if (user.nutrition.shoppingLists.hasActiveList) {
        const list = user.nutrition.shoppingLists.activeList!;
        const progress = list.totalItems > 0
          ? Math.round((list.completedCount / list.totalItems) * 100)
          : 0;
        parts.push(`    • Liste active: "${list.title}" (${list.completedCount}/${list.totalItems} items, ${progress}%)`);
        if (list.estimatedBudgetCents > 0) {
          const budget = (list.estimatedBudgetCents / 100).toFixed(2);
          parts.push(`    • Budget estimé: ${budget}€`);
        }

        const criticalItems = list.items.filter(item => item.priority === 'high' && !item.isChecked);
        if (criticalItems.length > 0) {
          parts.push(`    • Items prioritaires restants: ${criticalItems.slice(0, 3).map(i => i.itemName).join(', ')}`);
        }
      }
      parts.push(`    • Total générées: ${user.nutrition.shoppingLists.totalListsGenerated}`);
      parts.push(`    • Complétées: ${user.nutrition.shoppingLists.totalListsCompleted}`);
      if (user.nutrition.shoppingLists.averageCompletionRate > 0) {
        const rate = (user.nutrition.shoppingLists.averageCompletionRate * 100).toFixed(0);
        parts.push(`    • Taux de complétion: ${rate}%`);
      }
    }

    if (user.nutrition.fridgeScans.hasData) {
      parts.push('\n  🧊 Inventaire Frigo:');

      if (user.nutrition.fridgeScans.hasInventory) {
        parts.push(`    • ✅ Inventaire disponible: ${user.nutrition.fridgeScans.totalItemsInFridge} items`);

        if (user.nutrition.fridgeScans.currentInventory.length > 0) {
          const itemsByCategory: Record<string, string[]> = {};

          user.nutrition.fridgeScans.currentInventory.forEach(item => {
            const category = item.category || 'autre';
            if (!itemsByCategory[category]) {
              itemsByCategory[category] = [];
            }
            itemsByCategory[category].push(item.name);
          });

          const categoryEmojis: Record<string, string> = {
            'proteine': '🍗',
            'legume': '🥬',
            'fruit': '🍎',
            'feculent': '🌾',
            'produit_laitier': '🥛',
            'condiment': '🧂',
            'autre': '📦'
          };

          let totalDisplayed = 0;
          const maxDisplay = 30;

          Object.entries(itemsByCategory).forEach(([category, items]) => {
            if (totalDisplayed >= maxDisplay) return;

            const emoji = categoryEmojis[category] || '📦';
            const displayItems = items.slice(0, Math.min(items.length, maxDisplay - totalDisplayed));
            totalDisplayed += displayItems.length;

            parts.push(`    ${emoji} ${category} (${items.length}): ${displayItems.join(', ')}`);
          });

          if (user.nutrition.fridgeScans.totalItemsInFridge > maxDisplay) {
            const remaining = user.nutrition.fridgeScans.totalItemsInFridge - maxDisplay;
            parts.push(`    ... et ${remaining} autres items`);
          }
        }
      } else if (user.nutrition.fridgeScans.hasActiveSession) {
        parts.push(`    • 📸 Scan en cours: ${user.nutrition.fridgeScans.currentSession?.stage}`);
      } else {
        parts.push(`    • Aucun inventaire disponible - propose de scanner le frigo`);
      }

      parts.push(`    • Scans complétés: ${user.nutrition.fridgeScans.totalScansCompleted}`);

      if (user.nutrition.fridgeScans.generatedRecipes.length > 0) {
        parts.push(`    • Recettes générées: ${user.nutrition.fridgeScans.generatedRecipes.length}`);
        const topRecipes = user.nutrition.fridgeScans.generatedRecipes
          .slice(0, 3)
          .map(r => r.title)
          .join(', ');
        parts.push(`    • Récentes: ${topRecipes}`);
      }
    }

    if (user.nutrition.culinaryPreferences.favoriteCuisines.length > 0) {
      parts.push('\n  👨‍🍳 Préférences Culinaires:');
      parts.push(`    • Cuisines favorites: ${user.nutrition.culinaryPreferences.favoriteCuisines.join(', ')}`);
      parts.push(`    • Niveau de cuisine: ${user.nutrition.culinaryPreferences.cookingSkillLevel}`);
      parts.push(`    • Temps disponible: ${user.nutrition.culinaryPreferences.mealPrepTime.weekday}min (semaine), ${user.nutrition.culinaryPreferences.mealPrepTime.weekend}min (weekend)`);
    }

    if (user.nutrition.aiTrends && user.nutrition.aiTrends.hasData) {
      parts.push('\n  🤖 Analyses IA & Tendances Nutritionnelles:');
      const analysisDate = user.nutrition.aiTrends.lastAnalysisDate
        ? new Date(user.nutrition.aiTrends.lastAnalysisDate).toLocaleDateString('fr-FR')
        : 'N/A';
      parts.push(`    • Dernière analyse: ${analysisDate} (période: ${user.nutrition.aiTrends.analysisPeriod === '7_days' ? '7 jours' : '30 jours'})`);

      if (user.nutrition.aiTrends.trends.length > 0) {
        parts.push('\n    📊 Tendances détectées:');
        const topTrends = user.nutrition.aiTrends.trends.slice(0, 3);
        topTrends.forEach((trend, idx) => {
          const impactEmoji = trend.impact === 'positive' ? '✅' : trend.impact === 'negative' ? '⚠️' : 'ℹ️';
          parts.push(`      ${idx + 1}. ${impactEmoji} ${trend.pattern} (confiance: ${Math.round(trend.confidence * 100)}%)`);
          parts.push(`         ${trend.description.substring(0, 120)}${trend.description.length > 120 ? '...' : ''}`);
          if (trend.recommendations.length > 0) {
            parts.push(`         → ${trend.recommendations[0]}`);
          }
        });
      }

      const highPriorityAdvice = user.nutrition.aiTrends.strategicAdvice.filter(a => a.priority === 'high');
      if (highPriorityAdvice.length > 0) {
        parts.push('\n    💡 Conseils Stratégiques Prioritaires:');
        highPriorityAdvice.slice(0, 2).forEach((advice, idx) => {
          const categoryEmoji = advice.category === 'nutrition' ? '🥗' :
                               advice.category === 'timing' ? '⏰' :
                               advice.category === 'balance' ? '⚖️' : '🎯';
          const timeframeText = advice.timeframe === 'immediate' ? 'immédiat' :
                                advice.timeframe === 'short_term' ? 'court terme' : 'long terme';
          parts.push(`      ${idx + 1}. ${categoryEmoji} [${timeframeText}] ${advice.advice}`);
        });
      }

      if (user.nutrition.aiTrends.mealClassifications.length > 0) {
        const excellent = user.nutrition.aiTrends.mealClassifications.filter(m => m.classification === 'excellent').length;
        const proteinRich = user.nutrition.aiTrends.mealClassifications.filter(m => m.classification === 'protein_rich').length;
        const needsImprovement = user.nutrition.aiTrends.mealClassifications.filter(m => m.classification === 'needs_improvement').length;
        const total = user.nutrition.aiTrends.mealClassifications.length;

        parts.push('\n    🍽️ Qualité des Repas:');
        parts.push(`      • Excellents: ${excellent}/${total} | Riches en protéines: ${proteinRich}/${total} | À améliorer: ${needsImprovement}/${total}`);
      }
    }

    return parts;
  }
}
