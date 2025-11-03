// supabase/functions/_shared/utils/faceKeys.ts

/** Strip common Blender prefixes; keep canonical "Face*" key names */
export function toCanonicalKey(key: string): string {
  if (!key) return key;
  // remove BS_LOD0. and category prefixes
  let k = key.replace(/^BS_LOD0\./, '');
  k = k.replace(/^(Face|Body|Anim)\./, ''); // if someone used "Face.FaceJawWidth"
  // unify a few historical aliases
  const alias: Record<string,string> = {
    FaceMono: 'FaceMonolid',
    Monolid: 'FaceMonolid', // just in case
  };
  return alias[k] ?? k;
}

/** Convert a dict of raw keys to canonical keys (merging dupes by keeping last) */
export function canonicalizeDict<T extends number | {min:number,max:number}>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k,v] of Object.entries(obj ?? {})) {
    out[toCanonicalKey(k)] = v as T;
  }
  return out;
}

/** Canonicalize K5 envelope structure (shape only here) */
export function canonicalizeK5Envelope(env: any): { shape_params_envelope: Record<string,{min:number,max:number}>, limb_masses_envelope: Record<string,{min:number,max:number}>, envelope_metadata?: any } {
  if (!env) return { shape_params_envelope: {}, limb_masses_envelope: {} };
  const shape = canonicalizeDict(env.shape_params_envelope ?? env); // accept flat legacy
  const limb  = canonicalizeDict(env.limb_masses_envelope ?? {});
  return { shape_params_envelope: shape, limb_masses_envelope: limb, envelope_metadata: env.envelope_metadata };
}

/** Logging helper only */
export function normalizeKeyForLogging(key: string): string {
  return toCanonicalKey(key);
}
