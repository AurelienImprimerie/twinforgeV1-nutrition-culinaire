import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import CustomDropdown from '../../../pages/Fridge/tabs/RecipesTab/components/CustomDropdown';
import {
  RECIPE_COUNT_OPTIONS,
  CUISINE_TYPES,
  DIFFICULTY_LEVELS,
  MEAL_TYPES
} from '../../../../system/store/recipeGeneration';

interface ConfigurationStageProps {
  availableInventories: any[];
  selectedInventoryId: string | null;
  recipeCount: number;
  cuisineTypes?: string[];
  difficultyLevel?: 'easy' | 'medium' | 'advanced';
  maxPrepTime?: number;
  mealTypes?: string[];
  onSelectInventory: (inventoryId: string) => void;
  onSetRecipeCount: (count: number) => void;
  onSetCuisineTypes: (types: string[]) => void;
  onSetDifficultyLevel: (level: 'easy' | 'medium' | 'advanced') => void;
  onSetMaxPrepTime: (time: number) => void;
  onSetMealTypes: (types: string[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const ConfigurationStage: React.FC<ConfigurationStageProps> = ({
  availableInventories,
  selectedInventoryId,
  recipeCount,
  cuisineTypes = [],
  difficultyLevel = 'medium',
  maxPrepTime = 60,
  mealTypes = [],
  onSelectInventory,
  onSetRecipeCount,
  onSetCuisineTypes,
  onSetDifficultyLevel,
  onSetMaxPrepTime,
  onSetMealTypes,
  onGenerate,
  isGenerating
}) => {
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  // Auto-select the latest inventory on mount
  useEffect(() => {
    if (!selectedInventoryId && availableInventories.length > 0) {
      const latestInventory = availableInventories.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      onSelectInventory(latestInventory.id);
    }
  }, [availableInventories, selectedInventoryId, onSelectInventory]);

  const selectedInventory = availableInventories.find(inv => inv.id === selectedInventoryId);
  const hasValidInventory = selectedInventory && selectedInventory.inventory_final?.length > 0;

  const recipeCountOptions = RECIPE_COUNT_OPTIONS.map(option => ({
    value: option.value.toString(),
    label: option.label
  }));

  const difficultyOptions = DIFFICULTY_LEVELS.map(level => ({
    value: level.value,
    label: level.label
  }));

  const toggleCuisineType = (type: string) => {
    if (cuisineTypes.includes(type)) {
      onSetCuisineTypes(cuisineTypes.filter(t => t !== type));
    } else {
      onSetCuisineTypes([...cuisineTypes, type]);
    }
  };

  const toggleMealType = (type: string) => {
    if (mealTypes.includes(type)) {
      onSetMealTypes(mealTypes.filter(t => t !== type));
    } else {
      onSetMealTypes([...mealTypes, type]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Configuration Card */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5 }
        })}
      >
        <GlassCard
          className="p-8"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, color-mix(in srgb, #10B981 12%, transparent) 0%, transparent 60%),
              radial-gradient(circle at 70% 80%, color-mix(in srgb, #34D399 8%, transparent) 0%, transparent 50%),
              linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)),
              rgba(11, 14, 23, 0.85)
            `,
            borderColor: 'color-mix(in srgb, #10B981 30%, transparent)',
            boxShadow: `
              0 20px 60px rgba(0, 0, 0, 0.3),
              0 0 40px color-mix(in srgb, #10B981 20%, transparent),
              inset 0 2px 0 rgba(255, 255, 255, 0.15)
            `,
            backdropFilter: 'blur(24px) saturate(150%)',
            WebkitBackdropFilter: 'blur(24px) saturate(150%)'
          }}
        >
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <div
                className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%),
                    linear-gradient(135deg, color-mix(in srgb, #10B981 40%, transparent), color-mix(in srgb, #34D399 35%, transparent))
                  `,
                  border: '3px solid color-mix(in srgb, #10B981 50%, transparent)',
                  boxShadow: `
                    0 0 30px color-mix(in srgb, #10B981 40%, transparent),
                    inset 0 2px 0 rgba(255,255,255,0.3)
                  `
                }}
              >
                <SpatialIcon
                  Icon={ICONS.Settings}
                  size={48}
                  color="rgba(255, 255, 255, 0.95)"
                  variant="pure"
                />
              </div>

              <div>
                <h2
                  className="text-3xl font-bold text-white mb-3"
                  style={{
                    textShadow: '0 0 25px color-mix(in srgb, #10B981 50%, transparent)'
                  }}
                >
                  Configurez votre Génération
                </h2>
                <div className="text-white/80 text-lg">
                  Personnalisez vos recettes selon vos préférences
                </div>
              </div>
            </div>

            {/* Current Inventory Info */}
            {hasValidInventory && (
              <MotionDiv
                {...(!isPerformanceMode && {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 }
                })}
                className="p-4 rounded-xl"
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                <div className="flex items-center gap-3">
                  <SpatialIcon Icon={ICONS.Package} size={24} className="text-green-400" />
                  <div className="flex-1">
                    <div className="text-white font-semibold">Inventaire utilisé</div>
                    <div className="text-white/70 text-sm">
                      Scan du {new Date(selectedInventory.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })} • {selectedInventory.inventory_final.length} ingrédients
                    </div>
                  </div>
                </div>
              </MotionDiv>
            )}

