// supabase/functions/_shared/mappingRefetcher.ts
import { createClient } from 'npm:@supabase/supabase-js@2.54.0';
import { toCanonicalKey } from './faceKeys.ts';

/**
 * Fetches morphology mapping data directly from database
 * Returns canonical keys (no BS_LOD0.)
 */
export async function refetchMorphologyMapping(mappingVersion: string, gender: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ [mappingRefetcher] Supabase configuration missing');
    return null;
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log(`🔍 [mappingRefetcher] Fetching morph_archetypes for ${gender} mapping`);
  try {
    const { data: rows, error } = await supabase
      .from('morph_archetypes')
      .select('morph_values, limb_masses, gender'); // Sélectionner aussi le genre pour filtrer

    if (error) {
      console.error('❌ [mappingRefetcher] Database query failed:', error);
      return null;
    }
    if (!rows || rows.length === 0) {
      console.warn(`⚠️ [mappingRefetcher] No morph archetypes found for gender: ${gender}`);
      return null;
    }

    // Filtrer par genre et construire les min/max
    const genderRows = rows.filter(row => row.gender === gender);
    if (genderRows.length === 0) {
      console.warn(`⚠️ [mappingRefetcher] No morph archetypes found for specified gender: ${gender}`);
      return null;
    }

    const morphValues: Record<string, {min:number,max:number}> = {};
    const limbMasses: Record<string, {min:number,max:number}> = {};

    for (const r of genderRows) {
      const mv = r.morph_values as Record<string, number>;
      if (mv) {
        for (const [rawKey, val] of Object.entries(mv)) {
          if (typeof val !== 'number' || !Number.isFinite(val)) continue;
          const key = toCanonicalKey(rawKey);
          const cur = morphValues[key];
          if (!cur) {
            morphValues[key] = { min: val, max: val };
          } else {
            cur.min = Math.min(cur.min, val);
            cur.max = Math.max(cur.max, val);
          }
        }
      }

      const lm = r.limb_masses as Record<string, number>;
      if (lm) {
        for (const [rawKey, val] of Object.entries(lm)) {
          if (typeof val !== 'number' || !Number.isFinite(val)) continue;
          const key = toCanonicalKey(rawKey);
          const cur = limbMasses[key];
          if (!cur) {
            limbMasses[key] = { min: val, max: val };
          } else {
            cur.min = Math.min(cur.min, val);
            cur.max = Math.max(cur.max, val);
          }
        }
      }
    }

    console.log(`✅ [mappingRefetcher] Canonical morph mapping built for ${gender}:`, {
      morphValuesCount: Object.keys(morphValues).length,
      limbMassesCount: Object.keys(limbMasses).length,
      philosophy: 'morph_mapping_from_db_canonical'
    });

    return { morph_values: morphValues, limb_masses: limbMasses }; // canonical keys only
  } catch (err) {
    console.error('❌ [mappingRefetcher] Error refetching morphology mapping:', err);
    return null;
  }
}

