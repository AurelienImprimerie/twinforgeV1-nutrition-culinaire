// supabase/functions/_shared/utils/toDbGender.ts

/**
 * Converts 'male' or 'female' to 'masculine' or 'feminine' for DB enums.
 * Robustified to handle 'masculine'/'feminine' inputs directly.
 */
export function toDbGender(gender: 'male' | 'female' | 'masculine' | 'feminine'): 'masculine' | 'feminine' {
  if (gender === 'male' || gender === 'masculine') return 'masculine';
  if (gender === 'female' || gender === 'feminine') return 'feminine';
  
  // Fallback for unexpected values, though validation should prevent this
  console.warn(`[toDbGender] Invalid gender input: ${gender}. Defaulting to 'masculine'.`);
  return 'masculine';
}
