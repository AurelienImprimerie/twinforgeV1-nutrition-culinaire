/**
 * Request Validation - activity-analyzer
 * Sprint 2 Phase 3.2
 *
 * RÈGLE CRITIQUE: Validation des inputs utilisateur UNIQUEMENT.
 * NE TOUCHE PAS à la logique MET ou aux calculs de calories.
 * NE TOUCHE PAS aux prompts AI.
 */

import {
  validateUserId,
  validateTimestamp
} from '../_shared/validation/index.ts';
import {
  validateTranscription,
  validateActivityDuration,
  validateActivityIntensity,
  validateActivityType,
  validateHeartRateData,
  validateGPSData
} from '../_shared/validation/activities.ts';

/**
 * Validate activity analysis request
 */
export function validateActivityAnalysisRequest(request: any): string | null {
  if (!request) {
    return 'Request body is required';
  }

  const {
    user_id,
    transcription,
    duration_minutes,
    intensity,
    activity_type,
    timestamp,
    heart_rate_data,
    gps_data
  } = request;

  // Validate user_id
  const userIdResult = validateUserId(user_id, { required: true });
  if (!userIdResult.isValid) {
    return userIdResult.error || 'Invalid user ID';
  }

  // Validate transcription (required)
  const transcriptionResult = validateTranscription(transcription);
  if (!transcriptionResult.isValid) {
    return transcriptionResult.error || 'Invalid transcription';
  }

  // Validate duration (optional - AI will infer if needed)
  if (duration_minutes !== undefined && duration_minutes !== null) {
    const durationResult = validateActivityDuration(duration_minutes);
    if (!durationResult.isValid) {
      return durationResult.error || 'Invalid duration';
    }
  }

  // Validate intensity (optional - defaults to medium)
  if (intensity !== undefined) {
    const intensityResult = validateActivityIntensity(intensity);
    if (!intensityResult.isValid) {
      return intensityResult.error || 'Invalid intensity';
    }
  }

  // Validate activity_type (optional - AI will infer)
  if (activity_type !== undefined) {
    const typeResult = validateActivityType(activity_type);
    if (!typeResult.isValid) {
      return typeResult.error || 'Invalid activity type';
    }
  }

  // Validate timestamp (optional)
  if (timestamp !== undefined) {
    const timestampResult = validateTimestamp(timestamp, { required: false });
    if (!timestampResult.isValid) {
      return timestampResult.error || 'Invalid timestamp';
    }
  }

  // Validate heart rate data (optional wearable data)
  if (heart_rate_data !== undefined) {
    const hrResult = validateHeartRateData(heart_rate_data);
    if (!hrResult.isValid) {
      return hrResult.error || 'Invalid heart rate data';
    }
  }

  // Validate GPS data (optional wearable data)
  if (gps_data !== undefined) {
    const gpsResult = validateGPSData(gps_data);
    if (!gpsResult.isValid) {
      return gpsResult.error || 'Invalid GPS data';
    }
  }

  // All validations passed
  return null;
}

/**
 * Sanitize and prepare request data for AI processing
 */
export function sanitizeActivityAnalysisRequest(request: any): {
  user_id: string;
  transcription: string;
  duration_minutes?: number;
  intensity: number;
  activity_type?: string;
  timestamp: string;
  heart_rate_data?: any;
  gps_data?: any;
  weight_kg?: number;
} {
  // Validation should be done first with validateActivityAnalysisRequest()
  const userIdResult = validateUserId(request.user_id, { required: true });
  const transcriptionResult = validateTranscription(request.transcription);

  let sanitizedDuration = undefined;
  if (request.duration_minutes !== undefined && request.duration_minutes !== null) {
    const durationResult = validateActivityDuration(request.duration_minutes);
    sanitizedDuration = durationResult.sanitizedValue as number;
  }

  let sanitizedIntensity = 5; // Default medium
  if (request.intensity !== undefined) {
    const intensityResult = validateActivityIntensity(request.intensity);
    sanitizedIntensity = intensityResult.sanitizedValue as number;
  }

  let sanitizedType = undefined;
  if (request.activity_type !== undefined) {
    const typeResult = validateActivityType(request.activity_type);
    sanitizedType = typeResult.sanitizedValue as string;
  }

  let sanitizedTimestamp = new Date().toISOString();
  if (request.timestamp !== undefined) {
    const timestampResult = validateTimestamp(request.timestamp, { required: false });
    sanitizedTimestamp = timestampResult.sanitizedValue as string;
  }

  let sanitizedHR = undefined;
  if (request.heart_rate_data !== undefined) {
    const hrResult = validateHeartRateData(request.heart_rate_data);
    sanitizedHR = hrResult.sanitizedValue;
  }

  let sanitizedGPS = undefined;
  if (request.gps_data !== undefined) {
    const gpsResult = validateGPSData(request.gps_data);
    sanitizedGPS = gpsResult.sanitizedValue;
  }

  return {
    user_id: userIdResult.sanitizedValue as string,
    transcription: transcriptionResult.sanitizedValue as string,
    duration_minutes: sanitizedDuration,
    intensity: sanitizedIntensity,
    activity_type: sanitizedType,
    timestamp: sanitizedTimestamp,
    heart_rate_data: sanitizedHR,
    gps_data: sanitizedGPS,
    weight_kg: request.weight_kg // Pass through for calorie calculation
  };
}
