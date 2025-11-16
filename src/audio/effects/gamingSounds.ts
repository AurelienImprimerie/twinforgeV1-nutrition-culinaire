/**
 * Gaming Sounds - Audio feedback for gamification system
 * Sounds for XP, streaks, combos, and achievements
 */

import { playEnhancedSound } from '../core/soundSynthesis';
import { shouldPlaySound } from '../utils/rateLimiting';
import { isAudioEnabled, applyAccessibilityMods, addPitchVariance } from '../utils/accessibility';
import type { SoundDefinition } from '../definitions/soundTypes';
import { Haptics } from '../../utils/haptics';
import { addSpatialReverb } from './spatialEffects';

/**
 * Play enhanced sound with rate limiting and accessibility checks
 */
function playGamingSound(soundDef: SoundDefinition, soundType: 'click' | 'navigation' = 'click', soundId?: string): void {
  if (!isAudioEnabled() || !shouldPlaySound(soundType, soundId)) {
    return;
  }

  const finalSoundDef = applyAccessibilityMods(soundDef);
  playEnhancedSound(finalSoundDef, soundType, soundId);
}

/**
 * Action Completed - When user completes a daily action
 * @param category - Type of action (daily, progression, tracking)
 * @param isFirstTime - Is this the first time completing today
 */
export function actionCompleted(category: 'daily' | 'progression' | 'tracking', isFirstTime: boolean = true) {
  const intensityMultiplier = isFirstTime ? 1.2 : 0.8;

  const soundDef: SoundDefinition = {
    layers: [
      {
        frequency: addPitchVariance(523.25), // C5
        waveform: 'sine',
        adsr: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.25 },
        gain: 0.35 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(659.25), // E5
        waveform: 'sine',
        adsr: { attack: 0.015, decay: 0.18, sustain: 0.18, release: 0.28 },
        gain: 0.25 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(783.99), // G5
        waveform: 'sine',
        adsr: { attack: 0.02, decay: 0.2, sustain: 0.15, release: 0.3 },
        gain: 0.18 * intensityMultiplier
      }
    ],
    masterGain: 1.1
  };

  const spatialSound = addSpatialReverb(soundDef, 0.6);
  playGamingSound(spatialSound, 'click', `action-${category}`);

  if (isFirstTime) {
    Haptics.impact();
  } else {
    Haptics.press();
  }
}

/**
 * Combo Activated - Multiple actions completed in sequence
 * @param comboCount - Number of actions in the combo
 */
export function comboActivated(comboCount: number) {
  const intensityMultiplier = Math.min(1.5, 1.0 + (comboCount * 0.1));

  const soundDef: SoundDefinition = {
    layers: [
      {
        frequency: addPitchVariance(659.25), // E5
        waveform: 'sine',
        adsr: { attack: 0.008, decay: 0.12, sustain: 0.25, release: 0.22 },
        gain: 0.4 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(783.99), // G5
        waveform: 'sine',
        adsr: { attack: 0.012, decay: 0.15, sustain: 0.22, release: 0.25 },
        gain: 0.3 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(987.77), // B5
        waveform: 'sine',
        adsr: { attack: 0.015, decay: 0.18, sustain: 0.2, release: 0.28 },
        gain: 0.22 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(1318.51), // E6
        waveform: 'sine',
        adsr: { attack: 0.02, decay: 0.2, sustain: 0.18, release: 0.3 },
        gain: 0.15 * intensityMultiplier
      }
    ],
    masterGain: 1.3
  };

  const spatialSound = addSpatialReverb(soundDef, 1.0);
  playGamingSound(spatialSound, 'click', `combo-${comboCount}`);
  Haptics.impact();
}

/**
 * Perfect Day - All daily actions completed
 * Triumphant, celebratory sound
 */
export function perfectDay() {
  const soundDef: SoundDefinition = {
    layers: [
      {
        frequency: addPitchVariance(523.25), // C5
        waveform: 'sine',
        adsr: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
        gain: 0.4
      },
      {
        frequency: addPitchVariance(659.25), // E5
        waveform: 'sine',
        adsr: { attack: 0.015, decay: 0.22, sustain: 0.28, release: 0.42 },
        gain: 0.35
      },
      {
        frequency: addPitchVariance(783.99), // G5
        waveform: 'sine',
        adsr: { attack: 0.02, decay: 0.25, sustain: 0.25, release: 0.45 },
        gain: 0.3
      },
      {
        frequency: addPitchVariance(1046.50), // C6
        waveform: 'sine',
        adsr: { attack: 0.025, decay: 0.28, sustain: 0.22, release: 0.48 },
        gain: 0.25
      },
      {
        frequency: addPitchVariance(1318.51), // E6
        waveform: 'sine',
        adsr: { attack: 0.03, decay: 0.3, sustain: 0.2, release: 0.5 },
        gain: 0.18
      }
    ],
    masterGain: 1.5
  };

  const spatialSound = addSpatialReverb(soundDef, 1.5);
  playGamingSound(spatialSound, 'click', 'perfect-day');
  Haptics.impact();
}

