/**
 * Audio System Barrel Export
 * Main entry point for the modular audio system
 */

// Core functionality
export { playEnhancedSound } from './core/soundSynthesis';
export { getAudioContext, isAudioContextReady, cleanupAudioContext } from './core/audioContext';

// Sound definitions
export { TWINFORGE_AUDIO_LAYERS } from './definitions/soundLayers';
export type { 
  FeedbackType, 
  AudioPreferences, 
  SoundDefinition, 
  SoundLayer, 
  ADSREnvelope 
} from './definitions/soundTypes';

// Utilities
import { setAudioPreferences, getAudioPreferences, isAudioEnabled } from './utils/accessibility';
import { shouldPlaySound, resetRateLimitState } from './utils/rateLimiting';
import { playSoundLegacy } from './utils/legacyCompat';

// Features

// Sound effects
export * from './effects/interactionSounds';
export * from './effects/statusSounds';
export * from './effects/navigationSounds';
export * from './effects/forgeronSounds';
export * from './effects/spatialEffects';
export * from './effects/gamingSounds';

// Explicit exports for countdown sounds
export { countdownTick, countdownGo } from './effects/statusSounds';

// Audio controls collection
export const TWINFORGE_AUDIO_CONTROLS = {
  setAudioPreferences,
}

// Explicit exports for functions that need to be imported directly
export { getAudioPreferences, setAudioPreferences, isAudioEnabled };
export { playSoundLegacy };