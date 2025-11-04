import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';

const GeneratingRecipesStage: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard
        className="p-12"
        style={{
          background: `radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 60%), linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05)), rgba(11, 14, 23, 0.85)`,
          borderColor: 'rgba(139, 92, 246, 0.3)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div className="text-center space-y-6 max-w-2xl mx-auto">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 360]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear"
            }}
            className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.35))',
              border: '2px solid rgba(139, 92, 246, 0.5)',
              boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)'
            }}
          >
            <SpatialIcon Icon={ICONS.Book} size={48} className="text-white" />
          </motion.div>

          <div>
            <h2 className="text-3xl font-bold text-white mb-3">Création des Recettes Détaillées</h2>
            <p className="text-white/70 text-lg">
              L'IA compose les recettes complètes avec instructions, temps de préparation et astuces culinaires
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(139, 92, 246, 0.1)' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-white font-medium">Instructions Pas-à-Pas</span>
              </div>
              <p className="text-white/60 text-sm">Étapes détaillées pour chaque recette</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(139, 92, 246, 0.1)' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-white font-medium">Génération d'Images</span>
              </div>
              <p className="text-white/60 text-sm">Visuels appétissants pour chaque plat</p>
            </motion.div>
          </div>

          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="pt-4"
          >
            <p className="text-white/50 text-sm">Cette étape peut prendre quelques minutes...</p>
          </motion.div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default GeneratingRecipesStage;
