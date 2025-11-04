import { useMemo } from 'react';
import { useMorphologyMapping } from './useMorphologyMapping';
import logger from '../lib/utils/logger';

export type NutritionQuality = 1 | 2 | 3 | 4 | 5;
export type SportIntensity = 1 | 2 | 3 | 4 | 5;
export type ProjectionDuration = '3_months' | '6_months' | '1_year' | '3_years';

export interface ProjectionParams {
  nutritionQuality: NutritionQuality;
  sportIntensity: SportIntensity;
  duration: ProjectionDuration;
}

export interface ProjectionResult {
  pearFigure: number;
  bodybuilderSize: number;
  isValid: boolean;
  warnings: string[];
  // Métriques calculées pour motivation
  estimatedBodyFatPercent?: number;
  estimatedWaistReductionCm?: number;
  estimatedLeanMassGainKg?: number;
  healthRiskReduction?: string;
  metabolicImprovementPercent?: number;
}

// Multiplicateurs de durée réalistes et cohérents (RÉDUITS pour plus de réalisme)
const DURATION_MULTIPLIERS: Record<ProjectionDuration, number> = {
  '3_months': 0.20,  // Réduction réaliste court terme
  '6_months': 0.40,  // Progression modérée 6 mois
  '1_year': 0.70,    // Référence ajustée
  '3_years': 1.80,   // Transformation long terme réaliste
};

// Coefficients réalistes pour pearFigure (ventre/gras) et bodybuilderSize (muscle) (RÉDUITS)
const NUTRITION_BASE_COEFFICIENT = 0.25;  // Impact nutritionnel modéré
const SPORT_BURN_COEFFICIENT = 0.15;      // Brûlage graisse réaliste
const SPORT_MUSCLE_COEFFICIENT = 0.18;    // Développement musculaire progressif
const NUTRITION_MUSCLE_COEFFICIENT = 0.08; // Support nutritionnel modéré

// Bonus synergique réduit pour plus de réalisme
const SYNERGY_THRESHOLD = 4; // Niveau à partir duquel le bonus s'applique
const SYNERGY_BONUS_MULTIPLIER = 1.10; // +10% d'efficacité (réduit)

/**
 * Hook pour calculer les projections morphologiques basées sur nutrition, sport et durée
 * Utilise uniquement 2 clés de forme: pearFigure (masse grasse) et bodybuilderSize (masse musculaire)
 */
