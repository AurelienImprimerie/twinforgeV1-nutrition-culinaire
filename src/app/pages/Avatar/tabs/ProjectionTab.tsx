import React, { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { ConditionalMotion } from '../../../../lib/motion/ConditionalMotion';
import { useUserStore } from '../../../../system/store/userStore';
import { useBodyScanData } from '../../../../hooks/useBodyScanData';
import { useProjectionCalculator, type ProjectionParams } from '../../../../hooks/useProjectionCalculator';
import { useProjections } from '../../../../hooks/useProjections';
import { useDebounce } from '../../../../lib/utils/hooks';
import { useFeedback } from '../../../../hooks/useFeedback';
import GlassCard from '../../../../ui/cards/GlassCard';
import SpatialIcon from '../../../../ui/icons/SpatialIcon';
import { ICONS } from '../../../../ui/icons/registry';
import ProjectionControls from './components/ProjectionControls';
import SavedProjectionsList from './components/SavedProjectionsList';
import EmptyProjectionTabState from './EmptyProjectionTabState';
import ProjectionTabSkeleton from '../../../../ui/components/skeletons/ProjectionTabSkeleton';
import logger from '../../../../lib/utils/logger';

const Avatar3DViewer = lazy(() => import('../../../../components/3d/Avatar3DViewer'));

const ProjectionTab: React.FC = () => {
  const { profile } = useUserStore();
  const { bodyScanData, isLoading, error } = useBodyScanData();
  const { click } = useFeedback();
  const {
    projections,
    createProjection,
    deleteProjection,
    toggleFavorite,
    isCreating,
    isDeleting
  } = useProjections();

  // Paramètres de projection par défaut
  const [projectionParams, setProjectionParams] = useState<ProjectionParams>({
    nutritionQuality: 3,
    sportIntensity: 3,
    duration: '6_months'
  });

  // État pour le modal de sauvegarde
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  // Hook de calcul des projections
  const resolvedGender = (bodyScanData?.resolved_gender || profile?.sex || 'male') as 'male' | 'female';
  const baseMorphData = bodyScanData?.morph_values || {};
  const { calculateProjection } = useProjectionCalculator(baseMorphData, resolvedGender);

  // Calculer la projection avec debounce pour éviter les recalculs excessifs
  const debouncedParams = useDebounce(projectionParams, 150);

  const projectionResult = useMemo(() => {
    if (!bodyScanData?.morph_values) {
      return null;
    }
    return calculateProjection(debouncedParams);
  }, [debouncedParams, calculateProjection, bodyScanData?.morph_values]);

  // Fusionner les morphs de base avec les morphs projetés
  const projectedMorphData = useMemo(() => {
    if (!projectionResult || !bodyScanData?.morph_values) {
      return baseMorphData;
    }

    const projected = {
      ...baseMorphData,
      pearFigure: projectionResult.pearFigure,
      bodybuilderSize: projectionResult.bodybuilderSize
    };

    logger.info('PROJECTION_TAB', 'Projected morph data updated', {
      basePearFigure: baseMorphData.pearFigure,
      baseMuscle: baseMorphData.bodybuilderSize,
      projectedPearFigure: projected.pearFigure,
      projectedMuscle: projected.bodybuilderSize,
      totalMorphKeys: Object.keys(projected).length,
      philosophy: 'projection_morph_data_ready'
    });

    return projected;
  }, [projectionResult, baseMorphData, bodyScanData?.morph_values]);

  // Calculer les changements pour l'affichage
  const fatChange = useMemo(() => {
    if (!projectionResult) return 0;
    return projectionResult.pearFigure - (baseMorphData.pearFigure || 0);
  }, [projectionResult, baseMorphData.pearFigure]);

  const muscleChange = useMemo(() => {
    if (!projectionResult) return 0;
    return projectionResult.bodybuilderSize - (baseMorphData.bodybuilderSize || 0);
  }, [projectionResult, baseMorphData.bodybuilderSize]);

  // Handlers
  const handleParamsChange = useCallback((newParams: ProjectionParams) => {
    logger.info('PROJECTION_TAB', 'Projection params changed', {
      previousParams: projectionParams,
      newParams,
      willTriggerRecalculation: true,
      philosophy: 'user_adjusted_projection'
    });
    setProjectionParams(newParams);
  }, [projectionParams]);

  const handleReset = useCallback(() => {
    logger.info('PROJECTION_TAB', 'Reset to current morphology', {
      philosophy: 'projection_reset'
    });
    click();
    setProjectionParams({
      nutritionQuality: 3,
      sportIntensity: 3,
      duration: '6_months'
    });
  }, [click]);

  const handleSave = useCallback(() => {
    if (!projectionResult || !bodyScanData) return;

    click();
    createProjection({
      name: saveName || `Projection ${new Date().toLocaleDateString('fr-FR')}`,
      description: saveDescription || undefined,
      baseScanId: bodyScanData.id,
      params: projectionParams,
      projectedPearFigure: projectionResult.pearFigure,
      projectedBodybuilderSize: projectionResult.bodybuilderSize,
      fatChange,
      muscleChange,
      projectedMorphValues: projectedMorphData
    });

    setShowSaveModal(false);
    setSaveName('');
    setSaveDescription('');
  }, [projectionResult, bodyScanData, saveName, saveDescription, projectionParams, fatChange, muscleChange, projectedMorphData, createProjection, click]);

  const handleLoadProjection = useCallback((params: ProjectionParams) => {
    logger.info('PROJECTION_TAB', 'Loading saved projection', { params });
    click();
    setProjectionParams(params);
  }, [click]);

  const handleDeleteProjection = useCallback((id: string) => {
    deleteProjection(id);
  }, [deleteProjection]);

  const handleToggleFavorite = useCallback((id: string, isFavorite: boolean) => {
    toggleFavorite({ projectionId: id, isFavorite });
  }, [toggleFavorite]);

  // Gestion des erreurs
  if (error) {
    return (
      <GlassCard className="text-center p-8">
        <ConditionalMotion
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <SpatialIcon Icon={ICONS.AlertCircle} size={32} color="#EF4444" />
        </ConditionalMotion>

        <h3 className="text-xl font-bold text-white mb-3">Erreur de chargement</h3>
        <p className="text-red-300 text-sm mb-6 leading-relaxed max-w-md mx-auto">
          {error instanceof Error ? error.message : 'Une erreur est survenue lors du chargement de vos données.'}
        </p>

        <button
          className="btn-glass px-6 py-3"
          onClick={() => window.location.reload()}
        >
          <div className="flex items-center justify-center gap-2">
            <SpatialIcon Icon={ICONS.RotateCcw} size={16} />
            <span>Actualiser</span>
          </div>
        </button>
      </GlassCard>
    );
  }

  // État vide - pas de scan corporel
  if (!bodyScanData || !bodyScanData.morph_values || Object.keys(bodyScanData.morph_values).length === 0) {
    return <EmptyProjectionTabState />;
  }

  // État de chargement
  if (isLoading) {
    return <ProjectionTabSkeleton />;
  }

  // Build user profile for viewer
  const userProfile = {
    sex: resolvedGender,
    height_cm: profile?.height_cm || 170,
    weight_kg: bodyScanData.weight || profile?.weight_kg || 70
  };

  const displayLimbMasses = bodyScanData.limb_masses || {};
  const displaySkinTone = bodyScanData.skin_tone || null;

  // Récupérer les morphs faciaux depuis le profil utilisateur
  const faceMorphData = profile?.preferences?.face?.final_face_params || {};
  const faceSkinTone = profile?.preferences?.face?.skin_tone || null;

  const hasSignificantChange = Math.abs(fatChange) > 0.1 || Math.abs(muscleChange) > 0.1;

  return (
    <ConditionalMotion
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-8"
    >
      {/* Carte d'information */}
      <GlassCard
        className="p-6"
        style={{
          background: `radial-gradient(ellipse at center,
            rgba(16, 185, 129, 0.12) 0%,
            rgba(5, 150, 105, 0.06) 50%,
            rgba(0, 0, 0, 0.3) 100%)`,
          borderColor: 'rgba(16, 185, 129, 0.3)',
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.15), 0 8px 32px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `radial-gradient(circle,
                rgba(16, 185, 129, 0.3) 0%,
                rgba(5, 150, 105, 0.15) 70%,
                transparent 100%)`,
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
            }}
          >
            <SpatialIcon Icon={ICONS.Info} size={24} style={{ color: '#10B981' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-2">Comment fonctionne la projection ?</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Ajustez votre qualité nutritionnelle et votre intensité sportive pour voir comment votre corps évoluera dans le temps.
              Les projections sont basées sur votre morphologie actuelle et utilisent des modèles scientifiques de composition corporelle.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Contrôles de projection */}
      <ProjectionControls
        params={projectionParams}
        onParamsChange={handleParamsChange}
        warnings={projectionResult?.warnings || []}
        fatChange={fatChange}
        muscleChange={muscleChange}
        projectionResult={projectionResult ? {
          estimatedBodyFatPercent: projectionResult.estimatedBodyFatPercent,
          estimatedWaistReductionCm: projectionResult.estimatedWaistReductionCm,
          estimatedLeanMassGainKg: projectionResult.estimatedLeanMassGainKg,
          healthRiskReduction: projectionResult.healthRiskReduction,
          metabolicImprovementPercent: projectionResult.metabolicImprovementPercent,
        } : undefined}
      />

      {/* 3D Viewer avec projection */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%),
                  linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.25))
                `,
                border: '2px solid rgba(16, 185, 129, 0.5)',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
              }}
            >
              <SpatialIcon Icon={ICONS.Eye} size={20} style={{ color: '#10B981' }} variant="pure" />
            </div>
            <h3 className="text-white font-semibold">Aperçu de votre transformation</h3>
          </div>

          {hasSignificantChange && (
            <button
              onClick={handleReset}
              className="btn-glass px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors"
              title="Réinitialiser à la morphologie actuelle"
            >
              <SpatialIcon Icon={ICONS.RotateCcw} size={16} />
              <span>Réinitialiser</span>
            </button>
          )}
        </div>

        <div className="avatar-3d-viewer-container h-[400px] sm:h-[500px] lg:h-[600px] rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-400/20 relative overflow-hidden">
          <Suspense fallback={<ProjectionTabSkeleton />}>
            <Avatar3DViewer
              userProfile={userProfile}
              overrideMorphData={projectedMorphData}
              overrideLimbMasses={displayLimbMasses}
              overrideSkinTone={displaySkinTone}
              overrideGender={resolvedGender}
              faceMorphData={faceMorphData}
              faceSkinTone={faceSkinTone}
              className="w-full h-full"
              autoRotate={true}
              showControls={true}
            />
          </Suspense>

          {/* Badge de différence si changement significatif */}
          {hasSignificantChange && (
            <div
              className="absolute top-4 right-4 px-4 py-2 rounded-xl backdrop-blur-md"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.4), rgba(5,150,105,0.3))',
                border: '1px solid rgba(16,185,129,0.5)',
                boxShadow: '0 0 20px rgba(16,185,129,0.3)'
              }}
            >
              <div className="flex items-center gap-2">
                <SpatialIcon Icon={ICONS.TrendingUp} size={16} style={{ color: '#10B981' }} />
                <span className="text-white text-sm font-semibold">Projection active</span>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Bouton de sauvegarde */}
      {hasSignificantChange && (
        <GlassCard className="p-4">
          <button
            onClick={() => {
              click();
              setShowSaveModal(true);
            }}
            disabled={isCreating}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.2))',
              border: '2px solid rgba(16,185,129,0.5)',
              boxShadow: '0 0 20px rgba(16,185,129,0.2)',
              opacity: isCreating ? 0.5 : 1
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <SpatialIcon Icon={ICONS.Save} size={20} style={{ color: '#10B981' }} />
              <span>{isCreating ? 'Sauvegarde...' : 'Sauvegarder cette projection'}</span>
            </div>
          </button>
        </GlassCard>
      )}

      {/* Modal de sauvegarde */}
      {showSaveModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 'var(--z-modal-backdrop)',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)'
          }}
          onClick={() => setShowSaveModal(false)}
        >
          <ConditionalMotion
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{ zIndex: 'var(--z-modal)', position: 'relative' }}
          >
            <GlassCard className="p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Sauvegarder la projection</h3>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <SpatialIcon Icon={ICONS.X} size={20} className="text-white/70" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">Nom de la projection</label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder={`Projection ${new Date().toLocaleDateString('fr-FR')}`}
                    className="w-full px-4 py-2 rounded-lg text-white bg-white/5 border border-white/10 focus:border-emerald-400/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm mb-2">Description (optionnel)</label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Décrivez votre objectif..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg text-white bg-white/5 border border-white/10 focus:border-emerald-400/50 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-2 rounded-lg font-medium text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isCreating}
                    className="flex-1 py-2 rounded-lg font-semibold text-white transition-colors"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.8), rgba(5,150,105,0.9))',
                      border: '2px solid rgba(16,185,129,0.6)',
                      opacity: isCreating ? 0.5 : 1
                    }}
                  >
                    {isCreating ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            </GlassCard>
          </ConditionalMotion>
        </div>
      )}

      {/* Liste des projections sauvegardées */}
      {projections.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <SpatialIcon Icon={ICONS.Archive} size={20} className="text-emerald-400" />
            <h3 className="text-white font-semibold">Projections sauvegardées ({projections.length})</h3>
          </div>
          <SavedProjectionsList
            projections={projections}
            onLoadProjection={handleLoadProjection}
            onDeleteProjection={handleDeleteProjection}
            onToggleFavorite={handleToggleFavorite}
            isDeleting={isDeleting}
          />
        </GlassCard>
      )}

      {/* Comparaison avant/après */}
      {hasSignificantChange && (
        <GlassCard
          className="p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))',
            borderColor: 'rgba(16,185,129,0.2)'
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <SpatialIcon Icon={ICONS.GitCompare} size={20} className="text-emerald-400" />
            <h3 className="text-white font-semibold">Comparaison morphologique</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SpatialIcon Icon={ICONS.Triangle} size={18} className="text-amber-400" />
                  <span className="text-white/90 font-medium">Masse grasse</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-white">
                  {(baseMorphData.pearFigure || 0).toFixed(2)}
                </span>
                <SpatialIcon Icon={ICONS.ArrowRight} size={20} className="text-white/40" />
                <span className="text-3xl font-bold" style={{ color: fatChange < 0 ? '#10B981' : '#EF4444' }}>
                  {projectionResult?.pearFigure.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <SpatialIcon
                  Icon={fatChange < 0 ? ICONS.TrendingDown : ICONS.TrendingUp}
                  size={14}
                  style={{ color: fatChange < 0 ? '#10B981' : '#EF4444' }}
                />
                <span style={{ color: fatChange < 0 ? '#10B981' : '#EF4444' }}>
                  {fatChange > 0 ? '+' : ''}{fatChange.toFixed(2)} {fatChange < 0 ? '(réduction)' : '(augmentation)'}
                </span>
              </div>
            </div>

            <div
              className="p-4 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SpatialIcon Icon={ICONS.Zap} size={18} className="text-purple-400" />
                  <span className="text-white/90 font-medium">Masse musculaire</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-white">
                  {(baseMorphData.bodybuilderSize || 0).toFixed(2)}
                </span>
                <SpatialIcon Icon={ICONS.ArrowRight} size={20} className="text-white/40" />
                <span className="text-3xl font-bold" style={{ color: muscleChange > 0 ? '#10B981' : '#EF4444' }}>
                  {projectionResult?.bodybuilderSize.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <SpatialIcon
                  Icon={muscleChange > 0 ? ICONS.TrendingUp : ICONS.TrendingDown}
                  size={14}
                  style={{ color: muscleChange > 0 ? '#10B981' : '#EF4444' }}
                />
                <span style={{ color: muscleChange > 0 ? '#10B981' : '#EF4444' }}>
                  {muscleChange > 0 ? '+' : ''}{muscleChange.toFixed(2)} {muscleChange > 0 ? '(développement)' : '(atrophie)'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </ConditionalMotion>
  );
};

export default ProjectionTab;
