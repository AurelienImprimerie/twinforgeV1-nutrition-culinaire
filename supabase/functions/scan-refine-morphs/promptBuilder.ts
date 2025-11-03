// supabase/functions/scan-refine-morphs/promptBuilder.ts
/**
 * AI Prompt Builder - Phase B Implementation
 * Builds structured prompts for AI-driven morphological refinement with K=5 envelope constraints
 */ export function buildAIRefinementPrompt(input) {
  const { photos, blend_shape_params, blend_limb_masses, mappingData, resolvedGender, k5_envelope, vision_classification, user_measurements, traceId } = input;
  console.log(`🔍 [promptBuilder] [${traceId}] PHASE B: Building DB-only AI refinement prompt:`, {
    resolvedGender,
    photosCount: photos?.length,
    blendShapeParamsCount: Object.keys(blend_shape_params || {}).length,
    blendLimbMassesCount: Object.keys(blend_limb_masses || {}).length,
    k5EnvelopeShapeKeys: Object.keys(k5_envelope?.shape_params_envelope || {}).length,
    k5EnvelopeLimbKeys: Object.keys(k5_envelope?.limb_masses_envelope || {}).length,
    visionClassification: vision_classification,
    hasUserMeasurements: !!user_measurements,
    philosophy: 'phase_b_db_only_k5_envelope_strict'
  });

  // Build K=5 envelope constraints section (CRITICAL)
  const k5EnvelopeSection = buildK5EnvelopeConstraints(k5_envelope, traceId);
  // Build DB physiological bounds section
  const dbBoundsSection = buildDBPhysiologicalBounds(mappingData, resolvedGender, traceId);
  // Build muscular gating constraints based on vision classification
  const muscularGatingSection = buildMuscularGatingConstraints(vision_classification, resolvedGender, traceId);
  // Build photo-derived metrics for AI guidance
  const photoMetricsSection = buildPhotoMetricsGuidance(user_measurements, traceId);
  // Build gender-specific constraints
  const genderConstraintsSection = buildGenderSpecificConstraints(resolvedGender, mappingData, vision_classification, traceId); // Pass vision_classification here

  const frontPhoto = photos?.find((p)=>p.view === 'front');
  const profilePhoto = photos?.find((p)=>p.view === 'profile');

  return `3D morph AI. Refine vector from photos within K=5+DB bounds.

${resolvedGender}|${frontPhoto ? 'F' : ''}${frontPhoto && profilePhoto ? '+' : ''}${profilePhoto ? 'P' : ''}|${vision_classification?.obesity}/${vision_classification?.muscularity}/${vision_classification?.morphotype}

INPUT Shape:${JSON.stringify(blend_shape_params)}
INPUT Limb:${JSON.stringify(blend_limb_masses)}

${k5EnvelopeSection}

${dbBoundsSection}

${muscularGatingSection}

${photoMetricsSection}

${genderConstraintsSection}

RULES: Stay K=5+DB bounds. Photo-realistic refinement. Finite 3 decimals. No extra keys.

JSON:{"final_shape_params":{},"final_limb_masses":{},"ai_confidence":0.8,"refinement_notes":[],"clamped_keys":[],"envelope_violations":[],"db_violations":[],"gender_violations":[],"out_of_range_count":0,"missing_keys_added":[],"extra_keys_removed":[]}

Analyze photos, refine vector.`;
}

/**
 * Build K=5 envelope constraints section
 * PHASE B: Critical constraints that AI must never violate
 */ function buildK5EnvelopeConstraints(k5_envelope, traceId) {
  console.log(`🔍 [promptBuilder] [${traceId}] PHASE B: Building K=5 envelope constraints section:`, {
    shapeParamsEnvelopeKeys: Object.keys(k5_envelope?.shape_params_envelope || {}).length,
    limbMassesEnvelopeKeys: Object.keys(k5_envelope?.limb_masses_envelope || {}).length,
    archetypesUsed: k5_envelope?.envelope_metadata?.archetypes_used,
    philosophy: 'phase_b_k5_envelope_strict_constraints'
  });
  let envelopeSection = `K=5 ENVELOPE (P1 - ${k5_envelope?.envelope_metadata?.archetypes_used?.length || 0} archetypes):
SHAPE:`;
  Object.entries(k5_envelope?.shape_params_envelope || {}).forEach(([key, range])=>{
    const w = range.max - range.min;
    envelopeSection += `\n${key}:[${range.min.toFixed(3)},${range.max.toFixed(3)}]${w < 0.5 ? '!' : ''}`;
  });
  envelopeSection += `\nLIMB:`;
  Object.entries(k5_envelope?.limb_masses_envelope || {}).forEach(([key, range])=>{
    const w = range.max - range.min;
    envelopeSection += `\n${key}:[${range.min.toFixed(3)},${range.max.toFixed(3)}]${w < 0.3 ? '!' : ''}`;
  });
  envelopeSection += `\nRULES: Never exceed. ! = narrow/strict. Clamped if violated. Gating applied.`;
  return envelopeSection;
}

