/**
 * MissingDataDetector - Detects Missing User Data
 * Analyzes user knowledge and suggests proactive actions
 *
 * UNIFIED WITH profileCompletionService
 * Uses ProfileKnowledgeAdapter to ensure consistency across all profile alerts
 */

import logger from '../../../lib/utils/logger';
import type {
  UserKnowledge,
  AppContext,
  MissingDataReport,
  ProactiveSuggestion,
  ForgeType
} from '../types';
import { ProfileKnowledgeAdapter } from '../integration/ProfileKnowledgeAdapter';
import { calculateProfileCompletenessForForge } from '../../../lib/profile/profileCompleteness';

export class MissingDataDetector {
  private rawProfile: any | null = null;

  /**
   * Set raw profile data for unified profile completeness checks
   */
  setRawProfile(rawProfile: any | null): void {
    this.rawProfile = rawProfile;
  }

  /**
   * Analyze user knowledge and detect missing data
   */
  analyze(knowledge: UserKnowledge, appContext: AppContext): MissingDataReport {
    const suggestions: ProactiveSuggestion[] = [];

    // Check profile completeness using unified profileCompletionService
    const hasIncompletProfile = this.checkProfileCompleteness(knowledge, suggestions);

    // Check nutrition data
    this.checkNutritionData(knowledge, appContext, suggestions);

    // Check fasting data
    this.checkFastingData(knowledge, suggestions);

    // Check body scan data
    this.checkBodyScanData(knowledge, suggestions);

    // Check equipment scan
    this.checkEquipmentData(knowledge, suggestions);

    // Determine missing forges (only mandatory ones)
    // Note: body-scan and equipment are OPTIONAL features, not required
    const missingForges: ForgeType[] = [];
    if (!knowledge.nutrition.hasData) missingForges.push('nutrition');
    if (!knowledge.fasting.hasData) missingForges.push('fasting');

    // Sort suggestions by priority
    suggestions.sort((a, b) => b.priority - a.priority);

    const priority = this.determinePriority(suggestions, hasIncompletProfile);

    logger.debug('MISSING_DATA_DETECTOR', 'Analysis complete', {
      suggestionsCount: suggestions.length,
      missingForges: missingForges.length,
      priority,
      hasIncompletProfile
    });

    return {
      hasIncompletProfile,
      missingForges,
      suggestions: suggestions.slice(0, 3), // Top 3 suggestions
      priority
    };
  }

