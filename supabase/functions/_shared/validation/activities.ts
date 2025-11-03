/**
 * Activities Validation - Sprint 2 Phase 3.2
 *
 * Validation spécifique pour:
 * - activity-analyzer (activity analysis with AI)
 * - activity-transcriber (audio transcription)
 *
 * RÈGLE CRITIQUE: Valider UNIQUEMENT les inputs utilisateur.
 * NE PAS toucher à la logique MET ou aux calculs de calories.
 */

import {
  validateTextInput,
  validateNumber,
  validateTimestamp,
  ValidationResult
} from './index.ts';

/**
 * Validate transcription text from audio
 */
export function validateTranscription(transcription: any): ValidationResult {
  if (!transcription) {
    return { isValid: false, error: 'Transcription is required' };
  }

  // Transcriptions can be long (up to 5000 chars)
  return validateTextInput(transcription, 5000, { required: true });
}

/**
 * Validate activity duration in minutes
 */
export function validateActivityDuration(duration: any): ValidationResult {
  if (duration === null || duration === undefined) {
    return { isValid: false, error: 'Duration is required' };
  }

  return validateNumber(duration, 'duration_minutes', { required: true });
}

/**
 * Validate activity intensity (1-10 scale)
 */
export function validateActivityIntensity(intensity: any): ValidationResult {
  if (!intensity) {
    // Intensity is optional, default to medium (5)
    return { isValid: true, sanitizedValue: 5 };
  }

  return validateNumber(intensity, 'intensity', { required: false });
}

/**
 * Validate activity type (optional, AI will infer if not provided)
 */
