// src/ui/icons/SpatialIcon.tsx
import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Divide as LucideIcon } from 'lucide-react';
import { useOptimizedWillChange } from '../../lib/motion/useOptimizedWillChange';
import { usePreferredMotion, useHasTouch } from '../../system/device/DeviceProvider';
import { usePerformanceMode } from '../../system/context/PerformanceModeContext';
import { designKernel } from '../../styles/designKernel';
import { visionCurves } from '../../lib/motion/gpuVariants';
import { ICONS, IconName } from './registry';

interface SpatialIconProps {
  Icon?: LucideIcon; // rendu optionnel pour éviter le crash si undefined
  name?: IconName; // Alternative: use icon name from registry
  size?: number;
  className?: string;
  animate?: boolean;
  color?: string;
  glowColor?: string;
  variant?: 'default' | 'pure';
  shape?: 'round' | 'square'; // Nouvelle prop pour la forme
  style?: React.CSSProperties;
  // Framer Motion props for direct animation control
  animate?: any;
  transition?: any;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
  'aria-describedby'?: string;
  role?: string;
  tabIndex?: number;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/**
 * Get standardized stroke width based on icon size
 */
function getStrokeWidth(size: number): number {
  if (size <= 24) return 2;
  if (size >= 24) return 2.5;
  return 2;
}

/**
 * Get standardized halo radius based on icon size
 */
function getHaloRadius(size: number): number {
  if (size <= 20) return 8;
  if (size <= 32) return 10;
  if (size <= 48) return 12;
  return 14;
}

const SpatialIcon: React.FC<SpatialIconProps> = ({
  Icon,
  name,
  size = 24,
  className = '',
  animate: animateProp = true,
  color,
  glowColor,
  variant = 'default',
  shape = 'round', // Par défaut, les icônes sont rondes
  style,
  animate: motionAnimate,
  transition: motionTransition,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  'aria-describedby': ariaDescribedBy,
  role,
  tabIndex,
  onClick,
  onKeyDown,
}) => {
  const preferredMotion = usePreferredMotion();
  const hasTouch = useHasTouch();
  const { isPerformanceMode } = usePerformanceMode();
  const iconRef = useRef<HTMLDivElement>(null);

  // Resolve icon from name if provided, otherwise use Icon prop
  const ResolvedIcon = name ? ICONS[name] : Icon;

  // CRITICAL: Désactiver les animations sur mobile et en mode performance
  const shouldAnimate = !preferredMotion && animateProp && window.innerWidth > 768 && !isPerformanceMode;
  
  // TwinForge color system
  const iconColor = color ?? 'var(--text-icon-idle)'; // Default to TwinForge idle color
  const hoverColor = 'var(--text-icon-active)'; // Plasma Cyan for active/hover
  const strokeWidth = getStrokeWidth(size);
  const haloRadius = getHaloRadius(size);

  // will-change optimisé
  const willChangeProps = shouldAnimate && animateProp ? ['transform'] : [];
  useOptimizedWillChange(iconRef, willChangeProps, 100); // Reduced timeout for TwinForge

  const iconVariants = {
    initial: { scale: 1, transition: { duration: 0 } },
    hover: shouldAnimate && !hasTouch
      ? { 
          scale: 1.03, 
          transition: { duration: 0.1, ease: visionCurves.gentle } 
        }
      : {},
    tap: shouldAnimate
      ? { 
          scale: 0.98, 
          transition: { duration: 0.08, ease: visionCurves.smooth } 
        }
      : {},
  };
  
  // TwinForge hover handlers with cyan glow
  const handleMouseEnter = () => {
    if (!shouldAnimate || hasTouch || variant === 'pure' || isPerformanceMode) return;
    
    if (iconRef.current) {
      // TwinForge cyan glow effect - subtle and precise
      const plasmaCyan = getComputedStyle(document.documentElement).getPropertyValue('--color-plasma-cyan').trim() || '#18E3FF';
      iconRef.current.style.filter = `drop-shadow(0 0 ${haloRadius}px ${plasmaCyan}15)`;
      iconRef.current.style.color = hoverColor;
    }
  };
  
  const handleMouseLeave = () => {
    if (!shouldAnimate || hasTouch || variant === 'pure' || isPerformanceMode) return;
    
    if (iconRef.current) {
      iconRef.current.style.filter = '';
      iconRef.current.style.color = iconColor;
    }
  };

  // Keyboard event handler for interactive icons
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Call custom onKeyDown first if provided
    onKeyDown?.(e);
    
    // Default keyboard interaction for clickable icons
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      // console.log('🔊 AUDIO_DEBUG: SpatialIcon keyboard interaction', {
      //   key: e.key,
      //   hasOnClick: !!onClick,
      //   timestamp: new Date().toISOString()
      // });
      onClick();
    }
  };

  // Determine if icon should be interactive
  const isInteractive = !!onClick;
  const shouldHaveTabIndex = isInteractive ? (tabIndex !== undefined ? tabIndex : 0) : undefined;
  
  // CRITICAL FIX: Proper aria-hidden logic to prevent accessibility warnings
  // aria-hidden should ONLY be true for purely decorative icons (no interaction, no label)
  const shouldBeAriaHidden = ariaHidden !== undefined ? ariaHidden : 
    (!isInteractive && !ariaLabel && !role);

  // Conditional styling based on variant
  const containerClassName = variant === 'pure' 
    ? `inline-flex items-center justify-center spatial-icon icon-container ${isInteractive ? 'cursor-pointer focus-ring' : ''} ${window.innerWidth <= 768 ? 'mobile-static-icon' : ''} ${shouldAnimate ? 'will-change-transform-important' : 'will-change-auto-important'} ${className}`
    : `inline-flex items-center justify-center spatial-icon icon-container gpu-only-transform ${isInteractive ? 'cursor-pointer focus-ring' : ''} ${window.innerWidth <= 768 ? 'mobile-static-icon' : ''} ${shouldAnimate ? 'will-change-transform-important' : 'will-change-auto-important'} ${className}`;

  const getBorderRadius = () => {
    if (shape === 'square') {
      // Bordure arrondie légère pour les carrés (environ 15-20% du rayon)
      return `${Math.max(4, size * 0.15)}px`;
    }
    // Complètement rond
    return '50%';
  };

  const containerStyle = variant === 'pure'
    ? {
        transform: 'translateZ(0)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }
    : {
        transform: 'translateZ(0)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        // TwinForge icon container - subtle indigo background
        background: isInteractive ? 'color-mix(in srgb, var(--brand-primary) 8%, transparent)' : 'transparent',
        borderRadius: getBorderRadius(),
        padding: `${Math.max(4, size * 0.15)}px`,
        border: isInteractive ? '1px solid color-mix(in srgb, var(--color-plasma-cyan) 10%, transparent)' : 'none',
      };
  // CRITICAL FIX: Conditional rendering based on performance mode
  // In performance mode: use static div instead of motion.div
  // In quality mode: use motion.div with all animations

  const iconContent = (
    <>
      {/* TwinForge halo effect - disabled in performance mode */}
      {!isPerformanceMode && (variant === 'default' || (variant === 'pure' && glowColor)) && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${glowColor || 'var(--color-plasma-cyan)'} 6%, transparent) 0%, transparent 70%)`,
            opacity: glowColor ? 1.0 : 0,
            transform: `scale(${1 + haloRadius / size})`,
            filter: `blur(${Math.max(2, haloRadius / 4)}px)`,
            borderRadius: getBorderRadius(),
            zIndex: -1
          }}
          ref={(node) => {
            if (node && iconRef.current) {
              (iconRef.current as any)._haloNode = node;
            }
          }}
        />
      )}

      {ResolvedIcon ? (
        <ResolvedIcon
          size={size}
          color={iconColor}
          strokeWidth={strokeWidth}
          style={{
            filter: isPerformanceMode
              ? glowColor
                ? `drop-shadow(0 0 8px ${glowColor}60)`
                : `drop-shadow(0 0 4px ${iconColor}40)`
              : glowColor
                ? `drop-shadow(0 0 12px ${glowColor}80) drop-shadow(0 0 24px ${glowColor}60) drop-shadow(0 0 36px color-mix(in srgb, ${glowColor} 40%, transparent))`
                : variant === 'pure'
                  ? `drop-shadow(0 0 6px ${iconColor}40)`
                  : `drop-shadow(0 1px 2px rgba(0,0,0,0.2))`,
            transition: isPerformanceMode ? 'none' : 'color 200ms ease, filter 200ms ease',
            transform: 'translateZ(0)',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            ...style,
          }}
        />
      ) : (
        <span style={{ fontSize: size, color: iconColor, transform: 'none' }}>⚠️</span>
      )}
    </>
  );

  // Performance mode: static div with no animations
  if (isPerformanceMode) {
    return (
      <div
        ref={iconRef}
        className={containerClassName}
        style={{...containerStyle, ...style}}
        onClick={onClick}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        role={role || (isInteractive ? 'button' : undefined)}
        tabIndex={shouldHaveTabIndex}
        aria-label={ariaLabel}
        aria-hidden={shouldBeAriaHidden}
        aria-describedby={ariaDescribedBy}
        data-performance-mode="static"
      >
        {iconContent}
      </div>
    );
  }

  // Quality mode: motion.div with all animations
  return (
    <motion.div
      ref={iconRef}
      className={containerClassName}
      style={containerStyle}
      variants={iconVariants}
      initial="initial"
      whileHover="hover"
      whileTap={!isInteractive ? {} : shouldAnimate ? {
        scale: 0.98,
        transition: { duration: 0.08, ease: [0.16, 1, 0.3, 1] }
      } : {}}
      animate={motionAnimate}
      transition={motionTransition}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={role || (isInteractive ? 'button' : undefined)}
      tabIndex={shouldHaveTabIndex}
      aria-label={ariaLabel}
      aria-hidden={shouldBeAriaHidden}
      aria-describedby={ariaDescribedBy}
    >
      {iconContent}
    </motion.div>
  );
};

export default SpatialIcon;