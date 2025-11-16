import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../../../lib/utils/logger';
import { calculateAge } from '../../../../lib/utils/dateUtils';
import type { ProfileKnowledge } from '../../types';
import { getDefaultProfileKnowledge } from './defaults';

export async function loadProfileKnowledge(
  supabase: SupabaseClient,
  userId: string,
  setRawProfile: (profile: any) => void
): Promise<ProfileKnowledge> {
  const { data: profile, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('USER_KNOWLEDGE_BASE', 'Failed to load profile', { userId, error });
    throw error;
  }

  if (!profile) {
    logger.warn('USER_KNOWLEDGE_BASE', 'No profile found, using defaults', { userId });
    setRawProfile(null);
    return getDefaultProfileKnowledge(userId);
  }

  const cleanedProfile = { ...profile };

  delete cleanedProfile.avatar_generation_status;
  delete cleanedProfile.avatar_creation_progress;
  delete cleanedProfile.avatar_generation_stage;
  delete cleanedProfile.avatar_onboarding_complete;
  delete cleanedProfile.avatar_generation_concept_day;
  delete cleanedProfile.avatar_status;
  delete cleanedProfile.portrait_source;
  delete cleanedProfile.portrait_url;
  delete cleanedProfile.facial_keypoints;
  delete cleanedProfile.color_palette;
  delete cleanedProfile.skin_tone;
  delete cleanedProfile.skin_tone_v2_migrated;
  delete cleanedProfile.migrate;
  delete cleanedProfile.hip_mass;
  delete cleanedProfile.shoulder_mass;
  delete cleanedProfile.active_face_profile;

  setRawProfile(cleanedProfile);

  return {
    userId,
    displayName: profile.display_name,
    fullName: profile.full_name,
    email: profile.email,
    age: calculateAge(profile.birthdate),
    sex: profile.sex,
    birthdate: profile.birthdate,
    height: profile.height_cm,
    weight: profile.weight_kg,
    targetWeight: profile.target_weight_kg,
    bodyFatPerc: profile.body_fat_perc,
    objectives: profile.objectives || [],
    objective: profile.objective,
    activityLevel: profile.activity_level,
    jobCategory: profile.job_category,
    preferredDisciplines: profile.preferred_disciplines || [],
    defaultDiscipline: profile.default_discipline,
    level: profile.level,
    equipment: profile.equipment || [],
    country: profile.country,
    language: profile.language,
    preferredLanguage: profile.preferred_language,
    hasCompletedBodyScan: profile.has_completed_body_scan,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}