/**
 * Build DB physiological bounds section
 * PHASE B: Absolute physiological limits that cannot be exceeded
 */ function buildDBPhysiologicalBounds(mappingData, resolvedGender, traceId) {
  console.log(`🔍 [promptBuilder] [${traceId}] PHASE B: Building DB physiological bounds section:`, {
    resolvedGender,
    dbMorphValuesCount: Object.keys(mappingData?.morph_values || {}).length,
    dbLimbMassesCount: Object.keys(mappingData?.limb_masses || {}).length,
    philosophy: 'phase_b_db_physiological_absolute_bounds'
  });
  let dbSection = `DB BOUNDS ${resolvedGender} (P2):
SHAPE:`;
  Object.entries(mappingData?.morph_values || {}).forEach(([key, range])=>{
    const ban = range.min === 0 && range.max === 0;
    dbSection += `\n${key}:[${range.min.toFixed(3)},${range.max.toFixed(3)}]${ban ? 'X' : ''}`;
  });
  dbSection += `\nLIMB:`;
  Object.entries(mappingData?.limb_masses || {}).forEach(([key, range])=>{
    const fix = range.min === range.max;
    dbSection += `\n${key}:[${range.min.toFixed(3)},${range.max.toFixed(3)}]${fix ? '=' : ''}`;
  });
  dbSection += `\nX=banned=0. ==fixed exact. Absolute limits.`;
  return dbSection;
}

/**
 * Build muscular gating constraints section
 * PHASE B: Preserve muscular coherence from archetype selection
 */ function buildMuscularGatingConstraints(vision_classification, resolvedGender, traceId) {
  console.log(`🔍 [promptBuilder] [${traceId}] PHASE B: Building muscular gating constraints:`, {
    visionMuscularity: vision_classification?.muscularity,
    resolvedGender,
    philosophy: 'phase_b_muscular_gating_preservation'
  });
  let gatingSection = `MUSCULAR GATING: "${vision_classification?.muscularity}"`;
  const muscularityLevel = getMuscularityLevelFromClassification(vision_classification?.muscularity);
  console.log(`🔍 [promptBuilder] [${traceId}] Muscularity level for prompt: ${muscularityLevel} (from "${vision_classification?.muscularity}")`);
  if (muscularityLevel >= 0.7) {
    gatingSection += `\nHIGH: Maximize bodybuilderSize+Details to upper K=5. pearFigure moderate.`;
  } else if (muscularityLevel <= 0.3) {
    gatingSection += `\nLOW: bodybuilderSize+Details to lower K=5. emaciated optimize.`;
  } else {
    gatingSection += `\nNORMAL: Refine all muscular params within K=5.`;
  }
  
  if (resolvedGender === 'masculine') {
    gatingSection += `\nMASC: pregnant/nipples/animeProp=0X. breastsSmall≤1.0. superBreast≤0.`;
  } else {
    gatingSection += `\nFEM: All keys per K=5. Balance superBreast/bigHips/assLarge.`;
  }
  const explicitlyMuscularClassifications = ['Musclé','Musclée','Athlétique','Normal costaud'];
  if (explicitlyMuscularClassifications.includes(vision_classification?.muscularity) && (vision_classification?.obesity === 'Obèse' || vision_classification?.obesity === 'Obésité morbide')) {
    gatingSection += `\nSPECIAL ${vision_classification?.muscularity}+${vision_classification?.obesity}: MAX bodybuilderSize+Details to limits. emaciated=0.`;
  }
  return gatingSection;
}

