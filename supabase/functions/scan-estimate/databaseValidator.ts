/**
 * Database Validator
 * Validates extracted data against DB constraints and rules
 */ /**
 * Validate extracted data against database constraints
 */ export async function validateWithDatabase(supabase, input) {
  console.log('🔍 [databaseValidator] Starting DB-first validation');
  const flags = [];
  const corrections = {};
  // Get physiological ranges from DB
  const physiologicalRanges = await getPhysiologicalRanges(supabase, input.user_declared_gender);
  // Validate BMI against absolute physiological limits
  let bmiValid = true;
  if (input.estimated_bmi < physiologicalRanges.bmi_min) {
    flags.push('bmi_below_physiological_minimum');
    corrections.estimated_bmi = physiologicalRanges.bmi_min;
    bmiValid = false;
  } else if (input.estimated_bmi > physiologicalRanges.bmi_max) {
    flags.push('bmi_above_physiological_maximum');
    corrections.estimated_bmi = physiologicalRanges.bmi_max;
    bmiValid = false;
  }
  // Validate measurements against gender-specific ranges
  const { raw_measurements } = input;
  if (raw_measurements.waist_cm < physiologicalRanges.waist_range[0] || raw_measurements.waist_cm > physiologicalRanges.waist_range[1]) {
    flags.push('waist_measurement_out_of_range');
    corrections.waist_cm = Math.max(physiologicalRanges.waist_range[0], Math.min(physiologicalRanges.waist_range[1], raw_measurements.waist_cm));
  }
  if (raw_measurements.chest_cm < physiologicalRanges.chest_range[0] || raw_measurements.chest_cm > physiologicalRanges.chest_range[1]) {
    flags.push('chest_measurement_out_of_range');
    corrections.chest_cm = Math.max(physiologicalRanges.chest_range[0], Math.min(physiologicalRanges.chest_range[1], raw_measurements.chest_cm));
  }
  if (raw_measurements.hips_cm < physiologicalRanges.hips_range[0] || raw_measurements.hips_cm > physiologicalRanges.hips_range[1]) {
    flags.push('hips_measurement_out_of_range');
    corrections.hips_cm = Math.max(physiologicalRanges.hips_range[0], Math.min(physiologicalRanges.hips_range[1], raw_measurements.hips_cm));
  }
  // Validate anatomical consistency
  if (raw_measurements.hips_cm < raw_measurements.waist_cm) {
    flags.push('hips_smaller_than_waist_anatomically_impossible');
    corrections.hips_cm = raw_measurements.waist_cm + 5;
  }
  if (raw_measurements.chest_cm < raw_measurements.waist_cm - 20) {
    flags.push('chest_significantly_smaller_than_waist');
    corrections.chest_cm = raw_measurements.waist_cm - 10;
  }
  console.log('🔍 [databaseValidator] DB validation completed:', {
    valid: bmiValid && flags.length === 0,
    flagsCount: flags.length,
    correctionsCount: Object.keys(corrections).length,
    flags,
    corrections
  });
  return {
    valid: bmiValid && flags.length === 0,
    flags,
    corrections: Object.keys(corrections).length > 0 ? corrections : undefined,
    physiological_ranges: physiologicalRanges
  };
}
/**
 * Get physiological ranges from database
 */ async function getPhysiologicalRanges(supabase, gender) {
  // Query morph_archetypes to get absolute min/max ranges for this gender
  const { data: archetypes, error } = await supabase.from('morph_archetypes').select('bmi_range, height_range, weight_range').eq('gender_code', gender === 'masculine' ? 'MAS' : 'FEM');
  if (error || !archetypes || archetypes.length === 0) {
    console.warn('⚠️ [databaseValidator] Could not fetch physiological ranges from DB, using defaults');
    return getDefaultPhysiologicalRanges(gender);
  }
  // Calculate absolute min/max from all archetypes
  const bmiRanges = archetypes.map((a)=>a.bmi_range).filter((r)=>r && r.length === 2);
  const heightRanges = archetypes.map((a)=>a.height_range).filter((r)=>r && r.length === 2);
  const weightRanges = archetypes.map((a)=>a.weight_range).filter((r)=>r && r.length === 2);
  const bmi_min = Math.min(...bmiRanges.map((r)=>parseFloat(r[0])));
  const bmi_max = Math.max(...bmiRanges.map((r)=>parseFloat(r[1])));
  // Calculate measurement ranges based on height/weight ranges
  const height_min = Math.min(...heightRanges.map((r)=>parseFloat(r[0])));
  const height_max = Math.max(...heightRanges.map((r)=>parseFloat(r[1])));
  const weight_min = Math.min(...weightRanges.map((r)=>parseFloat(r[0])));
  const weight_max = Math.max(...weightRanges.map((r)=>parseFloat(r[1])));
  // Estimate measurement ranges from anthropometric data
  const waist_range = gender === 'masculine' ? [
    65,
    130
  ] : [
    55,
    120
  ];
  const chest_range = gender === 'masculine' ? [
    85,
    140
  ] : [
    75,
    130
  ];
  const hips_range = gender === 'masculine' ? [
    80,
    125
  ] : [
    80,
    140
  ];
  console.log('🔍 [databaseValidator] Retrieved physiological ranges from DB:', {
    bmi_range: [
      bmi_min,
      bmi_max
    ],
    archetypesCount: archetypes.length,
    gender
  });
  return {
    bmi_min,
    bmi_max,
    waist_range,
    chest_range,
    hips_range
  };
}
/**
 * Default physiological ranges if DB query fails
 */ function getDefaultPhysiologicalRanges(gender) {
  return {
    bmi_min: 15.0,
    bmi_max: 45.0,
    waist_range: gender === 'masculine' ? [
      65,
      130
    ] : [
      55,
      120
    ],
    chest_range: gender === 'masculine' ? [
      85,
      140
    ] : [
      75,
      130
    ],
    hips_range: gender === 'masculine' ? [
      80,
      125
    ] : [
      80,
      140
    ]
  };
}
