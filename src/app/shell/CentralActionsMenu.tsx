// src/app/components/CentralActionsMenu.tsx
import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SpatialIcon from '../../ui/icons/SpatialIcon';
import { ICONS } from '../../ui/icons/registry';
import { useFeedback, useHideFastingForBulking } from '../../hooks';
import { forgeStrike, tileClick, pillClick, homeClick, panelClose } from '../../audio/effects/forgeronSounds';
import { useOverlayStore, Z_INDEX } from '../../system/store/overlayStore';
import { QUICK_ACTION_SECTIONS, type QuickAction } from '../../config/quickActionsConfig';
import logger from '../../lib/utils/logger';

/* Utils */
function hexToRgbArray(hex: string): [number, number, number] {
  const h = (hex || '#999999').replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

/** Sélection de section par clé */
function getSection(
  sections: { key?: string; title: string; actions: QuickAction[] }[],
  key: string
) {
  return sections.find((s) => s.key === key) || { title: '', actions: [] };
}

interface CentralActionsMenuProps {
  isOpen: boolean;
  onClose: () => void; // conservé pour compatibilité
}

/**
 * CentralActionsMenu - Version simplifiée
 * Trois catégories: Alimentation, Activité, Santé
 * Tous les boutons sont des pills (petits boutons) 2x2
 */
const CentralActionsMenu: React.FC<CentralActionsMenuProps> = ({ isOpen }) => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { click, success } = useFeedback();
  const { close: closeOverlay } = useOverlayStore();
  const hideFastingForBulking = useHideFastingForBulking();

  // Récupération des sections par clé
  const nutritionSection = getSection(QUICK_ACTION_SECTIONS, 'nutrition');
  const cuisineSection = getSection(QUICK_ACTION_SECTIONS, 'cuisine');
  const activiteSection = getSection(QUICK_ACTION_SECTIONS, 'activite');
  const santeSection = getSection(QUICK_ACTION_SECTIONS, 'sante');
  const homeSection = getSection(QUICK_ACTION_SECTIONS, 'navigation');
  const mainActionsSection = getSection(QUICK_ACTION_SECTIONS, 'main-actions');

  // Filtrer la section Santé pour masquer le jeûne si prise de masse
  const filteredSanteSection = React.useMemo(() => {
    if (!hideFastingForBulking) return santeSection;
    return {
      ...santeSection,
      actions: santeSection.actions.filter(action => action.id !== 'start-fasting')
    };
  }, [santeSection, hideFastingForBulking]);

  const homeAction =
    homeSection.actions.find(
      (a) =>
        ['home', 'dashboard', 'root'].includes(a.id) ||
        /accueil|home|cœur|coeur|coeur de la forge|forge/i.test(a.label)
    ) || null;

  const handleActionClick = (action: QuickAction, isTile: boolean = false, event?: React.MouseEvent) => {
    if (!action?.available || action?.comingSoon) {
      logger.warn('CENTRAL_ACTIONS', 'Action not available', { actionId: action?.id, comingSoon: action?.comingSoon });
      return;
    }

    logger.info('CENTRAL_ACTIONS', 'Action clicked', {
      actionId: action.id,
      actionLabel: action.label,
      route: action.route,
      hasEvent: !!event
    });

    // Play appropriate sound based on action type
    if (action.id === 'home') {
      homeClick();
    } else if (isTile) {
      tileClick(action.color);
    } else {
      pillClick(action.color);
    }

    // Close overlay first for immediate feedback
    closeOverlay();

    // Then handle navigation or custom action
    if (action.route) {
      logger.info('CENTRAL_ACTIONS', 'Navigating to route', {
        actionId: action.id,
        actionLabel: action.label,
        route: action.route,
        timestamp: new Date().toISOString(),
      });

      // Use setTimeout to ensure overlay closes before navigation
      setTimeout(() => {
        logger.info('CENTRAL_ACTIONS', 'Executing navigation', { route: action.route });
        navigate(action.route!);
      }, 100);
    } else if (typeof action.onClick === 'function') {
      action.onClick();
    }
  };

  /** Play opening sound */
  React.useEffect(() => {
    if (isOpen) {
      forgeStrike();
    } else {
      panelClose();
    }
  }, [isOpen]);

  /** Fermer au clic extérieur & ESC */
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      // Ignore if clicking on action buttons inside the menu
      const target = e.target as HTMLElement;
      if (target.closest('button[role="menuitem"]')) {
        return;
      }

      const centralButtons = document.querySelectorAll('.central-action-button, .user-panel-toggle');
      const actionMenu = document.querySelector('.central-actions-menu');

      let clickedOnToggle = false;
      centralButtons.forEach(btn => {
        if (btn.contains(e.target as Node)) {
          clickedOnToggle = true;
        }
      });

      if (!clickedOnToggle && actionMenu && !actionMenu.contains(e.target as Node)) {
        closeOverlay();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOverlay]);

  const springy = reduceMotion
    ? { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as any }
    : { type: 'spring' as const, stiffness: 280, damping: 22, mass: 0.9 };

  /** Boutons d'action (pills) - HARMONISÉ avec système icon-container */
  const SecondaryPill: React.FC<{ action: QuickAction; index: number }> = ({ action, index }) => {
    const isComingSoon = action.comingSoon || !action.available;

    return (
      <motion.button
        key={action.id}
        onClick={(e) => handleActionClick(action, false, e)}
        disabled={isComingSoon}
        className="glass-card rounded-xl px-2 py-1.5 flex items-center gap-1.5 w-full"
        style={{
          // Variable CSS pour la couleur de circuit dynamique
          '--pill-circuit-color': action.color || '#18E3FF',
          opacity: isComingSoon ? 0.5 : 1,
          cursor: isComingSoon ? 'not-allowed' : 'pointer',
          position: 'relative',
          isolation: 'isolate'
        } as React.CSSProperties}
        initial={{ opacity: isComingSoon ? 0.5 : 1, y: 0 }}
        animate={{ opacity: isComingSoon ? 0.5 : 1, y: 0 }}
        transition={{ duration: 0 }}
        role="menuitem"
        aria-label={action.description || action.label}
        aria-disabled={isComingSoon}
      >
        {/* Icon container harmonisé - géré par CSS avec --pill-circuit-color */}
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ position: 'relative' }}>
          <SpatialIcon Icon={ICONS[action.icon]} size={13} />
          {isComingSoon && (
            <div
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.95), rgba(251, 113, 133, 0.95))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '7px',
                fontWeight: 'bold',
                color: 'white',
                boxShadow: '0 2px 8px rgba(251, 146, 60, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                zIndex: 20,
                pointerEvents: 'none',
                border: '1.5px solid rgba(255, 255, 255, 0.4)'
              }}
            >
              S
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[11px] font-semibold text-white leading-tight break-words">
            {action.label}
          </div>
          {action.subtitle && (
            <div className="text-[9px] text-white/65 leading-tight mt-0.5 break-words">
              {action.subtitle}
            </div>
          )}
        </div>
      </motion.button>
    );
  };

  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
  const isDesktop = window.innerWidth >= 1024;

  // Animation variants: COMPLÈTEMENT désactivées - apparition instantanée
  const animationVariants = {
    initial: {
      opacity: 1,
      scale: 1,
      y: 0
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0,
        ease: [0.25, 0.1, 0.25, 1]
      }
    },
    exit: {
      opacity: 0,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="central-actions-menu fixed"
          style={{
            zIndex: Z_INDEX.CENTRAL_MENU,
            transformOrigin: 'top center',
            overflow: 'visible',
            // Dynamic positioning based on device - all open from top (header)
            ...(isMobile ? {
              top: '80px',
              left: '8px',
              right: '8px',
              width: 'auto',
              maxHeight: 'calc(100vh - 96px - var(--new-bottom-bar-height) - var(--new-bottom-bar-bottom-offset))'
            } : isTablet ? {
              top: '80px',
              left: '16px',
              right: '16px',
              width: 'auto',
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 120px - var(--new-bottom-bar-height) - var(--new-bottom-bar-bottom-offset))'
            } : {
              top: '80px',
              right: '24px',
              left: 'auto',
              width: '400px',
              maxHeight: 'calc(100vh - 120px)'
            })
          }}
          initial={animationVariants.initial}
          animate={animationVariants.animate}
          exit={animationVariants.exit}
          role="dialog"
          aria-label="Actions rapides"
          aria-modal="true"
        >
          {/* PANEL - Ultra-transparent Liquid Glass - UNIFIED APPEARANCE */}
          <div
            className="rounded-3xl overflow-hidden relative central-actions-panel liquid-glass-premium max-h-[inherit]"
            style={{
              padding: 12,
              isolation: 'isolate',
              opacity: 1,
              willChange: 'transform, opacity'
            }}
          >
            {/* Inner scroll container */}
            <div className="central-actions-scroll-container"
              style={{
                maxHeight: 'inherit',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
            {/* HEADER */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-[3px] w-1 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)',
                    boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)'
                  }}
                  aria-hidden
                />
                <span className="text-white text-sm font-bold tracking-wider uppercase">
                  Outils du Forgeron
                </span>
              </div>

              {homeAction && (
                <button
                  onClick={(e) => handleActionClick(homeAction, false, e)}
                  className="glass-card rounded-full px-2.5 py-1 flex items-center gap-1.5"
                  style={{
                    background: `
                      radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18) 0%, transparent 60%),
                      radial-gradient(circle at 70% 70%, rgba(247, 147, 30, 0.15) 0%, transparent 65%),
                      var(--liquid-pill-bg)
                    `,
                    border: '1px solid rgba(247, 147, 30, 0.35)',
                    boxShadow: `
                      0 2px 8px rgba(247, 147, 30, 0.15),
                      0 0 16px rgba(247, 147, 30, 0.08),
                      inset 0 1px 0 rgba(255, 255, 255, 0.15)
                    `
                  }}
                >
                  <SpatialIcon
                    Icon={ICONS.Home}
                    size={13}
                    style={{
                      color: '#FDC830',
                      filter: 'drop-shadow(0 0 4px rgba(253, 200, 48, 0.5))'
                    }}
                  />
                  <span className="text-[10px] font-semibold" style={{
                    color: 'rgba(255, 255, 255, 0.95)',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                  }}>Dashboard</span>
                </button>
              )}
            </div>

            {/* ========== CATÉGORIE: NUTRITION ========== */}
            {nutritionSection.actions.length > 0 && (
              <div className="mb-3">
                <div className="px-1.5 mb-1.5">
                  <h3 className="text-white/70 text-[11px] uppercase tracking-wider font-bold">
                    Nutrition
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {nutritionSection.actions.map((a, i) => (
                    <SecondaryPill key={a.id} action={a} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* ========== CATÉGORIE: CUISINE ========== */}
            {cuisineSection.actions.length > 0 && (
              <div className="mb-3">
                <div className="px-1.5 mb-1.5">
                  <h3 className="text-white/70 text-[11px] uppercase tracking-wider font-bold">
                    Cuisine
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {cuisineSection.actions.map((a, i) => (
                    <SecondaryPill key={a.id} action={a} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* ========== CATÉGORIE: ACTIVITÉ ========== */}
            {activiteSection.actions.length > 0 && (
              <div className="mb-3">
                <div className="px-1.5 mb-1.5">
                  <h3 className="text-white/70 text-[11px] uppercase tracking-wider font-bold">
                    Activité
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {activiteSection.actions.map((a, i) => (
                    <SecondaryPill key={a.id} action={a} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* ========== CATÉGORIE: SANTÉ ========== */}
            {filteredSanteSection.actions.length > 0 && (
              <div className="mb-3">
                <div className="px-1.5 mb-1.5">
                  <h3 className="text-white/70 text-[11px] uppercase tracking-wider font-bold">
                    Santé
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredSanteSection.actions.map((a, i) => (
                    <SecondaryPill key={a.id} action={a} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* ========== BOUTONS PRINCIPAUX: AVATAR ET TRAINING EN 2x2 ========== */}
            {mainActionsSection.actions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-1.5">
                  {mainActionsSection.actions.map((action, index) => {
                    const [r, g, b] = hexToRgbArray(action.color || '#D946EF');
                    return (
                      <motion.button
                        key={action.id}
                        onClick={(e) => handleActionClick(action, true, e)}
                        className="glass-card rounded-xl px-2 py-3 flex flex-col items-center gap-2 w-full main-action-button"
                        style={{
                          background: `
                            radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.12) 0%, transparent 60%),
                            radial-gradient(circle at 70% 70%, rgba(${r}, ${g}, ${b}, 0.15) 0%, transparent 65%),
                            rgba(255, 255, 255, 0.03)
                          `,
                          backdropFilter: 'blur(20px) saturate(150%)',
                          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                          border: `1px solid rgba(${r}, ${g}, ${b}, 0.4)`,
                          boxShadow: `
                            0 4px 16px rgba(${r}, ${g}, ${b}, 0.25),
                            0 0 24px rgba(${r}, ${g}, ${b}, 0.15),
                            inset 0 1px 0 rgba(255, 255, 255, 0.2)
                          `
                        }}
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0 }}
                        role="menuitem"
                        aria-label={action.description || action.label}
                      >
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.4), rgba(${r}, ${g}, ${b}, 0.25))`,
                            border: `1px solid rgba(${r}, ${g}, ${b}, 0.5)`,
                            boxShadow: `0 0 12px rgba(${r}, ${g}, ${b}, 0.3)`
                          }}
                        >
                          <SpatialIcon
                            Icon={ICONS[action.icon]}
                            size={22}
                            style={{
                              color: action.color,
                              filter: `drop-shadow(0 0 6px rgba(${r}, ${g}, ${b}, 0.6))`
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <div className="text-[11px] font-bold text-white leading-tight">
                            {action.label}
                          </div>
                          <div className="text-[9px] text-white/75 leading-tight mt-0.5">
                            {action.subtitle}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CentralActionsMenu;