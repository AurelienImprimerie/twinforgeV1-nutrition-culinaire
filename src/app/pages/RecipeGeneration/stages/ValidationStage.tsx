import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import { useRecipeGenerationPipeline } from '../../../../system/store/recipeGeneration';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import RecipeCard from '../../../pages/Fridge/tabs/RecipesTab/components/RecipeCard';
import RecipeDetailModal from '../../../pages/Fridge/tabs/RecipesTab/components/RecipeDetailModal';
import type { Recipe } from '../../../../domain/recipe';

interface ValidationStageProps {
  recipes: Recipe[];
  onSaveAll: () => void;
  onDiscard: () => void;
  onViewRecipe: (recipe: Recipe) => void;
  isSaving: boolean;
  onExit: () => void;
}

const ValidationStage: React.FC<ValidationStageProps> = ({
  recipes,
  onSaveAll,
  onDiscard,
  onViewRecipe,
  isSaving,
  onExit
}) => {
  const { isPerformanceMode } = usePerformanceMode();
  const { loadingState } = useRecipeGenerationPipeline();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;
  const [showRecipeDetailModal, setShowRecipeDetailModal] = useState(false);
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState<Recipe | null>(null);

  const isStreaming = loadingState === 'streaming';
  const readyRecipes = recipes.filter(r => r.status === 'ready');
  const loadingRecipes = recipes.filter(r => r.status === 'loading');
  const allRecipesReady = recipes.length > 0 && recipes.every(r => r.status === 'ready');

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipeForDetail(recipe);
    setShowRecipeDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowRecipeDetailModal(false);
    setSelectedRecipeForDetail(null);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Validation Header */}
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0, y: -20 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.5 }
          })}
        >
          <GlassCard
            className="p-6"
            style={{
              background: `
                radial-gradient(circle at 30% 20%, color-mix(in srgb, #10B981 12%, transparent) 0%, transparent 60%),
                linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)),
                rgba(11, 14, 23, 0.85)
              `,
              borderColor: 'color-mix(in srgb, #10B981 30%, transparent)',
              boxShadow: `
                0 12px 40px rgba(0, 0, 0, 0.3),
                0 0 30px color-mix(in srgb, #10B981 20%, transparent),
                inset 0 2px 0 rgba(255, 255, 255, 0.15)
              `,
              backdropFilter: 'blur(24px) saturate(150%)',
              WebkitBackdropFilter: 'blur(24px) saturate(150%)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: `
                      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                      linear-gradient(135deg, color-mix(in srgb, #10B981 35%, transparent), color-mix(in srgb, #10B981 25%, transparent))
                    `,
                    border: '2px solid color-mix(in srgb, #10B981 50%, transparent)',
                    boxShadow: '0 0 30px color-mix(in srgb, #10B981 40%, transparent)'
                  }}
                >
                  <SpatialIcon Icon={ICONS.Check} size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {isStreaming ? 'Génération en Cours...' : 'Vos Recettes sont Prêtes !'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-white/70">
                      {isStreaming
                        ? `${readyRecipes.length} / ${recipes.length} recette${recipes.length > 1 ? 's' : ''} générée${recipes.length > 1 ? 's' : ''}`
                        : `${recipes.length} recette${recipes.length > 1 ? 's' : ''} générée${recipes.length > 1 ? 's' : ''}`
                      }
                    </p>
                    {isStreaming && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-400/20 border border-green-400/30">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-green-400 text-xs font-medium">En création</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onDiscard}
                  disabled={isSaving || isStreaming}
                  className={`px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200 ${
                    (isSaving || isStreaming) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Régénérer
                </button>

                {/* Save Button - Skeleton during streaming */}
                {isStreaming ? (
                  <div
                    className="px-6 py-2 rounded-xl flex items-center gap-2 animate-pulse"
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '2px solid rgba(16, 185, 129, 0.3)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <div className="w-4 h-4 rounded bg-white/20" />
                    <span className="text-white/60 font-semibold">Génération en cours...</span>
                  </div>
                ) : (
                  <button
                    onClick={onSaveAll}
                    disabled={isSaving || !allRecipesReady}
                    className={`px-6 py-2 text-white font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${
                      (isSaving || !allRecipesReady) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                    }`}
                    style={
                      allRecipesReady && !isSaving
                        ? {
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(34, 197, 94, 0.85) 100%)',
                            border: '2px solid color-mix(in srgb, #10B981 60%, transparent)',
                            boxShadow: `
                              0 8px 24px color-mix(in srgb, #10B981 40%, transparent),
                              inset 0 2px 0 rgba(255, 255, 255, 0.3)
                            `
                          }
                        : {
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '2px solid rgba(16, 185, 129, 0.3)'
                          }
                    }
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sauvegarde...</span>
                      </>
                    ) : (
                      <>
                        <SpatialIcon Icon={ICONS.Save} size={18} />
                        <span>Sauvegarder dans ma Bibliothèque</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </GlassCard>
        </MotionDiv>

        {/* Recipes Grid with Progressive Loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="sync">
            {recipes.map((recipe, index) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                index={index}
                isSaved={false}
                isNewlyGenerated={recipe.status === 'ready'}
                isLoading={recipe.status === 'loading'}
                onToggleSaveStatus={() => {}}
                onView={handleViewRecipe}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Streaming Status Indicator */}
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-sm text-white/70 mt-6"
          >
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Création des recettes suivantes...</span>
          </motion.div>
        )}

        {/* Info Card */}
        {!isStreaming && (
          <MotionDiv
            {...(!isPerformanceMode && {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { delay: 0.3 }
            })}
          >
            <GlassCard
              className="p-4"
              style={{
                background: 'rgba(16, 185, 129, 0.05)',
                borderColor: 'rgba(16, 185, 129, 0.2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="flex items-center gap-3">
                <SpatialIcon Icon={ICONS.Lightbulb} size={20} className="text-green-400" />
                <p className="text-white/80 text-sm">
                  <strong className="text-white">Astuce :</strong> Enregistrez vos recettes dans votre bibliothèque
                  pour y accéder facilement à tout moment !
                </p>
              </div>
            </GlassCard>
          </MotionDiv>
        )}

        {/* Exit Button */}
        <MotionDiv
          {...(!isPerformanceMode && {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { duration: 0.3, delay: 0.4 }
          })}
          className="flex justify-end"
        >
          <button
            onClick={onExit}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200"
          >
            Quitter
          </button>
        </MotionDiv>
      </div>

      {/* Recipe Detail Modal */}
      {showRecipeDetailModal && selectedRecipeForDetail && (
        <RecipeDetailModal
          recipe={selectedRecipeForDetail}
          onClose={handleCloseModal}
          onToggleSave={() => {}}
          isSaved={false}
        />
      )}
    </>
  );
};

export default ValidationStage;