export function validateActivityType(activityType: any): ValidationResult {
  if (!activityType) {
    return { isValid: true, sanitizedValue: null };
  }

  // Valid activity types (extensible list)
  const validTypes = [
    // Cardio
    'marche_lente', 'marche_rapide', 'course', 'velo', 'natation', 'rameur',
    'elliptique', 'stepper', 'corde_a_sauter',
    // Musculation
    'musculation', 'crossfit', 'calisthenics', 'powerlifting', 'bodybuilding',
    // Sports
    'football', 'basketball', 'tennis', 'boxe', 'arts_martiaux', 'escalade',
    'yoga', 'pilates', 'danse',
    // Autres
    'autre'
  ];

  if (typeof activityType !== 'string') {
    return { isValid: false, error: 'Activity type must be a string' };
  }

  // AI can infer type, so we don't enforce the list strictly
  // Just sanitize the input
  const sanitized = activityType.toLowerCase().replace(/\s+/g, '_');

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate activity timestamp
 */
export function validateActivityTimestamp(timestamp: any): ValidationResult {
  if (!timestamp) {
    // Default to now if not provided
    return { isValid: true, sanitizedValue: new Date().toISOString() };
  }

  return validateTimestamp(timestamp, { required: false });
}

/**
 * Validate heart rate data (optional wearable data)
 */
export function validateHeartRateData(heartRate: any): ValidationResult {
  if (!heartRate) {
    return { isValid: true, sanitizedValue: null };
  }

  if (typeof heartRate !== 'object') {
    return { isValid: false, error: 'Heart rate data must be an object' };
  }

  const sanitized: any = {};

  // Validate average heart rate
  if (heartRate.average !== undefined) {
    const avgResult = validateNumber(heartRate.average, 'heart_rate_bpm', { required: false });
    if (!avgResult.isValid) {
      return { isValid: false, error: `Average HR: ${avgResult.error}` };
    }
    sanitized.average = avgResult.sanitizedValue;
  }

  // Validate max heart rate
  if (heartRate.max !== undefined) {
    const maxResult = validateNumber(heartRate.max, 'heart_rate_bpm', { required: false });
    if (!maxResult.isValid) {
      return { isValid: false, error: `Max HR: ${maxResult.error}` };
    }
    sanitized.max = maxResult.sanitizedValue;
  }

  // Validate min heart rate
  if (heartRate.min !== undefined) {
    const minResult = validateNumber(heartRate.min, 'heart_rate_bpm', { required: false });
    if (!minResult.isValid) {
      return { isValid: false, error: `Min HR: ${minResult.error}` };
    }
    sanitized.min = minResult.sanitizedValue;
  }

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate GPS data (optional wearable data)
 */
export function validateGPSData(gpsData: any): ValidationResult {
  if (!gpsData) {
    return { isValid: true, sanitizedValue: null };
  }

  if (typeof gpsData !== 'object') {
    return { isValid: false, error: 'GPS data must be an object' };
  }

  const sanitized: any = {};

  // Validate distance (km)
  if (gpsData.distance !== undefined) {
    if (typeof gpsData.distance !== 'number' || gpsData.distance < 0 || gpsData.distance > 500) {
      return { isValid: false, error: 'Distance must be between 0 and 500 km' };
    }
    sanitized.distance = gpsData.distance;
  }

  // Validate elevation gain (meters)
  if (gpsData.elevationGain !== undefined) {
    if (typeof gpsData.elevationGain !== 'number' || gpsData.elevationGain < 0 || gpsData.elevationGain > 10000) {
      return { isValid: false, error: 'Elevation gain must be between 0 and 10000 m' };
    }
    sanitized.elevationGain = gpsData.elevationGain;
  }

  // Validate average pace (min/km)
  if (gpsData.averagePace !== undefined) {
    if (typeof gpsData.averagePace !== 'number' || gpsData.averagePace < 0 || gpsData.averagePace > 30) {
      return { isValid: false, error: 'Average pace must be between 0 and 30 min/km' };
    }
    sanitized.averagePace = gpsData.averagePace;
  }

  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Helper: Validate complete activity analysis request
 * Used by activity-analyzer function
 */
export function validateActivityAnalysisRequest(request: {
  transcription?: any;
  duration_minutes?: any;
  intensity?: any;
  activity_type?: any;
  timestamp?: any;
  heart_rate_data?: any;
  gps_data?: any;
}): {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    transcription: string;
    duration_minutes: number | null;
    intensity: number;
    activity_type: string | null;
    timestamp: string;
    heart_rate_data: any | null;
    gps_data: any | null;
  };
} {
  const errors: string[] = [];

  // Validate transcription
  const transcriptionResult = validateTranscription(request.transcription);
  if (!transcriptionResult.isValid) {
    errors.push(`Transcription: ${transcriptionResult.error}`);
  }

  // Validate duration (optional for AI to infer)
  let durationValue = null;
  if (request.duration_minutes !== undefined && request.duration_minutes !== null) {
    const durationResult = validateActivityDuration(request.duration_minutes);
    if (!durationResult.isValid) {
      errors.push(`Duration: ${durationResult.error}`);
    } else {
      durationValue = durationResult.sanitizedValue as number;
    }
  }

  // Validate intensity
  const intensityResult = validateActivityIntensity(request.intensity);
  if (!intensityResult.isValid) {
    errors.push(`Intensity: ${intensityResult.error}`);
  }

  // Validate activity type
  const typeResult = validateActivityType(request.activity_type);
  if (!typeResult.isValid) {
    errors.push(`Activity type: ${typeResult.error}`);
  }

  // Validate timestamp
  const timestampResult = validateActivityTimestamp(request.timestamp);
  if (!timestampResult.isValid) {
    errors.push(`Timestamp: ${timestampResult.error}`);
  }

  // Validate heart rate data (optional)
  const hrResult = validateHeartRateData(request.heart_rate_data);
  if (!hrResult.isValid) {
    errors.push(`Heart rate data: ${hrResult.error}`);
  }

  // Validate GPS data (optional)
  const gpsResult = validateGPSData(request.gps_data);
  if (!gpsResult.isValid) {
    errors.push(`GPS data: ${gpsResult.error}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      transcription: transcriptionResult.sanitizedValue as string,
      duration_minutes: durationValue,
      intensity: intensityResult.sanitizedValue as number,
      activity_type: typeResult.sanitizedValue as string | null,
      timestamp: timestampResult.sanitizedValue as string,
      heart_rate_data: hrResult.sanitizedValue,
      gps_data: gpsResult.sanitizedValue
    }
  };
}