            {!availableInventories.length && (
              <div className="p-4 rounded-xl" style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)'
              }}>
                <div className="flex items-center gap-3">
                  <SpatialIcon Icon={ICONS.AlertTriangle} size={20} className="text-amber-400" />
                  <div className="text-amber-400 text-sm">
                    Aucun inventaire disponible. Scannez votre frigo pour commencer !
                  </div>
                </div>
              </div>
            )}

            {/* Configuration Form */}
            <div className="space-y-6">
              {/* Recipe Count */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Nombre de recettes
                </label>
                <CustomDropdown
                  options={recipeCountOptions}
                  value={recipeCount.toString()}
                  onChange={(value) => onSetRecipeCount(parseInt(value))}
                  placeholder="Nombre de recettes"
                  className="w-full"
                  disabled={isGenerating}
                />
              </div>

              {/* Cuisine Types */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Types de cuisine (optionnel)
                </label>
                <div className="flex flex-wrap gap-2">
                  {CUISINE_TYPES.map((cuisine) => (
                    <button
                      key={cuisine.value}
                      onClick={() => toggleCuisineType(cuisine.value)}
                      disabled={isGenerating}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                        cuisineTypes.includes(cuisine.value)
                          ? 'bg-green-500/20 text-green-300 border-2 border-green-400/50'
                          : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {cuisine.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Niveau de difficulté
                </label>
                <CustomDropdown
                  options={difficultyOptions}
                  value={difficultyLevel}
                  onChange={(value) => onSetDifficultyLevel(value as 'easy' | 'medium' | 'advanced')}
                  placeholder="Niveau de difficulté"
                  className="w-full"
                  disabled={isGenerating}
                />
              </div>

              {/* Max Prep Time Slider */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Temps de préparation max: {maxPrepTime} min
                </label>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="15"
                  value={maxPrepTime}
                  onChange={(e) => onSetMaxPrepTime(parseInt(e.target.value))}
                  disabled={isGenerating}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #10B981 0%, #10B981 ${((maxPrepTime - 15) / (120 - 15)) * 100}%, rgba(255,255,255,0.1) ${((maxPrepTime - 15) / (120 - 15)) * 100}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-white/50">
                  <span>15 min</span>
                  <span>120 min</span>
                </div>
              </div>

              {/* Meal Types */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Types de repas (optionnel)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_TYPES.map((meal) => (
                    <button
                      key={meal.value}
                      onClick={() => toggleMealType(meal.value)}
                      disabled={isGenerating}
                      className={`px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                        mealTypes.includes(meal.value)
                          ? 'bg-green-500/20 text-green-300 border-2 border-green-400/50'
                          : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {meal.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <MotionDiv
              {...(!isPerformanceMode && {
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.3, delay: 0.2 }
              })}
            >
              <button
                onClick={onGenerate}
                disabled={!hasValidInventory || isGenerating}
                className={`w-full text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 ${
                  !hasValidInventory || isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
                style={
                  hasValidInventory && !isGenerating
                    ? {
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(34, 197, 94, 0.85) 100%)',
                        backdropFilter: 'blur(20px) saturate(160%)',
                        border: '2px solid color-mix(in srgb, #10B981 60%, transparent)',
                        boxShadow: `
                          0 12px 40px color-mix(in srgb, #10B981 40%, transparent),
                          0 0 60px color-mix(in srgb, #10B981 30%, transparent),
                          inset 0 3px 0 rgba(255, 255, 255, 0.4),
                          inset 0 -3px 0 rgba(0, 0, 0, 0.2)
                        `,
                        WebkitBackdropFilter: 'blur(20px) saturate(160%)'
                      }
                    : undefined
                }
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-lg">Génération en cours...</span>
                  </>
                ) : (
                  <>
                    <SpatialIcon Icon={ICONS.Sparkles} size={24} />
                    <span className="text-lg">Générer {recipeCount} Recettes</span>
                  </>
                )}
              </button>
            </MotionDiv>
          </div>
        </GlassCard>
      </MotionDiv>

      {/* How it Works Explanation Card */}
      <MotionDiv
        {...(!isPerformanceMode && {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay: 0.2 }
        })}
      >
        <GlassCard
          className="p-6"
          style={{
            background: 'rgba(16, 185, 129, 0.05)',
            borderColor: 'rgba(16, 185, 129, 0.2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <SpatialIcon Icon={ICONS.Info} size={24} className="text-green-400" />
              <h3 className="text-xl font-bold text-white">Comment ça marche ?</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <div className="text-white font-semibold mb-1">Inventaire automatique</div>
                  <div className="text-white/70 text-sm">
                    Nous utilisons automatiquement votre dernier scan de frigo pour garantir des recettes
                    avec les ingrédients que vous avez sous la main.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <div className="text-white font-semibold mb-1">IA personnalisée</div>
                  <div className="text-white/70 text-sm">
                    Notre Forge Spatiale analyse votre profil nutritionnel, vos préférences culinaires
                    et vos contraintes pour créer des recettes sur mesure.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <div className="text-white font-semibold mb-1">Zéro gaspillage</div>
                  <div className="text-white/70 text-sm">
                    Les recettes générées privilégient l'utilisation optimale de vos ingrédients,
                    en tenant compte de leur fraîcheur pour minimiser le gaspillage.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-400 font-bold text-sm">4</span>
                </div>
                <div>
                  <div className="text-white font-semibold mb-1">Variété garantie</div>
                  <div className="text-white/70 text-sm">
                    L'IA évite les répétitions en tenant compte de vos recettes déjà générées
                    pour vous proposer toujours de nouvelles idées.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </MotionDiv>
    </div>
  );
};

export default ConfigurationStage;