/**
 * Build photo-derived metrics guidance section
 * PHASE B: Use photo measurements to guide AI refinement
 */ function buildPhotoMetricsGuidance(user_measurements, traceId) {
  if (!user_measurements?.raw_measurements) {
    console.log(`🔍 [promptBuilder] [${traceId}] PHASE B: No user measurements available for photo metrics guidance`);
    return 'PHOTO: N/A - visual analysis';
  }
  const { raw_measurements, estimated_bmi } = user_measurements;
  const hsr = raw_measurements.hips_cm / raw_measurements.chest_cm;
  const whr = raw_measurements.waist_cm / raw_measurements.hips_cm;
  const cwr = raw_measurements.chest_cm / raw_measurements.waist_cm;
  const bmi_cat = estimated_bmi > 30 ? 'ob' : estimated_bmi > 25 ? 'ow' : 'n';
  console.log(`🔍 [promptBuilder] [${traceId}] PHASE B: Photo metrics calculated:`, {
    hip_to_shoulder_ratio: hsr.toFixed(3),
    waist_to_hip_ratio: whr.toFixed(3),
    chest_to_waist_ratio: cwr.toFixed(3),
    estimated_bmi: estimated_bmi.toFixed(1),
    bmi_category: bmi_cat,
    philosophy: 'phase_b_photo_metrics_ai_guidance'
  });
  return `PHOTO: H/S=${hsr.toFixed(2)} W/H=${whr.toFixed(2)} C/W=${cwr.toFixed(2)} BMI=${estimated_bmi.toFixed(1)}(${bmi_cat})
Guide: hsr>1.1→bigHips/assLarge. whr<0.8→narrowWaist. BMI>30→pearFigure↑. BMI<20→emaciated. Within K=5.`;
}

/**
 * Build gender-specific constraints section
 * PHASE B: Enforce gender-specific DB bans and limitations
 */ function buildGenderSpecificConstraints(resolvedGender, mappingData, vision_classification, traceId) {
  console.log(`🔍 [promptBuilder] [${traceId}] PHASE B: Building gender-specific constraints:`, {
    resolvedGender,
    philosophy: 'phase_b_gender_specific_db_constraints'
  });
  const bannedShapeKeys = Object.entries(mappingData?.morph_values || {}).filter(([key, range])=>range.min === 0 && range.max === 0).map(([key])=>key);
  const fixedLimbMasses = Object.entries(mappingData?.limb_masses || {}).filter(([key, range])=>range.min === range.max).map(([key, range])=>({key,value: range.min}));
  let genderSection = `GENDER ${resolvedGender.toUpperCase()}:
Banned:${bannedShapeKeys.length > 0 ? bannedShapeKeys.join(',') : 'none'}=0
Fixed:${fixedLimbMasses.length > 0 ? fixedLimbMasses.map(({ key, value })=>`${key}=${value.toFixed(3)}`).join(',') : 'none'}`;

  if (resolvedGender === 'masculine') {
    genderSection += `\nMASC: pregnant/nipples/animeProp=0. breastsSmall≤1.0. superBreast≤0.`;
  } else {
    genderSection += `\nFEM: All keys per K=5. Balance superBreast/bigHips/assLarge.`;
  }
  const explicitlyMuscularClassifications = ['Musclé','Musclée','Athlétique','Normal costaud'];
  if (explicitlyMuscularClassifications.includes(vision_classification?.muscularity) && (vision_classification?.obesity === 'Obèse' || vision_classification?.obesity === 'Obésité morbide')) {
    genderSection += `\nSPECIAL ${vision_classification?.muscularity}+${vision_classification?.obesity}: MAX bodybuilderSize+Details.`;
  }
  return genderSection;
}

/**
 * Get muscularity level from classification string
 */ function getMuscularityLevelFromClassification(muscularity) {
  const muscularityLevels = {
    'Atrophié sévère': 0.1,
    'Atrophiée sévère': 0.1,
    'Légèrement atrophié': 0.2,
    'Moins musclée': 0.2,
    'Normal': 0.4,
    'Moyen musclé': 0.6,
    'Moyennement musclée': 0.6,
    'Musclé': 0.8,
    'Musclée': 0.8,
    'Normal costaud': 0.9,
    'Athlétique': 0.9
  };
  return muscularityLevels[muscularity] || 0.4;
}