  /**
   * Check profile completeness using unified profileCompletionService
   * SYNCHRONIZED with ProfileNudge, ProfileNudgeCTA, and ProfileCompletenessAlert
   */
  private checkProfileCompleteness(
    knowledge: UserKnowledge,
    suggestions: ProactiveSuggestion[]
  ): boolean {
    try {
      // Convert UserKnowledge to UserProfile using adapter
      const userProfile = ProfileKnowledgeAdapter.toUserProfile(knowledge, this.rawProfile);

      if (!userProfile) {
        logger.debug('MISSING_DATA_DETECTOR', 'Could not convert knowledge to profile, using fallback');
        return this.checkProfileCompletenessFallback(knowledge, suggestions);
      }

    // Use profileCompletionService as single source of truth
    const completeness = calculateProfileCompletenessForForge(userProfile, 'training');

    logger.debug('MISSING_DATA_DETECTOR', 'Profile completeness check (unified)', {
      percentage: completeness.percentage,
      canProvideAccurateAnalysis: completeness.canProvideAccurateAnalysis,
      missingCritical: completeness.missingCritical.length,
      missingHighPriority: completeness.missingHighPriority?.length || 0
    });

    // Profile is incomplete if we can't provide accurate analysis
    const hasIncompleteProfile = !completeness.canProvideAccurateAnalysis;

    if (hasIncompleteProfile) {
      // Extract missing field labels for user-friendly message
      const missingLabels = completeness.missingCritical
        .map((field) => field.label.toLowerCase())
        .slice(0, 3);

      const message =
        missingLabels.length > 0
          ? `Complète ton profil (${missingLabels.join(', ')}) pour des recommandations personnalisées`
          : 'Complète ton profil pour des recommandations personnalisées';

      suggestions.push({
        id: 'complete-profile',
        forge: 'training',
        action: 'complete_profile',
        message,
        priority: 100,
        reason: 'profile_incomplete',
        timing: 'now'
      });

      return true;
    }

      return false;
    } catch (error) {
      logger.debug('MISSING_DATA_DETECTOR', 'Error in profile completeness check, using fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.checkProfileCompletenessFallback(knowledge, suggestions);
    }
  }

  /**
   * Fallback profile completeness check if adapter conversion fails
   */
  private checkProfileCompletenessFallback(
    knowledge: UserKnowledge,
    suggestions: ProactiveSuggestion[]
  ): boolean {
    const profile = knowledge.profile;
    const missing: string[] = [];

    // Core identity checks
    if (!profile.sex) missing.push('sexe');
    if (!profile.birthdate && !profile.age) missing.push('âge');
    if (!profile.weight) missing.push('poids');
    if (!profile.height) missing.push('taille');

    // Objectives & activity
    if (!profile.objective && (!profile.objectives || profile.objectives.length === 0)) {
      missing.push('objectif');
    }
    if (!profile.activityLevel) missing.push('niveau d\'activité');

    // Training preferences
    if (!profile.preferredDisciplines || profile.preferredDisciplines.length === 0) {
      missing.push('disciplines préférées');
    }

    logger.debug('MISSING_DATA_DETECTOR', 'Profile completeness check (fallback)', {
      sex: profile.sex,
      age: profile.age,
      birthdate: profile.birthdate,
      weight: profile.weight,
      height: profile.height,
      targetWeight: profile.targetWeight,
      bodyFatPerc: profile.bodyFatPerc,
      objective: profile.objective,
      activityLevel: profile.activityLevel,
      jobCategory: profile.jobCategory,
      objectives: profile.objectives?.length || 0,
      disciplines: profile.preferredDisciplines?.length || 0,
      defaultDiscipline: profile.defaultDiscipline,
      country: profile.country,
      language: profile.preferredLanguage,
      hasCompletedBodyScan: profile.hasCompletedBodyScan,
      missing: missing.length
    });

    if (missing.length > 0) {
      suggestions.push({
        id: 'complete-profile',
        forge: 'training',
        action: 'complete_profile',
        message: `Complète ton profil (${missing.join(', ')}) pour des recommandations personnalisées`,
        priority: 100,
        reason: 'profile_incomplete',
        timing: 'now'
      });
      return true;
    }

    return false;
  }

  /**
   * Check nutrition data
   */
  private checkNutritionData(
    knowledge: UserKnowledge,
    appContext: AppContext,
    suggestions: ProactiveSuggestion[]
  ): void {
    if (!knowledge.nutrition.hasData) {
      const isAfterTraining = appContext.activityState === 'post-training';
      const isEvening = new Date().getHours() >= 18;

      suggestions.push({
        id: 'scan-first-meal',
        forge: 'nutrition',
        action: 'scan_meal',
        message: "Scanne ton prochain repas pour suivre ta nutrition et optimiser tes résultats",
        priority: 70,
        reason: 'no_nutrition_data',
        timing: isAfterTraining ? 'now' : isEvening ? 'evening' : 'after-training'
      });
      return;
    }

    // Check if last scan was today
    if (knowledge.nutrition.lastScanDate) {
      const lastScan = new Date(knowledge.nutrition.lastScanDate);
      const today = new Date();
      const isToday =
        lastScan.getDate() === today.getDate() &&
        lastScan.getMonth() === today.getMonth() &&
        lastScan.getFullYear() === today.getFullYear();

      if (!isToday) {
        suggestions.push({
          id: 'scan-meal-today',
          forge: 'nutrition',
          action: 'scan_meal',
          message: "Tu n'as pas scanné de repas aujourd'hui, pense à le faire pour suivre ta nutrition",
          priority: 50,
          reason: 'no_scan_today',
          timing: 'evening'
        });
      }
    }
  }

  /**
   * Check fasting data
   */
  private checkFastingData(
    knowledge: UserKnowledge,
    suggestions: ProactiveSuggestion[]
  ): void {
    if (!knowledge.fasting.hasData) {
      suggestions.push({
        id: 'start-fasting',
        forge: 'fasting',
        action: 'start_fasting',
        message: 'Essaye le jeûne intermittent pour optimiser ta composition corporelle',
        priority: 30,
        reason: 'no_fasting_data',
        timing: 'morning'
      });
    }
  }

  /**
   * Check body scan data
   */
  private checkBodyScanData(
    knowledge: UserKnowledge,
    suggestions: ProactiveSuggestion[]
  ): void {
    if (!knowledge.bodyScan.hasData) {
      suggestions.push({
        id: 'do-body-scan',
        forge: 'body-scan',
        action: 'scan_body',
        message: 'Fais un scan corporel pour suivre ton évolution physique',
        priority: 40,
        reason: 'no_body_scan',
        timing: 'morning'
      });
    }
  }

  /**
   * Check equipment data
   */
  private checkEquipmentData(
    knowledge: UserKnowledge,
    suggestions: ProactiveSuggestion[]
  ): void {
    if (knowledge.equipment.locations.length === 0) {
      suggestions.push({
        id: 'scan-equipment',
        forge: 'equipment',
        action: 'scan_equipment',
        message: "Scanne ton lieu d'entraînement pour des programmes adaptés à ton équipement",
        priority: 80,
        reason: 'no_equipment_scan',
        timing: 'now'
      });
    } else if (!knowledge.equipment.lastScanDate) {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      suggestions.push({
        id: 'rescan-equipment',
        forge: 'equipment',
        action: 'scan_equipment',
        message: "Mets à jour ton équipement si tu as du nouveau matériel",
        priority: 20,
        reason: 'equipment_outdated',
        timing: 'now'
      });
    }
  }

  /**
   * Determine overall priority
   */
  private determinePriority(
    suggestions: ProactiveSuggestion[],
    hasIncompletProfile: boolean
  ): 'high' | 'medium' | 'low' {
    if (hasIncompletProfile) return 'high';
    if (suggestions.length === 0) return 'low';
    if (suggestions[0].priority >= 70) return 'high';
    if (suggestions[0].priority >= 40) return 'medium';
    return 'low';
  }
}