export function useProjectionCalculator(
  baseMorphData: Record<string, number>,
  gender: 'male' | 'female'
) {
  const { getMorphValueRange } = useMorphologyMapping();

  const calculateProjection = useMemo(() => {
    return (params: ProjectionParams): ProjectionResult => {
      logger.debug('PROJECTION_CALCULATOR', 'Computing projection', {
        params,
        gender,
        philosophy: 'projection_calculation_start'
      });

      const warnings: string[] = [];

      // Récupérer les ranges pour les 2 clés morphologiques
      const pearFigureRange = getMorphValueRange('pearFigure', gender);
      const bodybuilderSizeRange = getMorphValueRange('bodybuilderSize', gender);

      if (!pearFigureRange || !bodybuilderSizeRange) {
        logger.error('PROJECTION_CALCULATOR', 'Missing morph ranges', {
          hasPearFigureRange: !!pearFigureRange,
          hasBodybuilderSizeRange: !!bodybuilderSizeRange
        });
        return {
          pearFigure: baseMorphData.pearFigure || 0,
          bodybuilderSize: baseMorphData.bodybuilderSize || 0,
          isValid: false,
          warnings: ['Impossible de calculer la projection : données manquantes']
        };
      }

      // Valeurs de base actuelles
      const basePearFigure = baseMorphData.pearFigure || 0;
      const baseBodybuilderSize = baseMorphData.bodybuilderSize || 0;

      // Multiplicateur temporel (plus c'est long, plus l'effet est prononcé)
      const timeFactor = DURATION_MULTIPLIERS[params.duration];

      /**
       * CALCUL DE L'ÉVOLUTION DE LA MASSE GRASSE (pearFigure)
       * Système réaliste et cohérent
       *
       * Logique:
       * - Nutrition excellente (5) + Sport intense (5) = progression optimale réaliste
       * - Coefficients modérés pour résultats cohérents sur toutes durées
       * - Bonus synergique modéré (+15%) quand nutrition ET sport sont excellents
       * - Effet plateau réaliste quand on approche des limites basses
       * - Bonus léger pour ceux qui partent d'un pearFigure très élevé
       */

      // Impact nutritionnel progressif
      let nutritionImpact = (params.nutritionQuality - 3) * -NUTRITION_BASE_COEFFICIENT;
      if (params.nutritionQuality === 5) {
        nutritionImpact *= 1.15; // Bonus modéré 15% pour nutrition parfaite (réduit)
      }

      // Impact sportif sur brûlage des graisses
      let sportBurnImpact = (params.sportIntensity - 1) * -SPORT_BURN_COEFFICIENT;
      if (params.sportIntensity === 5) {
        sportBurnImpact *= 1.10; // Bonus modéré 10% pour sport très intense (réduit)
      }

      // Bonus synergique: quand nutrition ET sport sont excellents
      const hasSynergy = params.nutritionQuality >= SYNERGY_THRESHOLD &&
                         params.sportIntensity >= SYNERGY_THRESHOLD;
      const synergyMultiplier = hasSynergy ? SYNERGY_BONUS_MULTIPLIER : 1.0;

      // Bonus modéré pour ceux qui ont beaucoup de gras à perdre
      const motivationBonus = basePearFigure > 1.5 ? 1.08 : 1.0;

      // Effet plateau: plus c'est bas, plus c'est difficile de perdre (réalisme)
      const plateauFactor = basePearFigure < 0 ? 0.6 : 1.0;

      const totalFatChange = (
        (nutritionImpact + sportBurnImpact) *
        timeFactor *
        synergyMultiplier *
        motivationBonus *
        plateauFactor
      );

      let projectedPearFigure = basePearFigure + totalFatChange;

      /**
       * CALCUL DE L'ÉVOLUTION DE LA MASSE MUSCULAIRE (bodybuilderSize)
       * Système réaliste pour gains musculaires progressifs
       *
       * Logique:
       * - Sport intense (5) + Nutrition excellente (5) = développement musculaire optimal
       * - Coefficients modérés pour progression réaliste
       * - Bonus synergique léger (+10%) pour combinaison sport + nutrition
       * - Pénalité réaliste si nutrition insuffisante même avec sport intense
       */

      // Impact sportif sur développement musculaire
      let sportGainImpact = (params.sportIntensity - 3) * SPORT_MUSCLE_COEFFICIENT;
      if (params.sportIntensity === 5) {
        sportGainImpact *= 1.10; // Bonus modéré 10% pour sport très intense (réduit)
      }

      // Support nutritionnel pour récupération et croissance
      let nutritionSupportImpact = (params.nutritionQuality - 3) * NUTRITION_MUSCLE_COEFFICIENT;
      if (params.nutritionQuality === 5) {
        nutritionSupportImpact *= 1.10; // Bonus modéré 10% pour nutrition optimale (réduit)
      }

      // Pénalité si sport intense mais nutrition mauvaise (catabolisme)
      const nutritionPenalty = (params.sportIntensity >= 4 && params.nutritionQuality <= 2) ? 0.6 : 1.0;

      // Bonus synergie modéré pour muscle
      const muscleSynergyMultiplier = hasSynergy ? 1.08 : 1.0;

      const totalMuscleChange = (
        (sportGainImpact + nutritionSupportImpact) *
        timeFactor *
        muscleSynergyMultiplier *
        nutritionPenalty
      );

      let projectedBodybuilderSize = baseBodybuilderSize + totalMuscleChange;

      /**
       * CLAMPING: S'assurer que les valeurs restent dans les ranges autorisés
       */
      const originalPearFigure = projectedPearFigure;
      const originalBodybuilderSize = projectedBodybuilderSize;

      projectedPearFigure = Math.max(
        pearFigureRange.min,
        Math.min(pearFigureRange.max, projectedPearFigure)
      );

      projectedBodybuilderSize = Math.max(
        bodybuilderSizeRange.min,
        Math.min(bodybuilderSizeRange.max, projectedBodybuilderSize)
      );

      // Messages motivants et informatifs selon les limites atteintes
      if (originalPearFigure !== projectedPearFigure) {
        if (projectedPearFigure === pearFigureRange.max) {
          warnings.push('⚠️ Niveau maximum de masse grasse atteint - Considérez augmenter sport et nutrition');
        } else if (projectedPearFigure === pearFigureRange.min) {
          warnings.push('🎯 Excellent ! Niveau optimal de masse grasse atteint - Définition maximale');
        }
      }

      if (originalBodybuilderSize !== projectedBodybuilderSize) {
        if (projectedBodybuilderSize === bodybuilderSizeRange.max) {
          warnings.push('💪 Développement musculaire maximal atteint - Niveau athlète d\'élite');
        } else if (projectedBodybuilderSize === bodybuilderSizeRange.min) {
          warnings.push('⚠️ Niveau minimal de masse musculaire - Risque de catabolisme');
        }
      }

      // Warnings progressifs réalistes pour motivation
      const fatReductionPercent = basePearFigure > 0
        ? Math.abs((projectedPearFigure - basePearFigure) / basePearFigure) * 100
        : 0;

      if (fatReductionPercent > 40) {
        warnings.push('🔥 Transformation majeure ! Réduction de masse grasse de ' + fatReductionPercent.toFixed(0) + '%');
      } else if (fatReductionPercent > 20) {
        warnings.push('✨ Excellente progression ! Réduction de ' + fatReductionPercent.toFixed(0) + '% de masse grasse');
      } else if (fatReductionPercent > 10) {
        warnings.push('💪 Bonne progression ! Réduction de ' + fatReductionPercent.toFixed(0) + '% de masse grasse');
      }

      // Warning si perte de muscle significative
      const muscleLoss = baseBodybuilderSize - projectedBodybuilderSize;
      if (muscleLoss > 0.4) {
        warnings.push('⚠️ Attention: Perte musculaire détectée - Augmentez protéines et sport');
      }

      // Message motivant si synergy active
      if (hasSynergy) {
        warnings.push('⚡ Synergie activée ! Nutrition et sport excellents = résultats optimaux (+10%)');
      }

      /**
       * VALIDATION INTER-MORPHS
       * Éviter des combinaisons extrêmes irréalistes
       */
      const combinedExtreme = Math.abs(projectedPearFigure) + Math.abs(projectedBodybuilderSize);
      const maxCombinedExtreme = gender === 'male' ? 3.5 : 3.0;

      if (combinedExtreme > maxCombinedExtreme) {
        warnings.push('Combinaison morphologique extrême détectée, résultats ajustés');

        // Réduire proportionnellement les deux valeurs
        const reductionFactor = maxCombinedExtreme / combinedExtreme;
        projectedPearFigure *= reductionFactor;
        projectedBodybuilderSize *= reductionFactor;
      }

      /**
       * CALCUL DES MÉTRIQUES MOTIVANTES
       * Conversion réaliste des valeurs morphologiques en métriques compréhensibles
       */

      // Estimation pourcentage de graisse corporelle basé sur pearFigure
      // Formule réaliste: pearFigure de -0.5 (athlète) à 2.0 (obésité) → 10-30% graisse
      const baseBodyFatPercent = 15 + (basePearFigure * 6); // Ratio réduit pour réalisme
      const projectedBodyFatPercent = 15 + (projectedPearFigure * 6);
      const bodyFatChange = baseBodyFatPercent - projectedBodyFatPercent;

      // Estimation réduction tour de taille (1 point pearFigure ≈ 5cm tour de taille)
      const waistReductionCm = Math.abs(projectedPearFigure - basePearFigure) * 5;

      // Estimation gain masse maigre en kg (1 point bodybuilderSize ≈ 3kg muscle)
      const leanMassGainKg = (projectedBodybuilderSize - baseBodybuilderSize) * 3;

      // Évaluation risque santé basé sur pearFigure (ventre = facteur risque cardio)
      let healthRiskReduction = '';
      const finalBodyFat = projectedBodyFatPercent;
      if (finalBodyFat < 15 && bodyFatChange > 3) {
        healthRiskReduction = 'Excellent - Risque cardiométabolique minimal';
      } else if (finalBodyFat < 20 && bodyFatChange > 2) {
        healthRiskReduction = 'Très bon - Réduction significative des risques santé';
      } else if (bodyFatChange > 1) {
        healthRiskReduction = 'Positif - Amélioration de la santé cardiovasculaire';
      } else if (bodyFatChange < -2) {
        healthRiskReduction = 'Attention - Augmentation du risque santé';
      }

      // Amélioration métabolique estimée réaliste (base sur perte graisse et gain muscle)
      const metabolicImprovement = (
        (bodyFatChange * 1.2) + // Perte graisse améliore métabolisme modérément
        (leanMassGainKg * 1.0) // Muscle augmente métabolisme basal
      );

      logger.info('PROJECTION_CALCULATOR', 'Projection computed with metrics', {
        basePearFigure: basePearFigure.toFixed(3),
        projectedPearFigure: projectedPearFigure.toFixed(3),
        fatChange: totalFatChange.toFixed(3),
        bodyFatPercent: projectedBodyFatPercent.toFixed(1),
        waistReductionCm: waistReductionCm.toFixed(1),
        leanMassGainKg: leanMassGainKg.toFixed(1),
        baseBodybuilderSize: baseBodybuilderSize.toFixed(3),
        projectedBodybuilderSize: projectedBodybuilderSize.toFixed(3),
        muscleChange: totalMuscleChange.toFixed(3),
        timeFactor,
        synergyActive: hasSynergy,
        warningsCount: warnings.length,
        philosophy: 'projection_calculation_complete'
      });

      return {
        pearFigure: Number(projectedPearFigure.toFixed(3)),
        bodybuilderSize: Number(projectedBodybuilderSize.toFixed(3)),
        isValid: true,
        warnings,
        estimatedBodyFatPercent: Number(projectedBodyFatPercent.toFixed(1)),
        estimatedWaistReductionCm: waistReductionCm > 0.5 ? Number(waistReductionCm.toFixed(1)) : undefined,
        estimatedLeanMassGainKg: Math.abs(leanMassGainKg) > 0.5 ? Number(leanMassGainKg.toFixed(1)) : undefined,
        healthRiskReduction: healthRiskReduction || undefined,
        metabolicImprovementPercent: Math.abs(metabolicImprovement) > 1 ? Number(metabolicImprovement.toFixed(0)) : undefined,
      };
    };
  }, [baseMorphData, gender, getMorphValueRange]);

  return { calculateProjection };
}
