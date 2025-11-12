/*
  # Add XP Rewards for Forge Culinaire & Forge Nutritionnelle

  1. Overview
    - Connects culinary and nutritional forges to the gaming system
    - Defines XP rewards for each forge action
    - Enables daily action tracking for forge activities

  2. Actions Defined
    Forge Nutritionnelle (Nutritional Forge):
    - meal_scan: 25 XP - Scan a meal photo
    - barcode_scan: 25 XP - Scan a product barcode
    - daily_recap_viewed: 10 XP - View daily nutrition summary
    - trend_analysis_viewed: 10 XP - View nutrition trends

    Forge Culinaire (Culinary Forge):
    - fridge_scan: 30 XP - Scan fridge and generate inventory
    - recipe_generated: 20 XP - Generate a recipe
    - meal_plan_generated: 35 XP - Generate a meal plan
    - shopping_list_generated: 15 XP - Generate shopping list

  3. Notes
    - Uses existing daily_actions_completion table
    - XP is awarded once per action per day (first occurrence)
    - Multiple occurrences track progress but don't award XP
    - Integrates with existing gamification system
*/

-- No new tables needed, using existing daily_actions_completion table
-- This migration documents the action_id values and XP rewards

-- Create a reference view for documentation purposes
CREATE OR REPLACE VIEW forge_action_xp_rewards AS
SELECT * FROM (
  VALUES
    -- Forge Nutritionnelle
    ('meal_scan', 'Forge Nutritionnelle', 'Scan a meal', 25),
    ('barcode_scan', 'Forge Nutritionnelle', 'Scan a barcode', 25),
    ('daily_recap_viewed', 'Forge Nutritionnelle', 'View daily recap', 10),
    ('trend_analysis_viewed', 'Forge Nutritionnelle', 'View trend analysis', 10),

    -- Forge Culinaire
    ('fridge_scan', 'Forge Culinaire', 'Scan fridge', 30),
    ('recipe_generated', 'Forge Culinaire', 'Generate recipe', 20),
    ('meal_plan_generated', 'Forge Culinaire', 'Generate meal plan', 35),
    ('shopping_list_generated', 'Forge Culinaire', 'Generate shopping list', 15)
) AS t(action_id, forge_name, action_description, xp_reward);

-- Grant access to the view
GRANT SELECT ON forge_action_xp_rewards TO authenticated;

-- Comment for documentation
COMMENT ON VIEW forge_action_xp_rewards IS 'Reference view showing XP rewards for Forge Culinaire and Forge Nutritionnelle actions';
