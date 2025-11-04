import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';

interface ConfigurationStageProps {
  availableInventories: Array<{ id: string; session_id: string; created_at: string }>;
  selectedInventoryId: string | null;
  weekCount: number;
  batchCookingEnabled: boolean;
  onSetWeekCount: (count: number) => void;
  onToggleBatchCooking: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onExit: () => void;
}

const ConfigurationStage: React.FC<ConfigurationStageProps> = ({
  availableInventories,
  weekCount,
  batchCookingEnabled,
  onSetWeekCount,
  onToggleBatchCooking,
  onGenerate,
  isGenerating,
  onExit
}) => {
  const latestInventory = availableInventories[0];
  const inventoryDate = latestInventory ? new Date(latestInventory.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : null;

  const weekOptions = [
    { value: 1, label: '1 semaine', description: 'Plan court pour tester' },
    { value: 2, label: '2 semaines', description: 'Équilibre idéal' },
    { value: 3, label: '3 semaines', description: 'Plus de variété' },
    { value: 4, label: '4 semaines', description: 'Plan complet' }
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard className="p-6" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(168, 85, 247, 0.25))',
                border: '2px solid rgba(139, 92, 246, 0.4)'
              }}
            >
              <SpatialIcon Icon={ICONS.Sparkles} size={24} className="text-purple-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Génération Intelligente</h3>
              <p className="text-white/70 leading-relaxed">
                Créez un plan alimentaire personnalisé basé sur votre inventaire actuel, vos objectifs nutritionnels et vos préférences culinaires. L'IA optimise chaque repas pour respecter vos macros tout en maximisant l'utilisation de vos ingrédients.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
              <div className="flex items-center gap-2 mb-2">
                <SpatialIcon Icon={ICONS.Clock} size={18} className="text-purple-400" />
                <span className="text-white/90 font-semibold text-sm">Évolution Culinaire</span>
              </div>
              <p className="text-white/60 text-xs">Synchronisation temporelle avec vos habitudes alimentaires</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
              <div className="flex items-center gap-2 mb-2">
                <SpatialIcon Icon={ICONS.Brain} size={18} className="text-purple-400" />
                <span className="text-white/90 font-semibold text-sm">IA Personnalisée</span>
              </div>
              <p className="text-white/60 text-xs">Adapté à votre profil nutritionnel complet</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
              <div className="flex items-center gap-2 mb-2">
                <SpatialIcon Icon={ICONS.Refrigerator} size={18} className="text-purple-400" />
                <span className="text-white/90 font-semibold text-sm">Dernier Inventaire</span>
              </div>
              <p className="text-white/60 text-xs">{inventoryDate ? `Scan du ${inventoryDate}` : 'Aucun inventaire'}</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <GlassCard className="p-6" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex items-center gap-3 mb-6">
            <SpatialIcon Icon={ICONS.Calendar} size={24} className="text-purple-400" />
            <h3 className="text-lg font-bold text-white">Durée du Plan</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {weekOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onSetWeekCount(option.value)}
                disabled={isGenerating}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  weekCount === option.value
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-white/10 bg-white/5 hover:border-purple-400/50 hover:bg-purple-400/10'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-white mb-1">{option.value}</div>
                  <div className="text-sm font-semibold text-white/90 mb-1">{option.label}</div>
                  <div className="text-xs text-white/60">{option.description}</div>
                </div>
                {weekCount === option.value && (
                  <div className="flex justify-center mt-3">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassCard className="p-6" style={{ background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="flex items-center gap-3 mb-6">
            <SpatialIcon Icon={ICONS.ChefHat} size={24} className="text-purple-400" />
            <h3 className="text-lg font-bold text-white">Options de Génération</h3>
          </div>

          <button
            onClick={onToggleBatchCooking}
            disabled={isGenerating}
            className={`w-full p-5 rounded-xl border-2 transition-all duration-200 ${
              batchCookingEnabled
                ? 'border-purple-500 bg-purple-500/15'
                : 'border-white/10 bg-white/5 hover:border-purple-400/50 hover:bg-purple-400/10'
            } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  batchCookingEnabled
                    ? 'border-purple-400 bg-purple-500/30'
                    : 'border-white/30 bg-transparent'
                }`}
              >
                {batchCookingEnabled && (
                  <SpatialIcon Icon={ICONS.Check} size={16} className="text-purple-300" />
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white font-semibold">Batch Cooking Activé</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                    Optimisé
                  </span>
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-3">
                  Optimise les recettes pour préparer plusieurs portions en une fois. L'IA adapte automatiquement les quantités et suggère des plats qui se conservent bien, en tenant compte de votre inventaire disponible et des possibilités de préparation.
                </p>
                <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                  <SpatialIcon Icon={ICONS.Info} size={16} className="text-purple-400 mt-0.5 flex-shrink-0" />
                  <p className="text-white/60 text-xs">
                    Les portions sont calculées selon votre inventaire actuel. Les recettes privilégient l'utilisation optimale de vos ingrédients disponibles et s'adaptent aux quantités détectées lors du scan.
                  </p>
                </div>
              </div>
            </div>
          </button>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-between gap-4"
      >
        <button
          onClick={onExit}
          disabled={isGenerating}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Annuler
        </button>

        <button
          onClick={onGenerate}
          disabled={isGenerating || !latestInventory}
          className="px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
          style={{
            background: isGenerating
              ? 'rgba(139, 92, 246, 0.3)'
              : 'linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(168, 85, 247, 0.85) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            boxShadow: isGenerating ? 'none' : '0 8px 24px rgba(139, 92, 246, 0.3)'
          }}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Génération en cours...</span>
            </>
          ) : (
            <>
              <SpatialIcon Icon={ICONS.Sparkles} size={20} />
              <span>Générer le Plan</span>
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default ConfigurationStage;
