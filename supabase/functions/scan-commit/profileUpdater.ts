/**
 * Updates the user_profile table with the latest scan data and preferences.
 */ export async function updateUserProfile(supabase, userId, estimateResult, matchResult, semanticResult, aiRefinementResult, resolvedGender, finalShapeParams, finalLimbMasses, skinTone, gltfModelId, materialConfigVersion, avatarVersion) {
  console.log('🔍 [profileUpdater] Updating user profile for user:', {
    userId,
    resolvedGender,
    hasFinalShapeParams: !!finalShapeParams,
    finalShapeParamsCount: finalShapeParams ? Object.keys(finalShapeParams).length : 0,
    hasFinalLimbMasses: !!finalLimbMasses,
    finalLimbMassesCount: finalLimbMasses ? Object.keys(finalLimbMasses).length : 0,
    hasSkinTone: !!skinTone,
    gltfModelId,
    avatarVersion,
    philosophy: 'profile_update_entry'
  });
  // Fetch current user profile to merge preferences
  const { data: currentProfile, error: fetchError } = await supabase.from('user_profile').select('preferences').eq('user_id', userId).single();
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ [profileUpdater] Failed to fetch current user profile:', {
      userId,
      error: fetchError.message,
      errorCode: fetchError.code,
      errorDetails: fetchError.details,
      philosophy: 'profile_fetch_error_non_critical'
    });
  // Continue despite error, as upsert will handle creation if profile doesn't exist
  }
  // Prepare the new avatar data for preferences
  const newAvatarPreferences = {
    final_shape_params: finalShapeParams,
    final_limb_masses: finalLimbMasses,
    skin_tone: skinTone,
    resolved_gender: resolvedGender,
    gltf_model_id: gltfModelId,
    material_config_version: materialConfigVersion,
    mapping_version: 'v1.0',
    avatar_version: avatarVersion,
    lastMorphSave: new Date().toISOString()
  };
  // Merge existing preferences with new avatar data
  // CRITICAL: Ensure existing 'face' data is preserved if it exists
  const mergedPreferences = {
    ...currentProfile?.preferences || {},
    ...newAvatarPreferences
  };

  console.log('🔍 [profileUpdater] Merged preferences prepared', {
    userId,
    hasExistingPreferences: !!currentProfile?.preferences,
    existingPreferencesKeys: currentProfile?.preferences ? Object.keys(currentProfile.preferences) : [],
    newAvatarPreferencesKeys: Object.keys(newAvatarPreferences),
    mergedPreferencesKeys: Object.keys(mergedPreferences),
    hasFaceDataPreserved: !!mergedPreferences.face,
    philosophy: 'preferences_merge_validation'
  });
  const { error: updateError } = await supabase.from('user_profile').upsert({
    user_id: userId,
    preferences: mergedPreferences,
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'user_id'
  } // Upsert based on user_id
  );
  if (updateError) {
    console.error('❌ [profileUpdater] Failed to update user profile:', {
      userId,
      error: updateError.message,
      errorCode: updateError.code,
      errorDetails: updateError.details,
      errorHint: updateError.hint,
      philosophy: 'profile_upsert_error'
    });
    throw new Error(`Failed to update user profile: ${updateError.message}`);
  }
  console.log('✅ [profileUpdater] User profile updated successfully with latest scan data and merged preferences.', {
    userId,
    mergedPreferencesKeys: Object.keys(mergedPreferences),
    philosophy: 'profile_update_success'
  });
}