/**
 * Streak Milestone - Reaching a streak milestone (7, 14, 30 days)
 * @param days - Number of consecutive days
 */
export function streakMilestone(days: number) {
  const intensityMultiplier = Math.min(2.0, 1.0 + (days / 30));

  const soundDef: SoundDefinition = {
    layers: [
      {
        frequency: addPitchVariance(440.00), // A4
        waveform: 'sine',
        adsr: { attack: 0.015, decay: 0.25, sustain: 0.35, release: 0.5 },
        gain: 0.45 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(554.37), // C#5
        waveform: 'sine',
        adsr: { attack: 0.02, decay: 0.28, sustain: 0.32, release: 0.52 },
        gain: 0.38 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(659.25), // E5
        waveform: 'sine',
        adsr: { attack: 0.025, decay: 0.3, sustain: 0.3, release: 0.55 },
        gain: 0.32 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(880.00), // A5
        waveform: 'sine',
        adsr: { attack: 0.03, decay: 0.32, sustain: 0.28, release: 0.58 },
        gain: 0.25 * intensityMultiplier
      }
    ],
    masterGain: 1.6
  };

  const spatialSound = addSpatialReverb(soundDef, 1.8);
  playGamingSound(spatialSound, 'click', `streak-${days}`);
  Haptics.impact();
}

/**
 * XP Gained - Generic XP gain sound
 * @param amount - Amount of XP gained
 */
export function xpGained(amount: number) {
  const intensityMultiplier = Math.min(1.5, 1.0 + (amount / 100));

  const soundDef: SoundDefinition = {
    layers: [
      {
        frequency: addPitchVariance(659.25), // E5
        waveform: 'sine',
        adsr: { attack: 0.008, decay: 0.12, sustain: 0.18, release: 0.2 },
        gain: 0.3 * intensityMultiplier
      },
      {
        frequency: addPitchVariance(783.99), // G5
        waveform: 'sine',
        adsr: { attack: 0.012, decay: 0.15, sustain: 0.15, release: 0.22 },
        gain: 0.22 * intensityMultiplier
      }
    ],
    masterGain: 1.0
  };

  const spatialSound = addSpatialReverb(soundDef, 0.5);
  playGamingSound(spatialSound, 'click', 'xp-gained');
  Haptics.selection();
}

/**
 * Level Up - User gains a new level
 */
export function levelUp() {
  const soundDef: SoundDefinition = {
    layers: [
      {
        frequency: addPitchVariance(523.25), // C5
        waveform: 'sine',
        adsr: { attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.35 },
        gain: 0.42
      },
      {
        frequency: addPitchVariance(659.25), // E5
        waveform: 'sine',
        adsr: { attack: 0.015, decay: 0.2, sustain: 0.28, release: 0.38 },
        gain: 0.35
      },
      {
        frequency: addPitchVariance(783.99), // G5
        waveform: 'sine',
        adsr: { attack: 0.02, decay: 0.22, sustain: 0.25, release: 0.4 },
        gain: 0.3
      },
      {
        frequency: addPitchVariance(1046.50), // C6
        waveform: 'sine',
        adsr: { attack: 0.025, decay: 0.25, sustain: 0.22, release: 0.45 },
        gain: 0.25
      }
    ],
    masterGain: 1.4
  };

  const spatialSound = addSpatialReverb(soundDef, 1.2);
  playGamingSound(spatialSound, 'click', 'level-up');
  Haptics.impact();
}

/**
 * Weight Update Success - Successfully updating weight
 */
export function weightUpdateSuccess() {
  const soundDef: SoundDefinition = {
    layers: [
      {
        frequency: addPitchVariance(523.25), // C5
        waveform: 'sine',
        adsr: { attack: 0.01, decay: 0.15, sustain: 0.22, release: 0.28 },
        gain: 0.35
      },
      {
        frequency: addPitchVariance(659.25), // E5
        waveform: 'sine',
        adsr: { attack: 0.015, decay: 0.18, sustain: 0.2, release: 0.3 },
        gain: 0.28
      },
      {
        frequency: addPitchVariance(783.99), // G5
        waveform: 'sine',
        adsr: { attack: 0.02, decay: 0.2, sustain: 0.18, release: 0.32 },
        gain: 0.22
      }
    ],
    masterGain: 1.1
  };

  const spatialSound = addSpatialReverb(soundDef, 0.7);
  playGamingSound(spatialSound, 'click', 'weight-update');
  Haptics.press();
}

/**
 * Export all gaming sounds
 */
export const GamingSounds = {
  actionCompleted,
  comboActivated,
  perfectDay,
  streakMilestone,
  xpGained,
  levelUp,
  weightUpdateSuccess,
};
