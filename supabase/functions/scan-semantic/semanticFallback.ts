/**
 * Semantic Fallback
 * Creates fallback semantic analysis when OpenAI fails
 */ /**
 * Create fallback semantic analysis when OpenAI fails
 */ export function createFallbackSemanticAnalysis(userMetrics) {
  const bmi = userMetrics.estimated_bmi;
  console.log('🔍 [semanticFallback] Creating fallback with BMI-based heuristics', {
    bmi: bmi.toFixed(2),
    gender: userMetrics.gender,
    estimatedBMI: userMetrics.estimated_bmi
  });
  // Generate raw morph values based on BMI and gender heuristics
  const morphValues = generateFallbackMorphValues(bmi, userMetrics.gender);
  // BMI-based heuristics for semantic levels
  const adiposity_level = Math.max(0, Math.min(1, (bmi - 18.5) / 12)); // 0 at BMI 18.5, 1 at BMI 30.5
  const muscularity_level = Math.max(0, Math.min(1, (bmi - 20) / 8)); // Assume some muscle with higher BMI
  const muscle_definition = Math.max(0, Math.min(1, (25 - bmi) / 10)); // Higher definition at lower BMI
  // Body type classification based on morph values
  const { body_shape_primary, body_types } = classifyBodyShapeFromMorphs(morphValues, userMetrics.gender);
  // Fat distribution based on gender and BMI
  const fat_distribution = determineFatDistribution(bmi, userMetrics.gender);
  // Region scores based on gender and BMI
  const region_scores = calculateRegionScores(bmi, userMetrics.gender, muscularity_level, adiposity_level);
  // Quality flags based on photo reports
  const flags = generateQualityFlags(userMetrics);
  return {
    // Raw morph values (fallback)
    ...morphValues,
    // Semantic analysis
    muscularity_level,
    adiposity_level,
    body_types,
    body_shape_primary,
    muscle_definition,
    fat_distribution,
    region_scores,
    flags,
    confidence: {
      semantic: 0.3
    }
  };
}
/**
 * Generate fallback morph values based on BMI and gender
 */ function generateFallbackMorphValues(bmi, gender) {
  const morphValues = {};
  // Base all morphs on BMI and gender
  const adiposityFactor = Math.max(0, Math.min(1, (bmi - 18.5) / 12));
  const muscularityFactor = Math.max(0, Math.min(1, (bmi - 20) / 8));
  // Core morphs
  morphValues.pearFigure = adiposityFactor * 1.2; // 0 to 1.2 based on BMI
  morphValues.emaciated = bmi < 18.5 ? (18.5 - bmi) / 3 : 0; // Emaciation for low BMI
  morphValues.bodybuilderSize = muscularityFactor * 0.8; // Conservative muscle estimate
  morphValues.bodybuilderDetails = muscularityFactor * 0.6; // Conservative definition
  // Gender-specific morphs
  if (gender === 'feminine') {
    morphValues.bigHips = adiposityFactor * 0.6;
    morphValues.assLarge = adiposityFactor * 0.5;
    morphValues.narrowWaist = Math.max(0, 0.4 - adiposityFactor * 0.3);
    morphValues.superBreast = adiposityFactor * 0.4;
    morphValues.breastsSmall = Math.max(0, 0.3 - adiposityFactor * 0.2);
    morphValues.breastsSag = adiposityFactor > 0.6 ? adiposityFactor * 0.3 : 0;
  } else {
    morphValues.bigHips = Math.max(0, adiposityFactor * 0.3 - 0.1);
    morphValues.assLarge = Math.max(0, adiposityFactor * 0.2 - 0.1);
    morphValues.narrowWaist = Math.max(0, 0.2 - adiposityFactor * 0.2);
    morphValues.superBreast = 0; // Minimal for males
    morphValues.breastsSmall = 0.2; // Slight masculine chest
    morphValues.breastsSag = 0;
  }
  // Common morphs
  morphValues.pregnant = adiposityFactor > 0.7 ? (adiposityFactor - 0.7) * 0.8 : 0;
  morphValues.animeWaist = Math.max(0, 0.3 - adiposityFactor * 0.4);
  morphValues.dollBody = 0; // Neutral for fallback
  morphValues.animeProportion = 0; // Neutral for fallback
  morphValues.animeNeck = 0; // Neutral for fallback
  morphValues.nipples = adiposityFactor * 0.2; // Slight based on adiposity
  console.log('🔍 [semanticFallback] Generated fallback morph values', {
    bmi: bmi.toFixed(2),
    gender,
    adiposityFactor: adiposityFactor.toFixed(3),
    muscularityFactor: muscularityFactor.toFixed(3),
    sampleMorphs: {
      pearFigure: morphValues.pearFigure.toFixed(3),
      emaciated: morphValues.emaciated.toFixed(3),
      bodybuilderSize: morphValues.bodybuilderSize.toFixed(3)
    }
  });
  return morphValues;
}
/**
 * Classify body shape from morph values
 */ function classifyBodyShapeFromMorphs(morphValues, gender) {
  const bigHips = morphValues.bigHips || 0;
  const narrowWaist = morphValues.narrowWaist || 0;
  const pearFigure = morphValues.pearFigure || 0;
  const pregnant = morphValues.pregnant || 0;
  const bodybuilderSize = morphValues.bodybuilderSize || 0;
  let body_shape_primary = 'REC'; // Default to rectangle
  let body_types = [];
  // Determine shape based on morph values
  if (bigHips > 0.3 && narrowWaist > 0.2) {
    body_shape_primary = 'POI'; // Pear
    body_types.push('POI');
  } else if (narrowWaist > 0.4) {
    body_shape_primary = 'SAB'; // Hourglass
    body_types.push('SAB');
  } else if (bodybuilderSize > 0.6 && gender === 'masculine') {
    body_shape_primary = 'TRI'; // Inverted triangle
    body_types.push('TRI');
  } else if (pearFigure > 0.5 || pregnant > 0.3) {
    body_shape_primary = 'POM'; // Apple
    body_types.push('POM');
  } else if (pearFigure > 0.3) {
    body_shape_primary = 'OVA'; // Oval
    body_types.push('OVA');
  } else {
    body_shape_primary = 'REC'; // Rectangle
    body_types.push('REC');
  }
  // Add secondary types based on other morph values
  if (bodybuilderSize > 0.5) {
    body_types.push('athletic');
  }
  return {
    body_shape_primary,
    body_types
  };
}
/**
 * Determine fat distribution pattern
 */ function determineFatDistribution(bmi, gender) {
  if (bmi > 25) {
    return gender === 'masculine' ? 'central' : 'lower';
  } else if (bmi > 22) {
    return gender === 'masculine' ? 'central' : 'even';
  }
  return 'even';
}
/**
 * Calculate region scores based on anthropometric data
 */ function calculateRegionScores(bmi, gender, muscularity_level, adiposity_level) {
  return {
    shoulders_width: gender === 'masculine' ? Math.max(-0.5, Math.min(0.5, (bmi - 22) / 10 + 0.1)) : Math.max(-0.5, Math.min(0.2, (bmi - 22) / 15 - 0.1)),
    chest_depth: gender === 'masculine' ? Math.max(-0.3, Math.min(0.3, muscularity_level - 0.2)) : Math.max(-0.2, Math.min(0.8, adiposity_level * 0.6)),
    waist_circ: Math.max(-1, Math.min(1, (bmi - 22) / 8)),
    hips_width: gender === 'feminine' ? Math.max(-0.2, Math.min(0.8, adiposity_level * 0.7)) : Math.max(-0.3, Math.min(0.3, (bmi - 22) / 15)),
    glutes_projection: gender === 'feminine' ? Math.max(0, Math.min(0.8, adiposity_level * 0.6 + 0.2)) : Math.max(-0.2, Math.min(0.4, adiposity_level * 0.3))
  };
}
/**
 * Generate quality flags from photo reports
 */ function generateQualityFlags(userMetrics) {
  return {
    clothes_baggy: false,
    arms_away_from_body: userMetrics.frontReport?.content?.pose_ok ?? true,
    hair_volume_high: false,
    posture_good: userMetrics.frontReport?.content?.pose_ok ?? true,
    lighting_adequate: (userMetrics.frontReport?.quality?.brightness ?? 0.6) > 0.3
  };
}
