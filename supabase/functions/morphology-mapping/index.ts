import { getServiceClient } from './supabaseClient.ts';
import { getHardcodedMappingFallback, type MorphologyMappingData } from './fallbackMapping.ts';
import { toCanonicalKey } from '../_shared/utils/faceKeys.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Main Edge Function handler
 */
Deno.serve(async (req) => {
  const requestId = `morph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🚀 [morphology-mapping] [${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    timestamp: new Date().toISOString(),
    philosophy: 'edge_function_entry_point'
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`✅ [morphology-mapping] [${requestId}] CORS preflight handled`);
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'GET') {
    console.warn(`⚠️ [morphology-mapping] [${requestId}] Method not allowed:`, req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`🔍 [morphology-mapping] [${requestId}] Starting morphology mapping fetch`);
    
    const mappingData = await fetchMorphologyMappingDirect(requestId);
    
    console.log(`✅ [morphology-mapping] [${requestId}] Successfully fetched mapping data:`, {
      hasMasculineMapping: !!mappingData.mapping_masculine,
      hasFeminineMapping: !!mappingData.mapping_feminine,
      masculineMorphValuesCount: Object.keys(mappingData.mapping_masculine?.morph_values || {}).length,
      feminineMorphValuesCount: Object.keys(mappingData.mapping_feminine?.morph_values || {}).length,
      masculineLimbMassesCount: Object.keys(mappingData.mapping_masculine?.limb_masses || {}).length,
      feminineLimbMassesCount: Object.keys(mappingData.mapping_feminine?.limb_masses || {}).length,
      masculineFaceValuesCount: Object.keys(mappingData.mapping_masculine?.face_values || {}).length, // ADDED
      feminineFaceValuesCount: Object.keys(mappingData.mapping_feminine?.face_values || {}).length,   // ADDED
      philosophy: 'successful_mapping_fetch'
    });

    return new Response(JSON.stringify({
      success: true,
      data: mappingData,
      timestamp: new Date().toISOString(),
      request_id: requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ [morphology-mapping] [${requestId}] Error occurred:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      philosophy: 'edge_function_error_fallback'
    });

    // Return fallback data instead of error
    const fallbackData = getHardcodedMappingFallback();
    
    console.warn(`🔧 [morphology-mapping] [${requestId}] Returning fallback data:`, {
      masculineMorphValuesCount: Object.keys(fallbackData.mapping_masculine?.morph_values || {}).length,
      feminineMorphValuesCount: Object.keys(fallbackData.mapping_feminine?.morph_values || {}).length,
      masculineFaceValuesCount: Object.keys(fallbackData.mapping_masculine?.face_values || {}).length, // ADDED
      feminineFaceValuesCount: Object.keys(fallbackData.mapping_feminine?.face_values || {}).length,   // ADDED
      philosophy: 'fallback_data_served'
    });

    return new Response(JSON.stringify({
      success: true,
      data: fallbackData,
      fallback_used: true,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      request_id: requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Fetch morphology directly from database (no recursive calls)
 */
async function fetchMorphologyMappingDirect(requestId: string): Promise<MorphologyMappingData> {
  console.log(`🔍 [fetchMorphologyMappingDirect] [${requestId}] Starting direct database fetch`);
  
  const supabase = getServiceClient();
  
  console.log(`🔍 [fetchMorphologyMappingDirect] [${requestId}] Service client initialized, querying morph_archetypes and face_archetypes tables`); // MODIFIED
  
  try {
    // Fetch body archetypes
    const { data: bodyArchetypes, error: bodyDbError } = await supabase
      .from('morph_archetypes')
      .select(`
        id, name, gender, gender_code, obesity, muscularity, level, morphotype,
        morph_index, muscle_index, bmi_range, height_range, weight_range,
        morph_values, limb_masses, abdomen_round
      `);
    
    if (bodyDbError) {
      console.error(`❌ [fetchMorphologyMappingDirect] [${requestId}] Body archetypes DB error:`, bodyDbError);
      throw new Error(`Body archetypes query failed: ${bodyDbError.message}`);
    }
    
    // Fetch face archetypes
    const { data: faceArchetypes, error: faceDbError } = await supabase
      .from('face_archetypes')
      .select(`
        id, name, gender, face_shape, eye_shape, nose_type, lip_fullness, face_values
      `); // MODIFIED
    
    if (faceDbError) {
      console.error(`❌ [fetchMorphologyMappingDirect] [${requestId}] Face archetypes DB error:`, faceDbError);
      throw new Error(`Face archetypes query failed: ${faceDbError.message}`);
    }

    if (!bodyArchetypes || bodyArchetypes.length === 0 || !faceArchetypes || faceArchetypes.length === 0) { // MODIFIED
      console.warn(`⚠️ [fetchMorphologyMappingDirect] [${requestId}] No archetypes found in database, using fallback`);
      return getHardcodedMappingFallback();
    }
    
    console.log(`✅ [fetchMorphologyMappingDirect] [${requestId}] Processing ${bodyArchetypes.length} body archetypes and ${faceArchetypes.length} face archetypes from database`); // MODIFIED
    
    const mappingData = buildMappingFromArchetypes(bodyArchetypes, faceArchetypes, requestId); // MODIFIED
    
    console.log(`✅ [fetchMorphologyMappingDirect] [${requestId}] Mapping data built successfully:`, {
      masculineBodyArchetypes: bodyArchetypes.filter(a => a.gender === 'masculine').length,
      feminineBodyArchetypes: bodyArchetypes.filter(a => a.gender === 'feminine').length,
      masculineFaceArchetypes: faceArchetypes.filter(a => a.gender === 'masculine').length, // ADDED
      feminineFaceArchetypes: faceArchetypes.filter(a => a.gender === 'feminine').length,   // ADDED
      philosophy: 'database_mapping_construction_success'
    });
    
    return mappingData;
    
  } catch (queryError) {
    console.error(`❌ [fetchMorphologyMappingDirect] [${requestId}] Query exception:`, {
      error: queryError instanceof Error ? queryError.message : 'Unknown error',
      stack: queryError instanceof Error ? queryError.stack : undefined,
      philosophy: 'database_query_exception_fallback_needed'
    });
    
    console.warn(`🔧 [fetchMorphologyMappingDirect] [${requestId}] Using hardcoded fallback due to query exception`);
    return getHardcodedMappingFallback();
  }
}

/**
 * Build mapping data from archetypes
 */
function buildMappingFromArchetypes(bodyArchetypes: any[], faceArchetypes: any[], requestId: string): MorphologyMappingData { // MODIFIED
  const masculineBodyArchetypes = bodyArchetypes.filter(a => a.gender === 'masculine');
  const feminineBodyArchetypes = bodyArchetypes.filter(a => a.gender === 'feminine');
  const masculineFaceArchetypes = faceArchetypes.filter(a => a.gender === 'masculine'); // ADDED
  const feminineFaceArchetypes = faceArchetypes.filter(a => a.gender === 'feminine');   // ADDED

  console.log(`🔍 [buildMappingFromArchetypes] [${requestId}] Building mapping from DB archetypes:`, {
    totalBodyArchetypes: bodyArchetypes.length,
    masculineBodyCount: masculineBodyArchetypes.length,
    feminineBodyCount: feminineBodyArchetypes.length,
    totalFaceArchetypes: faceArchetypes.length, // ADDED
    masculineFaceCount: masculineFaceArchetypes.length, // ADDED
    feminineFaceCount: feminineFaceArchetypes.length,   // ADDED
    philosophy: 'direct_db_mapping_construction'
  });

  const masculineMapping = buildGenderMapping(masculineBodyArchetypes, masculineFaceArchetypes, 'masculine', requestId); // MODIFIED
  const feminineMapping = buildGenderMapping(feminineBodyArchetypes, feminineFaceArchetypes, 'feminine', requestId);     // MODIFIED

  return {
    mapping_masculine: masculineMapping,
    mapping_feminine: feminineMapping
  };
}

/**
 * Build gender-specific mapping
 */
function buildGenderMapping(bodyArchetypes: any[], faceArchetypes: any[], gender: 'masculine' | 'feminine', requestId: string) { // MODIFIED
  console.log(`🔍 [buildGenderMapping] [${requestId}] Building ${gender} mapping from ${bodyArchetypes.length} body archetypes and ${faceArchetypes.length} face archetypes`); // MODIFIED
  
  // Extract unique semantic categories (from body archetypes)
  const levels = [...new Set(bodyArchetypes.map(a => a.level).filter(Boolean))].sort();
  const obesity = [...new Set(bodyArchetypes.map(a => a.obesity).filter(Boolean))].sort();
  const morphotypes = [...new Set(bodyArchetypes.map(a => a.morphotype).filter(Boolean))].sort();
  const muscularity = [...new Set(bodyArchetypes.map(a => a.muscularity).filter(Boolean))].sort();

  console.log(`🔍 [buildGenderMapping] [${requestId}] Extracted semantic categories for ${gender}:`, {
    levels: levels.length,
    obesity: obesity.length,
    morphotypes: morphotypes.length,
    muscularity: muscularity.length,
    levelsData: levels,
    obesityData: obesity,
    morphotypesData: morphotypes,
    muscularityData: muscularity
  });

  // Build morph_values and limb_masses ranges (from body archetypes)
  const morph_values = buildMorphValuesRanges(bodyArchetypes, gender, requestId);
  const limb_masses = buildLimbMassesRanges(bodyArchetypes, gender, requestId);

  // Build face_values ranges (from face archetypes) - ADDED
  const face_values = buildFaceValuesRanges(faceArchetypes, gender, requestId); // ADDED

  console.log(`✅ [buildGenderMapping] [${requestId}] Gender mapping built for ${gender}:`, {
    levels: levels.length,
    obesity: obesity.length,
    morphotypes: morphotypes.length,
    muscularity: muscularity.length,
    morphValuesKeys: Object.keys(morph_values).length,
    limbMassesKeys: Object.keys(limb_masses).length,
    faceValuesKeys: Object.keys(face_values).length, // ADDED
    philosophy: 'gender_mapping_construction_complete'
  });

  return {
    levels,
    obesity,
    morphotypes,
    muscularity,
    morph_values,
    limb_masses,
    face_values // ADDED
  };
}

/**
 * Build morph_values ranges from body archetypes
 */
function buildMorphValuesRanges(archetypes: any[], gender: string, requestId: string) {
  console.log(`🔍 [buildMorphValuesRanges] [${requestId}] Building morph values ranges for ${gender} from ${archetypes.length} archetypes`);
  
  const morphValuesRanges: Record<string, { min: number; max: number }> = {};
  let processedArchetypes = 0;
  let skippedArchetypes = 0;
  
  archetypes.forEach((archetype, index) => {
    let morphValues;
    try {
      morphValues = typeof archetype.morph_values === 'string' 
        ? JSON.parse(archetype.morph_values) 
        : archetype.morph_values;
      
      if (morphValues && typeof morphValues === 'object') {
        Object.entries(morphValues).forEach(([key, value]) => {
          if (typeof value === 'number') {
            const canonicalKey = toCanonicalKey(key); // Canonicalize key here
            if (!morphValuesRanges[canonicalKey]) {
              morphValuesRanges[canonicalKey] = { min: value, max: value };
            } else {
              morphValuesRanges[canonicalKey].min = Math.min(morphValuesRanges[canonicalKey].min, value);
              morphValuesRanges[canonicalKey].max = Math.max(morphValuesRanges[canonicalKey].max, value);
            }
          }
        });
        processedArchetypes++;
      } else {
        skippedArchetypes++;
      }
    } catch (error) {
      console.warn(`⚠️ [buildMorphValuesRanges] [${requestId}] Failed to parse morph_values for archetype ${archetype.id}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        archetypeIndex: index
      });
      skippedArchetypes++;
    }
  });

  console.log(`✅ [buildMorphValuesRanges] [${requestId}] Morph values ranges built for ${gender}:`, {
    totalKeys: Object.keys(morphValuesRanges).length,
    processedArchetypes,
    skippedArchetypes,
    sampleKeys: Object.keys(morphValuesRanges).slice(0, 5),
    philosophy: 'morph_values_ranges_construction_complete'
  });

  return morphValuesRanges;
}

