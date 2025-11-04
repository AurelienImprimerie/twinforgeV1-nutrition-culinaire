import React from 'react';
import { motion } from 'framer-motion';
import { usePerformanceMode } from '../../../../system/context/PerformanceModeContext';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import CustomDropdown from '../../../pages/Fridge/tabs/RecipesTab/components/CustomDropdown';
import { RECIPE_COUNT_OPTIONS } from '../../../../system/store/recipeGeneration';

interface ConfigurationStageProps {
  availableInventories: any[];
  selectedInventoryId: string | null;
  recipeCount: number;
  onSelectInventory: (inventoryId: string) => void;
  onSetRecipeCount: (count: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const ConfigurationStage: React.FC<ConfigurationStageProps> = ({
  availableInventories,
  selectedInventoryId,
  recipeCount,
  onSelectInventory,
  onSetRecipeCount,
  onGenerate,
  isGenerating
}) => {
  const { isPerformanceMode } = usePerformanceMode();
  const MotionDiv = isPerformanceMode ? 'div' : motion.div;

  const selectedInventory = availableInventories.find(inv => inv.id === selectedInventoryId);
  const hasValidInventory = selectedInventory && selectedInventory.inventory_final?.length > 0;

  const inventoryOptions = availableInventories.map(inventory => ({
    value: inventory.id,
    label: `Inventaire du ${new Date(inventory.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })} (${inventory.inventory_final?.length || 0} ingrédients)`,
    subtitle: new Date(inventory.created_at).toLocaleDateString('fr-FR')
  }));

  const recipeCountOptions = RECIPE_COUNT_OPTIONS.map(option => ({
    value: option.value.toString(),
    label: option.label
  }));

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
                <p className="text-white/80 text-lg">
                  Choisissez votre inventaire et le nombre de recettes à générer
                </p>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="space-y-6">
              {/* Inventory Selection */}
              <div className="space-y-3">
                <label className="block text-white font-semibold text-sm">
                  Sélectionner un inventaire
                </label>
                <CustomDropdown
                  options={inventoryOptions}
                  value={selectedInventoryId || ''}
                  onChange={onSelectInventory}
                  placeholder="Sélectionner un inventaire"
                  className="w-full"
                  disabled={isGenerating}
                />
                {!availableInventories.length && (
                  <p className="text-amber-400 text-sm flex items-center gap-2">
                    <SpatialIcon Icon={ICONS.AlertTriangle} size={16} />
                    Aucun inventaire disponible. Scannez votre frigo pour commencer !
                  </p>
                )}
              </div>

              {/* Recipe Count Selection */}
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

              {/* Selected Inventory Info */}
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
                    <SpatialIcon Icon={ICONS.Check} size={20} className="text-green-400" />
                    <div>
                      <p className="text-white font-medium">Inventaire sélectionné</p>
                      <p className="text-white/70 text-sm">
                        {selectedInventory.inventory_final.length} ingrédients disponibles
                      </p>
                    </div>
                  </div>
                </MotionDiv>
              )}
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

      {/* Benefits Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: ICONS.Sparkles,
            title: 'IA Personnalisée',
            description: 'Recettes adaptées à vos goûts et contraintes'
          },
          {
            icon: ICONS.Clock,
            title: 'Rapide',
            description: 'Génération en quelques secondes'
          },
          {
            icon: ICONS.Check,
            title: 'Zéro Gaspillage',
            description: 'Utilisez tous vos ingrédients disponibles'
          }
        ].map((benefit, index) => (
          <MotionDiv
            key={index}
            {...(!isPerformanceMode && {
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.3, delay: 0.3 + index * 0.1 }
            })}
          >
            <GlassCard
              className="p-4 text-center"
              style={{
                background: 'rgba(16, 185, 129, 0.05)',
                borderColor: 'rgba(16, 185, 129, 0.2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              <SpatialIcon
                Icon={benefit.icon}
                size={32}
                className="mx-auto mb-3 text-green-400"
                style={{
                  filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.6))'
                }}
              />
              <h3 className="text-white font-semibold mb-2">{benefit.title}</h3>
              <p className="text-white/70 text-sm">{benefit.description}</p>
            </GlassCard>
          </MotionDiv>
        ))}
      </div>
    </div>
  );
};

export default ConfigurationStage;
