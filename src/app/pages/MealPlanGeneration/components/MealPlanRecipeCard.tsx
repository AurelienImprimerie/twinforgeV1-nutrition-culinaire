import React from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import SkeletonBase from '../../../../ui/components/skeletons/SkeletonBase';

interface MealPlanRecipeCardProps {
  meal: any;
  dayIndex: number;
  isGenerated: boolean;
  onClick?: () => void;
}

const MealPlanRecipeCard: React.FC<MealPlanRecipeCardProps> = ({
  meal,
  dayIndex,
  isGenerated,
  onClick
}) => {
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  const mealIcons = {
    breakfast: ICONS.Coffee,
    lunch: ICONS.UtensilsCrossed,
    dinner: ICONS.UtensilsCrossed,
    snack: ICONS.Cookie
  };

  const mealLabels = {
    breakfast: 'Petit-déjeuner',
    lunch: 'Déjeuner',
    dinner: 'Dîner',
    snack: 'Collation'
  };

  const hasImage = meal.detailedRecipe?.imageUrl;
  const isImageLoading = isGenerated && !hasImage;

  return (
    <MotionDiv
      {...(!isPerformanceMode && isGenerated && {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: 'easeOut' }
      })}
      onClick={onClick}
      className={`rounded-xl overflow-hidden transition-all duration-300 ${
        onClick && isGenerated ? 'cursor-pointer hover:scale-[1.02]' : ''
      }`}
      style={{
        background: isGenerated
          ? 'linear-gradient(145deg, rgba(139, 92, 246, 0.12), rgba(168, 85, 247, 0.08))'
          : 'rgba(139, 92, 246, 0.05)',
        border: `1.5px solid ${isGenerated ? 'rgba(168, 85, 247, 0.3)' : 'rgba(139, 92, 246, 0.15)'}`,
        boxShadow: isGenerated
          ? '0 8px 24px rgba(139, 92, 246, 0.2), 0 0 40px rgba(168, 85, 247, 0.1)'
          : '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Image Container with Skeleton */}
      <div
        className="w-full h-48 relative overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
        }}
      >
        {isImageLoading && (
          <div className="absolute inset-0">
            <SkeletonBase width="100%" height="100%" borderRadius="0" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.2))',
                  border: '2px solid rgba(168, 85, 247, 0.4)',
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)'
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <SpatialIcon Icon={ICONS.Image} size={28} className="text-violet-300" />
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {hasImage && (
          <MotionDiv
            {...(!isPerformanceMode && {
              initial: { opacity: 0, scale: 1.1 },
              animate: { opacity: 1, scale: 1 },
              transition: { duration: 0.6, ease: 'easeOut' }
            })}
            className="w-full h-full"
          >
            <img
              src={meal.detailedRecipe.imageUrl}
              alt={meal.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </MotionDiv>
        )}

        {!isGenerated && (
          <div className="absolute inset-0 flex items-center justify-center">
            <SkeletonBase width="100%" height="100%" borderRadius="0" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(11, 14, 23, 0.95) 0%, rgba(11, 14, 23, 0.6) 50%, transparent 100%)'
          }}
        />

        {/* Status Badge */}
        <div className="absolute top-3 right-3 flex gap-2">
          {isGenerated ? (
            <MotionDiv
              {...(!isPerformanceMode && {
                initial: { scale: 0, rotate: -180 },
                animate: { scale: 1, rotate: 0 },
                transition: { duration: 0.5, type: 'spring' }
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(34, 197, 94, 0.85))',
                border: '1.5px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
              }}
            >
              <div className="w-2 h-2 bg-white rounded-full" />
              <span className="text-white text-xs font-bold uppercase tracking-wide">Prête</span>
            </MotionDiv>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(168, 85, 247, 0.8)',
                border: '1.5px solid rgba(168, 85, 247, 0.5)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <motion.div
                className="w-2 h-2 bg-white rounded-full"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="text-white text-xs font-bold uppercase tracking-wide">Génération...</span>
            </div>
          )}

          {hasImage && (
            <MotionDiv
              {...(!isPerformanceMode && {
                initial: { scale: 0 },
                animate: { scale: 1 },
                transition: { duration: 0.3, delay: 0.2 }
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(59, 130, 246, 0.9)',
                border: '1.5px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
              }}
            >
              <SpatialIcon Icon={ICONS.Image} size={12} className="text-white" />
              <span className="text-white text-xs font-bold uppercase tracking-wide">Image</span>
            </MotionDiv>
          )}
        </div>

        {/* Meal Type Badge */}
        <div className="absolute top-3 left-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(11, 14, 23, 0.8)',
              border: '1.5px solid rgba(168, 85, 247, 0.4)',
              backdropFilter: 'blur(12px)'
            }}
          >
            <SpatialIcon
              Icon={mealIcons[meal.type as keyof typeof mealIcons] || ICONS.UtensilsCrossed}
              size={14}
              className="text-violet-300"
            />
            <span className="text-white/90 text-xs font-semibold uppercase tracking-wide">
              {mealLabels[meal.type as keyof typeof mealLabels]}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isGenerated ? (
          <>
            {/* Title */}
            <h4 className="text-white font-bold text-lg mb-3 leading-tight line-clamp-2">
              {meal.detailedRecipe?.title || meal.name}
            </h4>

            {/* Metadata Grid */}
            {meal.detailedRecipe && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* Prep + Cook Time */}
                {(meal.detailedRecipe.prepTimeMin || meal.detailedRecipe.cookTimeMin) && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{
                      background: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid rgba(168, 85, 247, 0.2)'
                    }}
                  >
                    <SpatialIcon Icon={ICONS.Clock} size={16} className="text-violet-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Temps</p>
                      <p className="text-white font-semibold text-sm">
                        {(meal.detailedRecipe.prepTimeMin || 0) + (meal.detailedRecipe.cookTimeMin || 0)} min
                      </p>
                    </div>
                  </div>
                )}

                {/* Calories */}
                {meal.detailedRecipe.nutritionalInfo?.kcal && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{
                      background: 'rgba(251, 146, 60, 0.1)',
                      border: '1px solid rgba(251, 146, 60, 0.2)'
                    }}
                  >
                    <SpatialIcon Icon={ICONS.Flame} size={16} className="text-orange-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Calories</p>
                      <p className="text-white font-semibold text-sm">
                        {meal.detailedRecipe.nutritionalInfo.kcal} kcal
                      </p>
                    </div>
                  </div>
                )}

                {/* Difficulty */}
                {meal.detailedRecipe.difficulty && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}
                  >
                    <SpatialIcon Icon={ICONS.TrendingUp} size={16} className="text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Difficulté</p>
                      <p className="text-white font-semibold text-sm capitalize">
                        {meal.detailedRecipe.difficulty}
                      </p>
                    </div>
                  </div>
                )}

                {/* Servings */}
                {meal.detailedRecipe.servings && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.2)'
                    }}
                  >
                    <SpatialIcon Icon={ICONS.Users} size={16} className="text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Portions</p>
                      <p className="text-white font-semibold text-sm">
                        {meal.detailedRecipe.servings} pers.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Macros Bar (if available) */}
            {meal.detailedRecipe?.nutritionalInfo?.protein && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Macronutriments</span>
                </div>
                <div className="flex gap-1 h-2 rounded-full overflow-hidden"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {/* Protein */}
                  <div
                    className="h-full"
                    style={{
                      background: 'linear-gradient(90deg, #EF4444, #DC2626)',
                      width: `${(meal.detailedRecipe.nutritionalInfo.protein * 4 / meal.detailedRecipe.nutritionalInfo.kcal) * 100}%`
                    }}
                  />
                  {/* Carbs */}
                  <div
                    className="h-full"
                    style={{
                      background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
                      width: `${(meal.detailedRecipe.nutritionalInfo.carbs * 4 / meal.detailedRecipe.nutritionalInfo.kcal) * 100}%`
                    }}
                  />
                  {/* Fat */}
                  <div
                    className="h-full"
                    style={{
                      background: 'linear-gradient(90deg, #F59E0B, #D97706)',
                      width: `${(meal.detailedRecipe.nutritionalInfo.fat * 9 / meal.detailedRecipe.nutritionalInfo.kcal) * 100}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-white/70">{meal.detailedRecipe.nutritionalInfo.protein}g P</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-white/70">{meal.detailedRecipe.nutritionalInfo.carbs}g G</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-white/70">{meal.detailedRecipe.nutritionalInfo.fat}g L</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dietary Tags */}
            {meal.detailedRecipe?.dietaryTags && meal.detailedRecipe.dietaryTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {meal.detailedRecipe.dietaryTags.slice(0, 4).map((tag: string, tagIndex: number) => (
                  <span
                    key={tagIndex}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: 'rgba(196, 181, 253, 0.95)',
                      border: '1px solid rgba(168, 85, 247, 0.3)'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Click Indicator */}
            {onClick && (
              <div className="mt-3 flex items-center justify-center gap-2 text-violet-300 text-xs font-medium">
                <span>Cliquer pour voir les détails</span>
                <SpatialIcon Icon={ICONS.ChevronRight} size={14} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Loading State */}
            <SkeletonBase width="80%" height="20px" className="mb-3" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <SkeletonBase width="100%" height="48px" />
              <SkeletonBase width="100%" height="48px" />
              <SkeletonBase width="100%" height="48px" />
              <SkeletonBase width="100%" height="48px" />
            </div>
            <div className="flex gap-1.5">
              <SkeletonBase width="60px" height="24px" borderRadius="12px" />
              <SkeletonBase width="70px" height="24px" borderRadius="12px" />
              <SkeletonBase width="80px" height="24px" borderRadius="12px" />
            </div>
          </>
        )}
      </div>
    </MotionDiv>
  );
};

export default MealPlanRecipeCard;
