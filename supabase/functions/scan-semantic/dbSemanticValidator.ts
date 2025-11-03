// supabase/functions/scan-semantic/validation/dbSemanticValidator.ts
/**
 * DB Semantic Validator
 * Validates semantic classifications against database rules
 */ export async function validateSemanticWithDB(supabase, rawSemanticProfile, extractedData, userDeclaredGender) {
  console.log('🔍 [dbSemanticValidator] Starting DB validation of semantic profile', {
    rawProfile: rawSemanticProfile,
    extractedData: {
      estimated_bmi: extractedData.estimated_bmi
    },
    userDeclaredGender
  });
  const validationFlags = [];
  const adjustmentsMade = [];
  // Get valid semantic categories from database
  const { data: archetypes, error } = await supabase.from('morph_archetypes').select('obesity, muscularity, level, morphotype').eq('gender', userDeclaredGender).limit(100);
  if (error) {
    console.warn('⚠️ [dbSemanticValidator] Could not fetch physiological ranges from DB, using defaults');
    validationFlags.push('db_fetch_failed');
  }
  // Extract unique valid values
  const validObesity = archetypes ? [
    ...new Set(archetypes.map((a)=>a.obesity).filter(Boolean))
  ] : [
    'Non obèse',
    'Surpoids',
    'Obèse',
    'Obésité morbide'
  ];
  const validMuscularity = archetypes ? [
    ...new Set(archetypes.map((a)=>a.muscularity).filter(Boolean))
  ] : [
    'Normal',
    'Moyen musclé',
    'Musclé',
    'Athlétique'
  ];
  const validLevels = archetypes ? [
    ...new Set(archetypes.map((a)=>a.level).filter(Boolean))
  ] : [
    'Normal',
    'Mince',
    'Surpoids',
    'Obèse'
  ];
  const validMorphotypes = archetypes ? [
    ...new Set(archetypes.map((a)=>a.morphotype).filter(Boolean))
  ] : [
    'REC',
    'POI',
    'SAB',
    'TRI',
    'OVA',
    'POM'
  ];
  // Log valid categories fetched from DB
  console.log('🔍 [dbSemanticValidator] Valid categories from DB:', {
    validObesity,
    validMuscularity,
    validLevels,
    validMorphotypes
  });
  // Validate and adjust obesity classification
  let obesity = rawSemanticProfile.obesity || 'Non obèse'; // Use rawSemanticProfile.obesity
  if (!validObesity.includes(obesity)) {
    // Map to closest valid obesity category based on BMI
    const bmi = extractedData.estimated_bmi;
    if (bmi > 30) {
      obesity = 'Obèse';
    } else if (bmi > 25) {
      obesity = 'Surpoids';
    } else {
      obesity = 'Non obèse';
    }
    adjustmentsMade.push(`obesity_adjusted_from_${rawSemanticProfile.obesity}_to_${obesity}`);
    console.log(`🔧 [dbSemanticValidator] Adjusted obesity: ${rawSemanticProfile.obesity} -> ${obesity}`);
  }
  // Validate and adjust muscularity classification
  // CRITICAL FIX: Lower thresholds to properly detect athletic builds with normal BMI
  let muscularity = rawSemanticProfile.muscularity || 'Normal'; // Use rawSemanticProfile.muscularity
  const aiMuscularityLevel = rawSemanticProfile.muscularity_level;
  const muscleDefinition = rawSemanticProfile.muscle_definition || 0;

  console.log(`🔍 [dbSemanticValidator] Muscularity classification input:`, {
    rawMuscularity: rawSemanticProfile.muscularity,
    aiMuscularityLevel: aiMuscularityLevel?.toFixed(3),
    muscleDefinition: muscleDefinition.toFixed(3),
    bmi: extractedData.estimated_bmi.toFixed(2),
    philosophy: 'lowered_thresholds_for_athletic_detection'
  });

  if (!validMuscularity.includes(muscularity)) {
    // CRITICAL FIX: Lowered thresholds from 0.7/0.9 to 0.45/0.65/0.85
    // This ensures athletic builds with normal BMI are properly classified
    if (aiMuscularityLevel >= 0.85 && validMuscularity.includes('Athlétique')) {
      muscularity = 'Athlétique';
    } else if (aiMuscularityLevel >= 0.65 && validMuscularity.includes('Musclé')) {
      muscularity = 'Musclé';
    } else if (aiMuscularityLevel >= 0.45 && validMuscularity.includes('Moyen musclé')) {
      muscularity = 'Moyen musclé';
    } else {
      muscularity = 'Normal'; // Default fallback
    }
    adjustmentsMade.push(`muscularity_adjusted_from_${rawSemanticProfile.muscularity}_to_${muscularity}_lowered_thresholds`);
    console.log(`🔧 [dbSemanticValidator] Adjusted muscularity: ${rawSemanticProfile.muscularity} -> ${muscularity} (AI level: ${aiMuscularityLevel?.toFixed(3)}, thresholds: 0.45/0.65/0.85)`);
  } else {
    // CRITICAL FIX: If AI's classification is already valid, ensure it's the most appropriate
    // Use lowered thresholds to upgrade muscularity for athletic builds
    if (aiMuscularityLevel >= 0.85 && (muscularity === 'Normal' || muscularity === 'Moyen musclé' || muscularity === 'Musclé') && validMuscularity.includes('Athlétique')) {
      muscularity = 'Athlétique';
      adjustmentsMade.push(`muscularity_upgraded_to_Athlétique_based_on_AI_level_${(aiMuscularityLevel).toFixed(2)}`);
      console.log(`🔧 [dbSemanticValidator] Upgraded muscularity: ${rawSemanticProfile.muscularity} -> Athlétique (AI level: ${aiMuscularityLevel?.toFixed(3)})`);
    } else if (aiMuscularityLevel >= 0.65 && (muscularity === 'Normal' || muscularity === 'Moyen musclé') && validMuscularity.includes('Musclé')) {
      muscularity = 'Musclé';
      adjustmentsMade.push(`muscularity_upgraded_from_${muscularity}_to_Musclé_based_on_AI_level_${(aiMuscularityLevel).toFixed(2)}`);
      console.log(`🔧 [dbSemanticValidator] Upgraded muscularity: ${rawSemanticProfile.muscularity} -> Musclé (AI level: ${aiMuscularityLevel?.toFixed(3)})`);
    } else if (aiMuscularityLevel >= 0.45 && muscularity === 'Normal' && validMuscularity.includes('Moyen musclé')) {
      muscularity = 'Moyen musclé';
      adjustmentsMade.push(`muscularity_upgraded_from_Normal_to_Moyen_musclé_based_on_AI_level_${(aiMuscularityLevel).toFixed(2)}`);
      console.log(`🔧 [dbSemanticValidator] Upgraded muscularity: Normal -> Moyen musclé (AI level: ${aiMuscularityLevel?.toFixed(3)})`);
    }
  }

  // NOUVELLE CONDITION : Forcer la musculature basse pour les obèses avec faible AI level
  const bmi = extractedData.estimated_bmi;
  if (aiMuscularityLevel < 0.3 && (bmi > 35 || bmi > 40)) { // Seuil BMI à ajuster
      if (validMuscularity.includes('Moins musclée')) {
          muscularity = 'Moins musclée';
      } else if (validMuscularity.includes('Atrophié')) {
          muscularity = 'Atrophié';
      } else {
          // Fallback to the lowest valid muscularity if specific ones aren't available
          muscularity = validMuscularity[0] || 'Normal';
      }
      adjustmentsMade.push(`muscularity_forced_low_for_obese_from_${rawSemanticProfile.muscularity}_to_${muscularity}`);
      console.log(`🔧 [dbSemanticValidator] Forced low muscularity for obese user: ${rawSemanticProfile.muscularity} -> ${muscularity}`);
  }

  // Validate and adjust level classification
  let level = rawSemanticProfile.level || 'Normal'; // Use rawSemanticProfile.level
  if (!validLevels.includes(level)) {
    level = 'Normal';
    adjustmentsMade.push(`level_adjusted_to_${level}`);
    console.log(`🔧 [dbSemanticValidator] Adjusted level: ${rawSemanticProfile.level} -> ${level}`);
  }
  // Validate and adjust morphotype
  let morphotype = rawSemanticProfile.morphotype || 'REC';
  if (!validMorphotypes.includes(morphotype)) {
    morphotype = 'REC'; // Rectangle as default
    adjustmentsMade.push(`morphotype_adjusted_to_${morphotype}`);
    console.log(`🔧 [dbSemanticValidator] Adjusted morphotype: ${rawSemanticProfile.morphotype} -> ${morphotype}`);
  }
  // Cross-validate consistency between classifications
  // Check BMI vs obesity consistency
  if (bmi > 30 && obesity === 'Non obèse') {
    obesity = 'Obèse';
    adjustmentsMade.push('obesity_adjusted_for_bmi_consistency');
    validationFlags.push('bmi_obesity_mismatch');
    console.log(`🔧 [dbSemanticValidator] Adjusted obesity for BMI consistency: ${obesity}`);
  } else if (bmi < 25 && obesity === 'Obèse') {
    obesity = 'Non obèse';
    adjustmentsMade.push('obesity_adjusted_for_bmi_consistency');
    validationFlags.push('bmi_obesity_mismatch');
    console.log(`🔧 [dbSemanticValidator] Adjusted obesity for BMI consistency: ${obesity}`);
  }
  // Check level vs BMI consistency
  if (bmi > 25 && level === 'Mince') {
    level = 'Surpoids';
    adjustmentsMade.push('level_adjusted_for_bmi_consistency');
    validationFlags.push('bmi_level_mismatch');
    console.log(`🔧 [dbSemanticValidator] Adjusted level for BMI consistency: ${level}`);
  } else if (bmi < 20 && level === 'Obèse') {
    level = 'Mince';
    adjustmentsMade.push('level_adjusted_for_bmi_consistency');
    validationFlags.push('bmi_level_mismatch');
    console.log(`🔧 [dbSemanticValidator] Adjusted level for BMI consistency: ${level}`);
  }

  // CRITICAL: NO muscularity vs BMI consistency check
  // High muscularity + normal BMI (18.5-25) is PERFECTLY VALID for athletic builds
  // Examples:
  // - BMI 22-24 + "Musclé" = lean athletic build with 10-15% body fat
  // - BMI 23-25 + "Athlétique" = very muscular with low body fat (bodybuilder/crossfitter)
  // DO NOT downgrade muscularity based on BMI being "normal"
  console.log(`✅ [dbSemanticValidator] Semantic coherence validation complete - muscularity preserved`, {
    bmi: bmi.toFixed(2),
    muscularity,
    philosophy: 'allow_high_muscularity_with_normal_bmi_no_coherence_downgrade'
  });
  const validatedProfile = {
    obesity,
    muscularity,
    level,
    morphotype,
    validated_morph_values: {
      bmi: bmi,
      confidence: extractedData.processing_confidence || 0.5
    }
  };
  console.log('✅ [dbSemanticValidator] Validation completed', {
    validatedProfile,
    adjustmentsMade: adjustmentsMade.length,
    validationFlags: validationFlags.length
  });
  return {
    validatedProfile,
    validationFlags,
    adjustmentsMade
  };
}

