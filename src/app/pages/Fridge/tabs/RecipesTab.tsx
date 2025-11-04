import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import { useFeedback } from '../../../../hooks/useFeedback';
import { useToast } from '../../../../ui/components/ToastProvider';
import { useFridgeScanPipeline } from '../../../../system/store/fridgeScan';
import { useUserStore } from '../../../../system/store/userStore';
import { useMealPlanStore } from '../../../../system/store/mealPlanStore';
import type { Recipe } from '../../../../domain/recipe';
import RecipeDetailModal from './RecipesTab/components/RecipeDetailModal';
import RecipeCard from './RecipesTab/components/RecipeCard';
import RecipeFilterSystem from './RecipesTab/components/RecipeFilterSystem';
import EmptyRecipesState from './RecipesTab/components/EmptyRecipesState';
import RecipeActionButtons from './RecipesTab/components/RecipeActionButtons';
import RecipeLibraryCTA from '../components/RecipeLibraryCTA';
import { useRecipeData } from './RecipesTab/hooks/useRecipeData';
import { useRecipeFiltering } from './RecipesTab/hooks/useRecipeFiltering';
import { useRecipeExport } from './RecipesTab/hooks/useRecipeExport';
import { useRecipeDeletion } from './RecipesTab/hooks/useRecipeDeletion';

/**
 * Recipes Tab - Bibliothèque de Recettes
 * Affiche toutes les recettes sauvegardées de l'utilisateur
 * La génération se fait maintenant via une pipeline dédiée
 */
const RecipesTab: React.FC = () => {
  const navigate = useNavigate();
  const [showRecipeDetailModal, setShowRecipeDetailModal] = useState(false);
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState<Recipe | null>(null);
  const { click, success } = useFeedback();
  const { showToast } = useToast();

  // User state
  const { session, profile } = useUserStore();
  const userId = session?.user?.id;

  // Custom hooks for modular functionality
  const {
    persistedRecipes,
    loadingPersistedRecipes,
    allRecipes,
    handleToggleSaveStatus,
    deleteRecipeFromDb
  } = useRecipeData({
    userId,
    profile,
    userEditedInventory: [],
    recipeCandidates: [],
    clearRecipeCandidates: () => {},
    showToast,
    click,
    success
  });

  const {
    searchFilter,
    setSearchFilter,
    selectedFilters,
    setSelectedFilters,
    maxPrepTime,
    setMaxPrepTime,
    maxCookTime,
    setMaxCookTime,
    minServings,
    setMinServings,
    filteredRecipes,
    displayedRecipes,
    hasMoreRecipes,
    handleLoadMore
  } = useRecipeFiltering({ allRecipes });

  const { handleExportAllRecipes } = useRecipeExport({
    allRecipes,
    userId,
    showToast,
    click
  });

  const { handleDeleteAllRecipes } = useRecipeDeletion({
    allRecipes,
    persistedRecipes,
    newlyGeneratedRecipes,
    userId,
    showToast,
    click,
    clearRecipeCandidates,
    deleteRecipeFromDb
  });


  // Handle recipe view
  const handleViewRecipe = (recipe: Recipe) => {
    click();

    // Validate recipe has required data before opening modal
    if (!recipe) {
      showToast({
        type: 'error',
        title: 'Erreur',
        message: 'Les données de la recette sont manquantes',
        duration: 3000
      });
      return;
    }

    // Check if recipe has at least basic info (relaxed validation)
    if (!recipe.title) {
      showToast({
        type: 'error',
        title: 'Recette incomplète',
        message: 'Cette recette ne contient pas assez d\'informations pour être affichée',
        duration: 3000
      });
      return;
    }

    // Set selected recipe and open modal
    setSelectedRecipeForDetail(recipe);
    setShowRecipeDetailModal(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowRecipeDetailModal(false);
    setSelectedRecipeForDetail(null);
  };

  const hasRecipes = allRecipes.length > 0;
  const isLoading = loadingPersistedRecipes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* CTA pour Générer des Recettes */}
      <RecipeLibraryCTA />

      {/* Filtres et Boutons d'Action */}
      {hasRecipes && !isLoading && (
        <>
          <RecipeFilterSystem
            searchFilter={searchFilter}
            setSearchFilter={setSearchFilter}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            recipesCount={filteredRecipes.length}
            totalRecipesCount={allRecipes.length}
            isGenerating={isGenerating}
            maxPrepTime={maxPrepTime}
            setMaxPrepTime={setMaxPrepTime}
            maxCookTime={maxCookTime}
            setMaxCookTime={setMaxCookTime}
            minServings={minServings}
            setMinServings={setMinServings}
          />

          {/* Boutons d'Action - Positionnés après les filtres */}
          <RecipeActionButtons
            onExportAllRecipes={handleExportAllRecipes}
            onDeleteAllRecipes={handleDeleteAllRecipes}
            recipesCount={allRecipes.length}
          />
        </>
      )}

      {/* Contenu Principal */}
      {!hasRecipes && !isLoading ? (
        <EmptyRecipesState />
      ) : (
        <div className="space-y-4">
          {/* État de Chargement Initial */}
          {loadingPersistedRecipes && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <GlassCard className="p-8">
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto">
                    <SpatialIcon 
                      Icon={ICONS.Loader2} 
                      size={64} 
                      className="animate-spin text-blue-400" 
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Chargement de votre bibliothèque...
                    </h3>
                    <p className="text-white/70">
                      Récupération de vos recettes sauvegardées
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Grille de Recettes */}
          {!loadingPersistedRecipes && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {displayedRecipes.map((recipe, index) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      index={index}
                      isSaved={true}
                      isNewlyGenerated={false}
                      isLoading={recipe.status === 'loading'}
                      onToggleSaveStatus={() => handleToggleSaveStatus(recipe)}
                      onView={handleViewRecipe}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Load More Button */}
              {hasMoreRecipes && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center"
                >
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105"
                  >
                    Charger plus de recettes ({filteredRecipes.length - displayedRecipes.length} restantes)
                  </button>
                </motion.div>
              )}
            </div>
          )}

          {/* Message si aucune recette après filtrage */}
          {hasRecipes && filteredRecipes.length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <GlassCard className="p-8">
                <div className="space-y-4">
                  <SpatialIcon 
                    Icon={ICONS.Search} 
                    size={48} 
                    className="mx-auto text-white/50" 
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Aucune recette trouvée
                    </h3>
                    <p className="text-white/70">
                      Essayez de modifier vos filtres ou votre recherche
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </div>
      )}

      {/* Recipe Detail Modal */}
      {showRecipeDetailModal && selectedRecipeForDetail && (
        <RecipeDetailModal
          recipe={selectedRecipeForDetail}
          onClose={handleCloseModal}
          onToggleSave={handleToggleSaveStatus}
          isSaved={persistedRecipes.some(r => r.id === selectedRecipeForDetail.id)}
        />
      )}
    </motion.div>
  );
};

export default RecipesTab;