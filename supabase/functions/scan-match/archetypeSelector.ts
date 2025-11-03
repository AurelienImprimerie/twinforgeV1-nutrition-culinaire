// supabase/functions/scan-match/db/archetypeSelector.ts
import { normalizeMuscularityTerm } from './morphologyHelpers.ts';
// FIXED: Enhanced BMI filtering constants with proper epsilon application
const BMI_EPSILON = 0.5; // Increased epsilon for better tolerance
const BMI_RELAXATION = 8.0; // MODIFIED: Increased relaxation for extreme BMI cases
/**
 * FIXED: Enhanced archetype selection with robust filtering
 */ export async function selectClosestArchetypes(supabase, userProfile, limit = 5) {
  console.log('🔍 [archetypeSelector] FIXED: Starting enhanced archetype selection', {
    userProfile,
    limit,
    bmiEpsilon: BMI_EPSILON,
    bmiRelaxation: BMI_RELAXATION,
    philosophy: 'enhanced_strict_filtering_with_robust_epsilon'
  });
  // Step 1: Get all archetypes for gender
  const { data: allArchetypes, error } = await supabase.from('morph_archetypes').select('*').eq('gender', userProfile.sex === 'male' ? 'masculine' : 'feminine');
  if (error || !allArchetypes) {
    throw new Error(`Failed to fetch archetypes: ${error?.message || 'No data'}`);
  }
  console.log('🔍 [archetypeSelector] FIXED: Fetched archetypes from database', {
    totalArchetypes: allArchetypes.length,
    gender: userProfile.sex === 'male' ? 'masculine' : 'feminine',
    philosophy: 'database_archetype_fetch'
  });
  let candidates = allArchetypes;
  const filteringStats = {
    totalArchetypes: allArchetypes.length,
    afterGenderFilter: allArchetypes.length,
    afterMuscularGating: 0,
    afterBMIFilter: 0,
    afterSemanticFilter: 0,
    finalSelected: 0,
    bmiRelaxationApplied: false,
    muscularGatingSuccessful: false,
    epsilonUsed: BMI_EPSILON
  };
  // Step 2: FIXED - Enhanced Muscular Gating with robust term handling
  console.log('🔍 [archetypeSelector] FIXED: Applying enhanced muscular gating');
  const visionMuscularity = userProfile.semantic_profile.muscularity;
  const canonicalMuscularity = normalizeMuscularityTerm(visionMuscularity);
  const compatibleMuscularLevels = getCompatibleMuscularLevels(canonicalMuscularity);
  console.log('🔍 [archetypeSelector] FIXED: Muscular gating analysis', {
    visionMuscularity,
    canonicalMuscularity,
    compatibleMuscularLevels,
    compatibleCount: compatibleMuscularLevels.length,
    philosophy: 'enhanced_muscular_compatibility_matrix'
  });
  if (compatibleMuscularLevels.length > 0) {
    const beforeMuscularGating = candidates.length;
    candidates = candidates.filter((archetype)=>compatibleMuscularLevels.includes(archetype.muscularity));
    filteringStats.afterMuscularGating = candidates.length;
    filteringStats.muscularGatingSuccessful = true;
    console.log('✅ [archetypeSelector] FIXED: Muscular gating applied successfully', {
      visionMuscularity,
      canonicalMuscularity,
      compatibleLevels: compatibleMuscularLevels,
      beforeFilter: beforeMuscularGating,
      afterFilter: candidates.length,
      filtered: beforeMuscularGating - candidates.length,
      philosophy: 'muscular_gating_success'
    });
  } else {
    console.error('❌ [archetypeSelector] FIXED: Muscular gating failed - no compatible levels', {
      visionMuscularity,
      canonicalMuscularity,
      availableArchetypeMuscularities: [
        ...new Set(allArchetypes.map((a)=>a.muscularity))
      ],
      philosophy: 'muscular_gating_failure_analysis'
    });
    // Use permissive fallback but log it clearly
    filteringStats.muscularGatingSuccessful = false;
    console.warn('🔧 [archetypeSelector] FIXED: Using permissive muscular fallback', {
      reason: 'no_compatible_muscular_levels_found',
      philosophy: 'permissive_fallback_documented'
    });
  }
  // Step 3: FIXED - Enhanced BMI Filtering with proper epsilon application
  console.log('🔍 [archetypeSelector] FIXED: Applying enhanced BMI filtering with epsilon');
  const beforeBMIFilter = candidates.length;
  const userBMI = userProfile.estimated_bmi;
  // FIXED: Apply BMI filtering with proper epsilon
  candidates = candidates.filter((archetype)=>{
    const bmiRange = archetype.bmi_range;
    if (!bmiRange || !Array.isArray(bmiRange) || bmiRange.length !== 2) {
      console.warn('🔍 [archetypeSelector] FIXED: Invalid BMI range for archetype', {
        archetypeId: archetype.id,
        bmiRange,
        philosophy: 'invalid_bmi_range_skipped'
      });
      return false;
    }
    const minBMI = parseFloat(bmiRange[0]);
    const maxBMI = parseFloat(bmiRange[1]);
    // FIXED: Proper epsilon application
    const isInRange = isInRangeWithEpsilon(userBMI, minBMI, maxBMI, BMI_EPSILON);
    if (!isInRange) {
      console.log('🚫 [archetypeSelector] FIXED: BMI STRICT FILTERING - Rejecting archetype', {
        archetypeId: archetype.id,
        archetypeName: archetype.name,
        userBMI: userBMI,
        archetypeBMIRange: [
          minBMI,
          maxBMI
        ],
        bmiDifference: {
          fromMin: userBMI - minBMI,
          fromMax: userBMI - maxBMI,
          effectiveMinWithEpsilon: minBMI - BMI_EPSILON,
          effectiveMaxWithEpsilon: maxBMI + BMI_EPSILON
        },
        epsilonUsed: BMI_EPSILON,
        effectiveRange: [
          minBMI - BMI_EPSILON,
          maxBMI + BMI_EPSILON
        ],
        reason: 'bmi_out_of_range_with_epsilon',
        philosophy: 'enhanced_bmi_filtering_with_epsilon'
      });
    }
    return isInRange;
  });
  filteringStats.afterBMIFilter = candidates.length;
  // FIXED: Apply BMI relaxation if too few candidates
  if (candidates.length < 2) {
    console.warn('⚠️ [archetypeSelector] FIXED: Too few candidates after BMI filtering, applying relaxation', {
      candidatesAfterBMI: candidates.length,
      userBMI,
      bmiRelaxation: BMI_RELAXATION,
      philosophy: 'bmi_relaxation_needed'
    });
    // Apply relaxed BMI filtering
    candidates = allArchetypes.filter((archetype)=>{
      const bmiRange = archetype.bmi_range;
      if (!bmiRange || !Array.isArray(bmiRange) || bmiRange.length !== 2) return false;
      const minBMI = parseFloat(bmiRange[0]);
      const maxBMI = parseFloat(bmiRange[1]);
      // FIXED: Apply relaxation with epsilon
      const isInRelaxedRange = isInRangeWithEpsilon(userBMI, minBMI - BMI_RELAXATION, maxBMI + BMI_RELAXATION, BMI_EPSILON); // MODIFIED: Corrected to subtract from min and add to max
      if (isInRelaxedRange) {
        console.log('✅ [archetypeSelector] FIXED: BMI RELAXED FILTERING - Accepting archetype', {
          archetypeId: archetype.id,
          userBMI,
          archetypeBMIRange: [
            minBMI,
            maxBMI
          ],
          relaxationUsed: BMI_RELAXATION,
          effectiveRange: [
            minBMI - BMI_RELAXATION, // MODIFIED: Corrected to subtract from min
            maxBMI + BMI_RELAXATION // MODIFIED: Corrected to add to max
          ],
          philosophy: 'bmi_relaxation_acceptance'
        });
      }
      return isInRelaxedRange;
    });
    filteringStats.afterBMIFilter = candidates.length;
    filteringStats.bmiRelaxationApplied = true;
  }
  console.log('✅ [archetypeSelector] FIXED: BMI filtering completed', {
    userBMI,
    beforeFilter: beforeBMIFilter,
    afterFilter: candidates.length,
    filtered: beforeBMIFilter - candidates.length,
    relaxationApplied: filteringStats.bmiRelaxationApplied,
    epsilonUsed: BMI_EPSILON,
    philosophy: 'enhanced_bmi_filtering_complete'
  });
  // Step 4: Calculate distances and select top candidates
  const candidatesWithDistances = candidates.map((archetype)=>{
    const distance = calculateArchetypeDistance(archetype, userProfile);
    // Add overall_score to archetype for sorting
    const overall_score = calculateOverallScore(archetype, userProfile); // New function to calculate overall score
    return {
      ...archetype,
      distance,
      overall_score
    };
  });
  // Sort by overall_score (descending) and take top candidates
  candidatesWithDistances.sort((a, b)=>b.overall_score - a.overall_score);
  const selectedArchetypes = candidatesWithDistances.slice(0, limit);
  filteringStats.afterSemanticFilter = candidatesWithDistances.length;
  filteringStats.finalSelected = selectedArchetypes.length;
  // Calculate semantic coherence score
  const semanticCoherenceScore = calculateSemanticCoherence(selectedArchetypes, userProfile);
  console.log('✅ [archetypeSelector] FIXED: Enhanced archetype selection completed', {
    finalSelectedCount: selectedArchetypes.length,
    semanticCoherenceScore: semanticCoherenceScore.toFixed(3),
    filteringStats,
    selectedArchetypeIds: selectedArchetypes.map((a)=>a.id),
    philosophy: 'enhanced_selection_complete'
  });
  return {
    selectedArchetypes,
    strategyUsed: filteringStats.bmiRelaxationApplied ? 'bmi_relaxed_muscular_gated' : 'strict_bmi_muscular_gated',
    semanticCoherenceScore,
    filteringStats
  };
}
/**
 * FIXED: Enhanced BMI range check with proper epsilon application
 */ function isInRangeWithEpsilon(userBMI, minBMI, maxBMI, epsilon) {
  // FIXED: Proper epsilon application to both bounds
  const isInRange = userBMI >= minBMI - epsilon && userBMI <= maxBMI + epsilon;
  console.log('🔍 [isInRangeWithEpsilon] FIXED: BMI range check with epsilon', {
    userBMI: userBMI.toFixed(6),
    originalRange: [
      minBMI,
      maxBMI
    ],
    epsilonAdjustedRange: [
      minBMI - epsilon,
      maxBMI + epsilon
    ],
    epsilonUsed: epsilon,
    isInRange,
    marginFromMin: userBMI - (minBMI - epsilon),
    marginFromMax: maxBMI + epsilon - userBMI,
    philosophy: 'enhanced_epsilon_application'
  });
  return isInRange;
}
/**
 * FIXED: Get compatible muscular levels with enhanced compatibility matrix
 */ function getCompatibleMuscularLevels(canonicalMuscularity) {
  console.log('🔍 [getCompatibleMuscularLevels] FIXED: Getting compatible muscular levels', {
    canonicalMuscularity,
    philosophy: 'enhanced_muscular_compatibility_matrix'
  });
  // FIXED: Enhanced muscular compatibility matrix with comprehensive coverage
  const muscularCompatibilityMatrix = {
    // Atrophied spectrum - FIXED: Complete canonical coverage
    'Atrophié': [
      'Atrophié sévère',
      'Atrophié',
      'Légèrement atrophié',
      'Normal',
      'Atrophiée sévère',
      'Moins musclée',
      'Moyennement musclée'
    ],
    'Atrophié sévère': [
      'Atrophié sévère',
      'Atrophié',
      'Légèrement atrophié',
      'Atrophiée sévère',
      'Moins musclée'
    ],
    'Légèrement atrophié': [
      'Atrophié',
      'Légèrement atrophié',
      'Normal',
      'Moins musclée',
      'Moyennement musclée'
    ],
    // Normal spectrum - CRITICAL FIX: Expanded to include muscled archetypes for athletic builds with normal BMI
    'Normal': [
      'Légèrement atrophié',
      'Normal',
      'Moyen musclé',         // ADDED: Athletic builds with normal BMI can be "Moyen musclé"
      'Musclé',               // ADDED: Very athletic builds with normal BMI (low body fat + high muscle)
      'Moins musclée',
      'Moyennement musclée',
      'Musclée'               // ADDED: Athletic feminine builds with normal BMI
    ],
    'Moyen musclé': [
      'Normal',
      'Moyen musclé',
      'Musclé',
      'Normal costaud',       // ADDED: Includes stocky athletic builds
      'Moyennement musclée',
      'Musclée'
    ],
    // Athletic spectrum
    'Musclé': [
      'Normal',               // ADDED: Lean athletic builds can have normal BMI (22-24)
      'Moyen musclé',
      'Musclé',
      'Normal costaud',
      'Athlétique',          // ADDED: Very developed athletes
      'Moyennement musclée',
      'Musclée'
    ],
    'Normal costaud': [
      'Moyen musclé',         // ADDED: Transition from moderate to stocky
      'Musclé',
      'Normal costaud',
      'Athlétique',          // ADDED: Very developed stocky builds
      'Moyennement musclée',
      'Musclée'
    ],
    'Athlétique': [
      'Moyen musclé',         // ADDED: Moderately athletic builds
      'Musclé',
      'Normal costaud',
      'Athlétique',
      'Musclée'
    ],
    // Feminine variants (same compatibility logic)
    'Atrophiée sévère': [
      'Atrophiée sévère',
      'Atrophié sévère',
      'Atrophié',
      'Moins musclée'
    ],
    'Moins musclée': [
      'Atrophié',
      'Légèrement atrophié',
      'Moins musclée',
      'Normal',
      'Moyennement musclée'
    ],
    'Moyennement musclée': [
      'Moins musclée',        // ADDED: Transition from low to moderate
      'Normal',
      'Moyen musclé',
      'Moyennement musclée',
      'Musclé',              // ADDED: More developed feminine builds
      'Musclée'
    ],
    'Musclée': [
      'Normal',               // ADDED: Lean athletic feminine builds with normal BMI
      'Moyen musclé',         // ADDED: Cross-gender compatibility
      'Moyennement musclée',
      'Musclé',
      'Musclée',
      'Normal costaud',
      'Athlétique'           // ADDED: Very developed feminine athletes
    ]
  };
  const compatibleLevels = muscularCompatibilityMatrix[canonicalMuscularity];
  if (compatibleLevels && compatibleLevels.length > 0) {
    console.log('✅ [getCompatibleMuscularLevels] FIXED: Found compatible muscular levels', {
      canonicalMuscularity,
      compatibleLevels,
      compatibleCount: compatibleLevels.length,
      philosophy: 'muscular_gating_success_enhanced_matrix'
    });
    return compatibleLevels;
  }
  console.error('❌ [getCompatibleMuscularLevels] FIXED: No compatible levels found', {
    canonicalMuscularity,
    availableMatrixKeys: Object.keys(muscularCompatibilityMatrix),
    philosophy: 'muscular_gating_failure_no_compatible_levels'
  });
  // Return empty array to force permissive fallback (but log it clearly)
  return [];
}
/**
 * Calculate archetype distance using weighted indices
 */ function calculateArchetypeDistance(archetype, userProfile) {
  const morphIndexDiff = Math.abs((archetype.morph_index || 0) - userProfile.morph_index);
  const muscleIndexDiff = Math.abs((archetype.muscle_index || 0) - userProfile.muscle_index);
  // BMI distance calculation
  const bmiRange = archetype.bmi_range;
  let bmiDistance = 0;
  if (bmiRange && Array.isArray(bmiRange) && bmiRange.length === 2) {
    const minBMI = parseFloat(bmiRange[0]);
    const maxBMI = parseFloat(bmiRange[1]);
    const bmiCenter = (minBMI + maxBMI) / 2;
    bmiDistance = Math.abs(userProfile.estimated_bmi - bmiCenter) / ((maxBMI - minBMI) / 2 || 1);
  }
  // Weighted distance calculation
  const distance = morphIndexDiff * 0.4 + // Morph index weight
  muscleIndexDiff * 0.35 + // Muscle index weight
  bmiDistance * 0.25; // BMI distance weight
  return distance;
}
/**
 * Calculate semantic coherence score
 */ function calculateSemanticCoherence(selectedArchetypes, userProfile) {
  if (selectedArchetypes.length === 0) return 0;
  let totalScore = 0;
  let criteriaCount = 0; // Initialize criteriaCount outside the loop
  selectedArchetypes.forEach((archetype)=>{
    let archetypeScore = 0;
    let currentArchetypeCriteriaCount = 0; // Criteria count for current archetype
    if (archetype.obesity === userProfile.semantic_profile.obesity) {
      archetypeScore += 1;
    }
    currentArchetypeCriteriaCount++;
    if (archetype.muscularity === userProfile.semantic_profile.muscularity) {
      archetypeScore += 1;
    }
    currentArchetypeCriteriaCount++;
    if (archetype.level === userProfile.semantic_profile.level) {
      archetypeScore += 1;
    }
    currentArchetypeCriteriaCount++;
    if (archetype.morphotype === userProfile.semantic_profile.morphotype) {
      archetypeScore += 1;
    }
    currentArchetypeCriteriaCount++;
    totalScore += currentArchetypeCriteriaCount > 0 ? archetypeScore / currentArchetypeCriteriaCount : 0;
    criteriaCount++; // Increment overall criteria count
  });
  return criteriaCount > 0 ? totalScore / criteriaCount : 0;
}
/**
 * Calculate an overall score for an archetype based on user profile and archetype properties.
 * This score is used for sorting archetypes to find the "best" matches.
 */ function calculateOverallScore(archetype, userProfile) {
  // Weights for different criteria
  const WEIGHT_BMI_COMPATIBILITY = 0.3;
  const WEIGHT_MORPH_INDEX_SIMILARITY = 0.25;
  const WEIGHT_MUSCLE_INDEX_SIMILARITY = 0.25;
  const WEIGHT_SEMANTIC_MATCH = 0.2; // Combined weight for all semantic fields
  // 1. BMI compatibility (range-based)
  const bmiRange = archetype.bmi_range;
  const minBMI = parseFloat(bmiRange[0]);
  const maxBMI = parseFloat(bmiRange[1]);
  const bmiCenter = (minBMI + maxBMI) / 2;
  const bmiDistance = Math.abs(userProfile.estimated_bmi - bmiCenter) / ((maxBMI - minBMI) / 2 || 1);
  const bmi_compatibility = Number.isFinite(bmiDistance) ? Math.max(0, 1 - bmiDistance) : 0;
  // 2. Morph index similarity (DB-calculated indices)
  const morphIndexDiff = Math.abs((archetype.morph_index || 0) - userProfile.morph_index);
  const morph_index_similarity = Math.max(0, 1 - morphIndexDiff / 0.5); // Normalize by expected max diff
  // 3. Muscle index similarity (DB-calculated indices)
  const muscleIndexDiff = Math.abs((archetype.muscle_index || 0) - userProfile.muscle_index);
  const muscle_index_similarity = Math.max(0, 1 - muscleIndexDiff / 1.0); // Normalize by expected max diff
  // 4. Semantic classification exact match bonus
  let semanticMatchScore = 0;
  let semanticCriteriaCount = 0;
  if (archetype.obesity === userProfile.semantic_profile.obesity) {
    semanticMatchScore += 1;
  }
  semanticCriteriaCount++;
  if (archetype.muscularity === userProfile.semantic_profile.muscularity) {
    semanticMatchScore += 1;
  }
  semanticCriteriaCount++;
  if (archetype.level === userProfile.semantic_profile.level) {
    semanticMatchScore += 1;
  }
  semanticCriteriaCount++;
  if (archetype.morphotype === userProfile.semantic_profile.morphotype) {
    semanticMatchScore += 1;
  }
  semanticCriteriaCount++;
  const averageSemanticMatch = semanticCriteriaCount > 0 ? semanticMatchScore / semanticCriteriaCount : 0;
  // Combine all scores with weights
  const overall_score = bmi_compatibility * WEIGHT_BMI_COMPATIBILITY + morph_index_similarity * WEIGHT_MORPH_INDEX_SIMILARITY + muscle_index_similarity * WEIGHT_MUSCLE_INDEX_SIMILARITY + averageSemanticMatch * WEIGHT_SEMANTIC_MATCH;
  return overall_score;
}

