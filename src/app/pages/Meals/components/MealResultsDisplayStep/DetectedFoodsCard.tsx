import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SpatialIcon from '../../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../../ui/icons/registry';

interface DetectedFoodsCardProps {
  analysisResults: any;
}

/**
 * Get color for food category
 */
function getFoodCategoryColor(category?: string): string {
  const colors = {
    protein: '#EF4444',      // Rouge pour protéines
    carbs: '#F59E0B',        // Orange pour glucides
    vegetables: '#22C55E',   // Vert pour légumes
    healthy_fats: '#8B5CF6', // Violet pour lipides sains
    dairy: '#06B6D4',        // Cyan pour produits laitiers
    fruits: '#EC4899',       // Rose pour fruits
    grains: '#D97706',       // Brun pour céréales
    default: '#10B981'       // Vert TwinForge par défaut
  };
  
  return colors[category as keyof typeof colors] || colors.default;
}

/**
 * Detected Foods Card - Liste des aliments détectés
 */
const DetectedFoodsCard: React.FC<DetectedFoodsCardProps> = ({
  analysisResults,
}) => {
  const reduceMotion = useReducedMotion();

  // Debug log to check data structure
  React.useEffect(() => {
    console.log('🍽️ DetectedFoodsCard - analysisResults:', {
      hasDetectedFoods: !!analysisResults.detected_foods,
      detectedFoodsLength: analysisResults.detected_foods?.length,
      detectedFoodsType: typeof analysisResults.detected_foods,
      detectedFoods: analysisResults.detected_foods,
      allKeys: Object.keys(analysisResults)
    });
  }, [analysisResults]);

  // Ensure detected_foods is an array
  const detectedFoods = Array.isArray(analysisResults.detected_foods)
    ? analysisResults.detected_foods
    : [];

  if (detectedFoods.length === 0) {
    return (
      <div className="detected-foods-card-container">
        <div className="flex items-center gap-3 mb-6">
          <motion.div
            className="detected-foods-header-icon"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <SpatialIcon
              Icon={ICONS.Eye}
              size={20}
              style={{ color: 'var(--nutrition-accent)' }}
            />
          </motion.div>
          <h3 className="text-xl font-bold text-white">Aliments Détectés</h3>
        </div>
        <div className="text-white/60 text-center py-4">
          Aucun aliment détecté dans cette analyse
        </div>
      </div>
    );
  }

  return (
    <div className="detected-foods-card-container">
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          className="detected-foods-header-icon"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <SpatialIcon
            Icon={ICONS.Eye}
            size={20}
            style={{ color: 'var(--nutrition-accent)' }}
          />
        </motion.div>
        <h3 className="text-xl font-bold text-white">Aliments Détectés</h3>
      </div>

      <div className="space-y-3">
        {detectedFoods.map((food: any, index: number) => (
          <motion.div
            key={index}
            className="food-item-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: reduceMotion ? 0.1 : 0.4,
              delay: reduceMotion ? 0 : 0.3 + index * 0.1
            }}
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, ${getFoodCategoryColor(food.category)} 8%, transparent) 0%, transparent 60%),
                rgba(255, 255, 255, 0.08)
              `,
              border: `2px solid color-mix(in srgb, ${getFoodCategoryColor(food.category)} 25%, transparent)`,
              boxShadow: `
                0 4px 16px rgba(0, 0, 0, 0.15),
                0 0 12px color-mix(in srgb, ${getFoodCategoryColor(food.category)} 15%, transparent),
                inset 0 1px 0 rgba(255, 255, 255, 0.12)
              `
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="food-category-indicator"
                  style={{
                    color: getFoodCategoryColor(food.category)
                  }}
                />
                <div>
                  <div className="text-white font-semibold text-lg">{food.name}</div>
                  {food.portion_size && (
                    <div className="text-white/60 text-sm mb-1">{food.portion_size}</div>
                  )}
                  <div className="text-white/70 text-sm">
                    P: {Math.round(food.proteins)}g • G: {Math.round(food.carbs)}g • L: {Math.round(food.fats)}g
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-xl">{food.calories}</div>
                <div className="text-white/70 text-sm">kcal</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DetectedFoodsCard;