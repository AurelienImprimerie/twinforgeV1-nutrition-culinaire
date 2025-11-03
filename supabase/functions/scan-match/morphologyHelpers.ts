/**
 * Morphology Helpers - FIXED: Completely Self-Sufficient
 * Direct morphology mapping fetching with NO external Edge Function calls
 */ import { getHardcodedMappingFallback } from './fallbackMapping.ts'; // Corrigé
/**
 * FIXED: Get morphology mapping directly from database with NO external calls
 * Completely self-sufficient approach that NEVER calls other Edge Functions
 */ export async function getMorphologyMappingDirect(supabase) {
  console.log('🔍 [getMorphologyMappingDirect] FIXED: Starting completely self-sufficient mapping fetch');
  // ONLY Strategy: Direct DB query (NO Edge Function calls)
  try {
    console.log('🔍 [getMorphologyMappingDirect] FIXED: Direct DB query (no external calls)');
    const { data: archetypes, error: dbError } = await supabase.from('morph_archetypes').select(`
        id,
        name,
        gender,
        gender_code,
        obesity,
        muscularity,
        level,
        morphotype,
        morph_index,
        muscle_index,
        bmi_range,
        height_range,
        weight_range,
        morph_values,
        limb_masses,
        abdomen_round
      `);
    if (!dbError && archetypes && archetypes.length > 0) {
      console.log('✅ [getMorphologyMappingDirect] FIXED: Direct DB query successful', {
        archetypesCount: archetypes.length,
        masculineCount: archetypes.filter((a)=>a.gender === 'masculine').length,
        feminineCount: archetypes.filter((a)=>a.gender === 'feminine').length,
        philosophy: 'completely_self_sufficient_db_query_success'
      });
      const mappingData = buildMappingFromArchetypes(archetypes);
      return {
        success: true,
        data: mappingData,
        metadata: {
          mapping_source: 'database',
          mapping_version: 'v1.0-scan-match-direct',
          fallback_used: false,
          fallback_reason: null,
          checksum: `db-${archetypes.length}-archetypes`,
          generated_at: new Date().toISOString(),
          total_archetypes_analyzed: archetypes.length
        },
        fallback_used: false
      };
    }
    console.warn('⚠️ [getMorphologyMappingDirect] FIXED: Direct DB query failed', {
      error: dbError?.message || 'No error message',
      archetypesCount: archetypes?.length || 0,
      dbErrorCode: dbError?.code,
      dbErrorDetails: dbError?.details,
      philosophy: 'db_query_fallback_needed'
    });
  } catch (dbQueryError) {
    console.warn('⚠️ [getMorphologyMappingDirect] FIXED: Direct DB query exception', {
      error: dbQueryError instanceof Error ? dbQueryError.message : 'Unknown error',
      philosophy: 'db_query_exception_fallback_needed'
    });
  }
  // Fallback: Hardcoded mapping (ultimate fallback)
  console.warn('⚠️ [getMorphologyMappingDirect] FIXED: Using hardcoded fallback');
  const fallbackMapping = getHardcodedMappingFallback();
  return {
    success: true,
    data: fallbackMapping,
    metadata: {
      mapping_source: 'fallback',
      mapping_version: 'v1.0-scan-match-fallback',
      fallback_used: true,
      fallback_reason: 'database_query_failed',
      checksum: 'hardcoded-scan-match-fallback',
      generated_at: new Date().toISOString(),
      total_archetypes_analyzed: 0
    },
    fallback_used: true
  };
}
/**
 * Build mapping data from archetypes (Strategy 1)
 */ function buildMappingFromArchetypes(archetypes) {
  const masculineArchetypes = archetypes.filter((a)=>a.gender === 'masculine');
  const feminineArchetypes = archetypes.filter((a)=>a.gender === 'feminine');
  console.log('🔍 [buildMappingFromArchetypes] Building mapping from DB archetypes', {
    totalArchetypes: archetypes.length,
    masculineCount: masculineArchetypes.length,
    feminineCount: feminineArchetypes.length,
    philosophy: 'direct_db_mapping_construction'
  });
  return {
    mapping_masculine: buildGenderMapping(masculineArchetypes, 'masculine'),
    mapping_feminine: buildGenderMapping(feminineArchetypes, 'feminine')
  };
}
/**
 * Build gender-specific mapping
 */ function buildGenderMapping(genderArchetypes, gender) {
  // Extract unique semantic categories
  const levels = [
    ...new Set(genderArchetypes.map((a)=>a.level).filter(Boolean))
  ].sort();
  const obesity = [
    ...new Set(genderArchetypes.map((a)=>a.obesity).filter(Boolean))
  ].sort();
  const morphotypes = [
    ...new Set(genderArchetypes.map((a)=>a.morphotype).filter(Boolean))
  ].sort();
  const muscularity = [
    ...new Set(genderArchetypes.map((a)=>a.muscularity).filter(Boolean))
  ].sort();
  // Build morph_values and limb_masses ranges
  const morph_values = buildMorphValuesRanges(genderArchetypes);
  const limb_masses = buildLimbMassesRanges(genderArchetypes);
  console.log('🔍 [buildGenderMapping] Gender mapping built', {
    gender,
    levels: levels.length,
    obesity: obesity.length,
    morphotypes: morphotypes.length,
    muscularity: muscularity.length,
    morphValuesKeys: Object.keys(morph_values).length,
    limbMassesKeys: Object.keys(limb_masses).length,
    muscularityTermsInDB: muscularity
  });
  return {
    levels,
    obesity,
    morphotypes,
    muscularity,
    morph_values,
    limb_masses
  };
}
/**
 * Build morph_values ranges from archetypes
 */ function buildMorphValuesRanges(archetypes) {
  const morphValuesRanges = {};
  archetypes.forEach((archetype)=>{
    let morphValues;
    try {
      morphValues = typeof archetype.morph_values === 'string' ? JSON.parse(archetype.morph_values) : archetype.morph_values;
    } catch (error) {
      console.warn('Failed to parse morph_values for archetype', archetype.id);
      return;
    }
    if (morphValues && typeof morphValues === 'object') {
      Object.entries(morphValues).forEach(([key, value])=>{
        if (typeof value === 'number') {
          if (!morphValuesRanges[key]) {
            morphValuesRanges[key] = {
              min: value,
              max: value
            };
          } else {
            morphValuesRanges[key].min = Math.min(morphValuesRanges[key].min, value);
            morphValuesRanges[key].max = Math.max(morphValuesRanges[key].max, value);
          }
        }
      });
    }
  });
  return morphValuesRanges;
}
/**
 * Build limb_masses ranges from archetypes
 */ function buildLimbMassesRanges(archetypes) {
  const limbMassesRanges = {};
  archetypes.forEach((archetype)=>{
    let limbMasses;
    try {
      limbMasses = typeof archetype.limb_masses === 'string' ? JSON.parse(archetype.limb_masses) : archetype.limb_masses;
    } catch (error) {
      console.warn('Failed to parse limb_masses for archetype', archetype.id);
      return;
    }
    if (limbMasses && typeof limbMasses === 'object') {
      Object.entries(limbMasses).forEach(([key, value])=>{
        if (typeof value === 'number') {
          if (!limbMassesRanges[key]) {
            limbMassesRanges[key] = {
              min: value,
              max: value
            };
          } else {
            limbMassesRanges[key].min = Math.min(limbMassesRanges[key].min, value);
            limbMassesRanges[key].max = Math.max(limbMassesRanges[key].max, value);
          }
        }
      });
    }
  });
  return limbMassesRanges;
}
/**
 * FIXED: Normalize muscularity term for consistent matching
 * Enhanced with comprehensive mapping and detailed logging
 */ export function normalizeMuscularityTerm(term) {
  if (!term || typeof term !== 'string') {
    console.warn('🔍 [normalizeMuscularityTerm] FIXED: Invalid term provided', {
      term,
      type: typeof term,
      philosophy: 'input_validation'
    });
    return 'Normal';
  }
  // Remove accents and normalize case
  const normalized = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
  .trim();
  console.log('🔍 [normalizeMuscularityTerm] FIXED: Processing term', {
    originalTerm: term,
    normalizedTerm: normalized,
    philosophy: 'term_normalization_process'
  });
  // FIXED: Enhanced mapping table with comprehensive coverage
  const muscularityMapping = {
    // Atrophied variations - FIXED: Complete coverage
    'atrophie': 'Atrophié',
    'atrophié': 'Atrophié',
    'atrophie severe': 'Atrophié sévère',
    'atrophie sevère': 'Atrophié sévère',
    'atrophiee': 'Atrophié',
    'atrophiee severe': 'Atrophié sévère',
    'atrophiee sevère': 'Atrophié sévère',
    'legèrement atrophie': 'Légèrement atrophié',
    'legèrement atrophié': 'Légèrement atrophié',
    'legerement atrophie': 'Légèrement atrophié',
    'legerement atrophié': 'Légèrement atrophié',
    'moins musclee': 'Moins musclée',
    'moins musclée': 'Moins musclée',
    // Normal variations
    'normal': 'Normal',
    'normal costaud': 'Normal costaud',
    // Medium muscle variations
    'moyen muscle': 'Moyen musclé',
    'moyen musclé': 'Moyen musclé',
    'moyennement muscle': 'Moyennement musclée',
    'moyennement musclee': 'Moyennement musclée',
    'moyennement musclée': 'Moyennement musclée',
    // Athletic variations
    'muscle': 'Musclé',
    'musclé': 'Musclé',
    'musclee': 'Musclée',
    'musclée': 'Musclée',
    'athletique': 'Athlétique',
    'athlétique': 'Athlétique'
  };
  const mappedTerm = muscularityMapping[normalized];
  if (mappedTerm) {
    console.log('✅ [normalizeMuscularityTerm] FIXED: Term normalized successfully', {
      originalTerm: term,
      normalizedTerm: normalized,
      canonicalTerm: mappedTerm,
      philosophy: 'muscularity_normalization_success'
    });
    return mappedTerm;
  }
  // If no mapping found, try to find closest match
  const closestMatch = findClosestMuscularityMatch(normalized);
  console.warn('⚠️ [normalizeMuscularityTerm] FIXED: Using closest match for unknown term', {
    originalTerm: term,
    normalizedTerm: normalized,
    closestMatch: closestMatch,
    availableMappings: Object.keys(muscularityMapping).slice(0, 10),
    philosophy: 'muscularity_normalization_fallback'
  });
  return closestMatch;
}
/**
 * FIXED: Find closest muscularity match for unknown terms
 * Enhanced with better keyword matching logic
 */ function findClosestMuscularityMatch(normalized) {
  console.log('🔍 [findClosestMuscularityMatch] FIXED: Finding closest match', {
    normalizedTerm: normalized,
    philosophy: 'closest_match_analysis'
  });
  // Enhanced keyword matching with priority order
  if (normalized.includes('severe') || normalized.includes('sevère')) {
    const result = 'Atrophié sévère';
    console.log('✅ [findClosestMuscularityMatch] FIXED: Matched severe pattern', {
      normalizedTerm: normalized,
      result,
      pattern: 'severe/sevère'
    });
    return result;
  }
  if (normalized.includes('atrophi')) {
    const result = normalized.includes('leger') || normalized.includes('légèr') ? 'Légèrement atrophié' : 'Atrophié';
    console.log('✅ [findClosestMuscularityMatch] FIXED: Matched atrophy pattern', {
      normalizedTerm: normalized,
      result,
      pattern: 'atrophi + leger check'
    });
    return result;
  }
  if (normalized.includes('moyen') || normalized.includes('medium')) {
    const result = 'Moyen musclé';
    console.log('✅ [findClosestMuscularityMatch] FIXED: Matched medium pattern', {
      normalizedTerm: normalized,
      result,
      pattern: 'moyen/medium'
    });
    return result;
  }
  if (normalized.includes('muscle') || normalized.includes('muscl')) {
    const result = 'Musclé';
    console.log('✅ [findClosestMuscularityMatch] FIXED: Matched muscle pattern', {
      normalizedTerm: normalized,
      result,
      pattern: 'muscle/muscl'
    });
    return result;
  }
  if (normalized.includes('athleti') || normalized.includes('athléti')) {
    const result = 'Athlétique';
    console.log('✅ [findClosestMuscularityMatch] FIXED: Matched athletic pattern', {
      normalizedTerm: normalized,
      result,
      pattern: 'athleti/athléti'
    });
    return result;
  }
  // Default fallback
  const result = 'Normal';
  console.log('⚠️ [findClosestMuscularityMatch] FIXED: Using default fallback', {
    normalizedTerm: normalized,
    result,
    reason: 'no_pattern_matched',
    philosophy: 'default_fallback'
  });
  return result;
}