/**
 * Build limb_masses ranges from body archetypes
 */
function buildLimbMassesRanges(archetypes: any[], gender: string, requestId: string) {
  console.log(`🔍 [buildLimbMassesRanges] [${requestId}] Building limb masses ranges for ${gender} from ${archetypes.length} archetypes`);
  
  const limbMassesRanges: Record<string, { min: number; max: number }> = {};
  let processedArchetypes = 0;
  let skippedArchetypes = 0;
  
  archetypes.forEach((archetype, index) => {
    let limbMasses;
    try {
      limbMasses = typeof archetype.limb_masses === 'string' 
        ? JSON.parse(archetype.limb_masses) 
        : archetype.limb_masses;
      
      if (limbMasses && typeof limbMasses === 'object') {
        Object.entries(limbMasses).forEach(([key, value]) => {
          if (typeof value === 'number') {
            const canonicalKey = toCanonicalKey(key); // Canonicalize key here
            if (!limbMassesRanges[canonicalKey]) {
              limbMassesRanges[canonicalKey] = { min: value, max: value };
            } else {
              limbMassesRanges[canonicalKey].min = Math.min(limbMassesRanges[canonicalKey].min, value);
              limbMassesRanges[canonicalKey].max = Math.max(limbMassesRanges[canonicalKey].max, value);
            }
          }
        });
        processedArchetypes++;
      } else {
        skippedArchetypes++;
      }
    } catch (error) {
      console.warn(`⚠️ [buildLimbMassesRanges] [${requestId}] Failed to parse limb_masses for archetype ${archetype.id}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        archetypeIndex: index
      });
      skippedArchetypes++;
    }
  });

  console.log(`✅ [buildLimbMassesRanges] [${requestId}] Limb masses ranges built for ${gender}:`, {
    totalKeys: Object.keys(limbMassesRanges).length,
    processedArchetypes,
    skippedArchetypes,
    sampleKeys: Object.keys(limbMassesRanges).slice(0, 5),
    philosophy: 'limb_masses_ranges_construction_complete'
  });

  return limbMassesRanges;
}

/**
 * Build face_values ranges from face archetypes - ADDED
 */
function buildFaceValuesRanges(archetypes: any[], gender: string, requestId: string) {
  console.log(`🔍 [buildFaceValuesRanges] [${requestId}] Building face values ranges for ${gender} from ${archetypes.length} archetypes`);
  
  const faceValuesRanges: Record<string, { min: number; max: number }> = {};
  let processedArchetypes = 0;
  let skippedArchetypes = 0;
  
  archetypes.forEach((archetype, index) => {
    let faceValues;
    try {
      faceValues = typeof archetype.face_values === 'string' 
        ? JSON.parse(archetype.face_values) 
        : archetype.face_values;
      
      if (faceValues && typeof faceValues === 'object') {
        Object.entries(faceValues).forEach(([key, value]) => {
          if (typeof value === 'number') {
            const canonicalKey = toCanonicalKey(key); // Canonicalize key here
            if (!faceValuesRanges[canonicalKey]) {
              faceValuesRanges[canonicalKey] = { min: value, max: value };
            } else {
              faceValuesRanges[canonicalKey].min = Math.min(faceValuesRanges[canonicalKey].min, value);
              faceValuesRanges[canonicalKey].max = Math.max(faceValuesRanges[canonicalKey].max, value);
            }
          }
        });
        processedArchetypes++;
      } else {
        skippedArchetypes++;
      }
    } catch (error) {
      console.warn(`⚠️ [buildFaceValuesRanges] [${requestId}] Failed to parse face_values for archetype ${archetype.id}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        archetypeIndex: index
      });
      skippedArchetypes++;
    }
  });

  console.log(`✅ [buildFaceValuesRanges] [${requestId}] Face values ranges built for ${gender}:`, {
    totalKeys: Object.keys(faceValuesRanges).length,
    processedArchetypes,
    skippedArchetypes,
    sampleKeys: Object.keys(faceValuesRanges).slice(0, 5),
    philosophy: 'face_values_ranges_construction_complete'
  });

  return faceValuesRanges;
}

