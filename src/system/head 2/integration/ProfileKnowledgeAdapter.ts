/**
 * ProfileKnowledgeAdapter
 * Adapts UserKnowledge from head system to UserProfile format for profileCompletionService
 * This ensures consistency between proactive suggestions and profile alerts
 */

import type { UserKnowledge, ProfileKnowledge } from '../types';
import type { UserProfile } from '../../../domain/profile';
import logger from '../../../lib/utils/logger';

export class ProfileKnowledgeAdapter {
  /**
   * Convert UserKnowledge to UserProfile format
   * This allows the head system to use profileCompletionService as the single source of truth
   */
  static toUserProfile(knowledge: UserKnowledge, rawProfile: any | null): UserProfile | null {
    if (!rawProfile) {
      logger.debug('PROFILE_KNOWLEDGE_ADAPTER', 'No raw profile data available');
      return null;
    }

    try {
      // The rawProfile comes directly from Supabase and has all the fields
      // We just need to ensure type compatibility
      const profile: UserProfile = {
        userId: knowledge.profile.userId,

        // Identity fields (from ProfileKnowledge)
        sex: knowledge.profile.sex || rawProfile.sex,
        birthdate: knowledge.profile.birthdate || rawProfile.birthdate,
        height_cm: knowledge.profile.height || rawProfile.height_cm,
        weight_kg: knowledge.profile.weight || rawProfile.weight_kg,
        target_weight_kg: knowledge.profile.targetWeight || rawProfile.target_weight_kg,
        objective: knowledge.profile.objective || rawProfile.objective,
        activity_level: knowledge.profile.activityLevel || rawProfile.activity_level,
        job_category: knowledge.profile.jobCategory || rawProfile.job_category,
        country: knowledge.profile.country || rawProfile.country,

        // Nutrition fields
        nutrition: rawProfile.nutrition || {},
        householdDetails: rawProfile.household_details || {},
        mealPrepPreferences: rawProfile.meal_prep_preferences || {},
        kitchenEquipment: rawProfile.kitchen_equipment || [],
        foodPreferences: rawProfile.food_preferences || {},
        macroTargets: rawProfile.macro_targets || {},
        shoppingPreferences: rawProfile.shopping_preferences || {},

        // Health fields
        health: rawProfile.health || {},

        // Fasting fields
        fastingPreferences: rawProfile.fasting_preferences || {},

        // Training fields
        disciplinePreferences: rawProfile.discipline_preferences || {},
        preferred_disciplines: knowledge.profile.preferredDisciplines || rawProfile.preferred_disciplines || [],

        // Constraints
        constraints: rawProfile.constraints || {},

        // Additional fields from ProfileKnowledge
        display_name: knowledge.profile.displayName || rawProfile.display_name,
        full_name: knowledge.profile.fullName || rawProfile.full_name,
        email: knowledge.profile.email || rawProfile.email,
        phone_number: rawProfile.phone_number, // Keep in rawProfile but not in ProfileKnowledge
        language: knowledge.profile.language || rawProfile.language,
        preferred_language: knowledge.profile.preferredLanguage || rawProfile.preferred_language,
        timezone: rawProfile.timezone,
        body_fat_perc: knowledge.profile.bodyFatPerc || rawProfile.body_fat_perc,
        default_discipline: knowledge.profile.defaultDiscipline || rawProfile.default_discipline,
        has_completed_body_scan: knowledge.profile.hasCompletedBodyScan ?? rawProfile.has_completed_body_scan,
        avatar_status: rawProfile.avatar_status, // Keep in rawProfile but not in ProfileKnowledge
        avatar_url: rawProfile.avatar_url, // Keep in rawProfile but not in ProfileKnowledge
        portrait_url: rawProfile.portrait_url, // Keep in rawProfile but not in ProfileKnowledge

        // Metadata
        created_at: rawProfile.created_at,
        updated_at: rawProfile.updated_at,

        // Additional legacy support
        objectives: knowledge.profile.objectives,
        level: knowledge.profile.level,
        equipment: knowledge.profile.equipment
      } as UserProfile;

      logger.debug('PROFILE_KNOWLEDGE_ADAPTER', 'Converted knowledge to UserProfile', {
        userId: profile.userId,
        hasSex: !!profile.sex,
        hasWeight: !!profile.weight_kg,
        hasHeight: !!profile.height_cm,
        hasObjective: !!profile.objective,
        hasTargetWeight: !!profile.target_weight_kg,
        hasBodyFat: !!profile.body_fat_perc,
        hasActivityLevel: !!profile.activity_level,
        hasJobCategory: !!profile.job_category,
        hasCountry: !!profile.country,
        hasLanguage: !!profile.preferred_language,
        hasDefaultDiscipline: !!profile.default_discipline,
        hasCompletedBodyScan: !!profile.has_completed_body_scan,
        preferredDisciplinesCount: profile.preferred_disciplines?.length || 0
      });

      return profile;
    } catch (error) {
      logger.error('PROFILE_KNOWLEDGE_ADAPTER', 'Error converting knowledge to UserProfile', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Extract the most critical missing fields for display
   */
  static extractMissingFieldsSummary(
    missingHighPriority: Array<{ key: string; label: string; description: string }>
  ): string[] {
    return missingHighPriority.slice(0, 3).map((field) => field.label.toLowerCase());
  }

  /**
   * Determine forge type from profile tab
   */
  static getForgeFromTab(
    profileTab: 'identity' | 'nutrition' | 'health' | 'fasting' | 'preferences' | 'avatar' | 'training'
  ): 'training' | 'nutrition' | 'fasting' | 'body-scan' | 'equipment' {
    switch (profileTab) {
      case 'nutrition':
        return 'nutrition';
      case 'fasting':
        return 'fasting';
      case 'avatar':
      case 'health':
        return 'body-scan';
      case 'training':
        return 'training';
      case 'identity':
      case 'preferences':
      default:
        return 'training'; // Default to training for general profile fields
    }
  }
}