/**
 * Normalize muscularity term for consistent matching
 * Handles accents, case, and gender variations
 */
export function normalizeMuscularityTerm(term: string): string {
  if (!term || typeof term !== 'string') {
    console.warn('🔍 [normalizeMuscularityTerm] Invalid term provided', { term, type: typeof term });
    return 'Normal';
  }
  
  // Remove accents and normalize case
  const normalized = term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim();
  
  // Mapping table for consistent terms
  const muscularityMapping: Record<string, string> = {
    // Atrophied variations
    'atrophie': 'Atrophié',
    'atrophie severe': 'Atrophié sévère',
    'atrophie sevère': 'Atrophié sévère',
    'atrophiee': 'Atrophié',
    'atrophiee severe': 'Atrophié sévère',
    'atrophiee sevère': 'Atrophié sévère',
    'legèrement atrophie': 'Légèrement atrophié',
    'legèrement atrophié': 'Légèrement atrophié',
    'legerement atrophie': 'Légèrement atrophié',
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
    'athlétique': 'Athlétique',
  };
  
  const mappedTerm = muscularityMapping[normalized];
  
  if (mappedTerm) {
    console.log('✅ [normalizeMuscularityTerm] Term normalized successfully', {
      original: term,
      normalized: normalized,
      mapped: mappedTerm,
      philosophy: 'muscularity_normalization_success'
    });
    return mappedTerm;
  }
  
  // If no mapping found, try to find closest match
  const closestMatch = findClosestMuscularityMatch(normalized);
  
  console.warn('⚠️ [normalizeMuscularityTerm] Using closest match for unknown term', {
    original: term,
    normalized: normalized,
    closestMatch: closestMatch,
    philosophy: 'muscularity_normalization_fallback'
  });
  
  return closestMatch;
}

/**
 * Find closest muscularity match for unknown terms
 */
function findClosestMuscularityMatch(normalized: string): string {
  const standardTerms = [
    'Atrophié sévère', 'Légèrement atrophié', 'Moyen musclé', 'Musclé', 'Normal costaud',
    'Atrophiée sévère', 'Moins musclée', 'Moyennement musclée', 'Musclée'
  ];
  
  // Simple keyword matching
  if (normalized.includes('severe') || normalized.includes('sevère')) {
    return normalized.includes('muscle') || normalized.includes('muscl') ? 'Atrophié sévère' : 'Atrophié sévère';
  }
  
  if (normalized.includes('atrophi')) {
    return normalized.includes('leger') || normalized.includes('légèr') ? 'Légèrement atrophié' : 'Atrophié';
  }
  
  if (normalized.includes('moyen') || normalized.includes('medium')) {
    return 'Moyen musclé';
  }
  
  if (normalized.includes('muscle') || normalized.includes('muscl')) {
    return 'Musclé';
  }
  
  if (normalized.includes('athleti') || normalized.includes('athléti')) {
    return 'Athlétique';
  }
  
  // Default fallback
  return 'Normal';
}

