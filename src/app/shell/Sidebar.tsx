import React, { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Link } from '../nav/Link';
import { ICONS } from '../../ui/icons/registry';
import SpatialIcon from '../../ui/icons/SpatialIcon';
import { getCircuitColor } from '../../ui/theme/circuits';
import { navFor } from './navigation';
import { useFeedback, useHideFastingForBulking } from '@/hooks';
import logger from '../../lib/utils/logger';
import TokenBalanceWidget from './TokenBalanceWidget';
import LogoutConfirmationModal from '../../ui/components/LogoutConfirmationModal';
import { LogoutService } from '../../system/services/logoutService';

interface NavSubItem {
  to: string;
  icon: keyof typeof ICONS;
  label: string;
  isPrimarySubMenu?: boolean;
  color?: string; // Couleur personnalisée pour ce sous-item
}

interface NavItemProps {
  to: string;
  icon: keyof typeof ICONS;
  label: string;
  subtitle: string;
  actionLabel?: string;
  isPrimary?: boolean;
  isTwin?: boolean;
  isForge?: boolean;
  isActive?: boolean;
  circuitColor?: string;
  tabs?: string[];
  subItems?: NavSubItem[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const NavItem = React.memo(({
  to,
  icon,
  label,
  subtitle,
  actionLabel,
  isPrimary = false,
  isTwin = false,
  isForge = false,
  isActive,
  circuitColor,
  tabs,
  subItems,
  isExpanded,
  onToggleExpand
}: NavItemProps) => {
  const location = useLocation();
  const Icon = ICONS[icon];
  const itemColor = circuitColor || getCircuitColor(to);
  const { sidebarClick } = useFeedback();
  const hasSubItems = subItems && subItems.length > 0;

  const handleNavItemClick = (e: React.MouseEvent) => {
    logger.trace('SIDEBAR', 'NavItem click captured', { to, label, isActive });
    logger.trace('SIDEBAR', 'NavItem click triggered', { to, label, currentPath: window.location.pathname });

    // Si l'item a des sous-menus, toggle l'expansion au lieu de naviguer
    if (hasSubItems) {
      e.preventDefault();
      if (onToggleExpand) {
        onToggleExpand();
        sidebarClick();
      }
    }
  };

  // Check if any sub-item is active (but not for applying background, only for icon color)
  const hasActiveSubItem = hasSubItems && subItems.some(subItem => {
    const subPath = subItem.to.split('#')[0];
    const subHash = subItem.to.split('#')[1];
    const currentPath = location.pathname;
    const currentHash = location.hash.replace('#', '') || 'daily';
    return currentPath === subPath && (!subHash || currentHash === subHash);
  });

  // Check if we're on the exact main page (for background styling)
  const isOnMainPage = location.pathname === to;

  // Déterminer la classe CSS en fonction du type
  let itemClass = 'sidebar-item';
  if (isPrimary) {
    itemClass = 'sidebar-item sidebar-item--primary';
  } else if (isTwin) {
    itemClass = 'sidebar-item sidebar-item--twin';
  } else if (isForge) {
    itemClass = 'sidebar-item sidebar-item--forge';
  }

  return (
    <div className="relative sidebar-nav-item-container">
      <Link
        to={to}
        className={`
          ${itemClass}
          ${hasSubItems ? 'sidebar-item--with-submenu' : ''}
          group focus-ring
          ${isActive || hasActiveSubItem
            ? 'text-white shadow-sm'
            : 'text-white/70 hover:text-white'
          }
        `}
        onClick={handleNavItemClick}
        onPointerDown={(e) => {
          logger.trace('SIDEBAR', 'NavItem pointer down', { to, label });
        }}
        onMouseDown={(e) => {
          logger.trace('SIDEBAR', 'NavItem mouse down', { to, label });
        }}
        aria-current={isActive ? 'page' : undefined}
        aria-expanded={hasSubItems ? isExpanded : undefined}
        aria-label={`${label} - ${subtitle}`}
        role={isPrimary ? 'link' : 'menuitem'}
        style={{ '--item-circuit-color': itemColor } as React.CSSProperties}
      >
        {/* Icon container with glass pill effect - background only when on exact page */}
        <div className={`sidebar-item-icon-container ${isActive ? 'sidebar-item-icon-container--active' : ''}`}>
          <SpatialIcon
            Icon={Icon}
            size={isPrimary ? 22 : isTwin ? 20 : 18}
            className={`sidebar-item-icon ${isActive || hasActiveSubItem ? '' : 'opacity-80 group-hover:opacity-100'}`}
            color={isActive || hasActiveSubItem ? itemColor : undefined}
            style={isActive || hasActiveSubItem ? {
              color: itemColor,
              filter: `drop-shadow(0 0 8px ${itemColor}60)`
            } : undefined}
          />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className={`sidebar-item-label font-medium ${
            isPrimary ? 'text-base' : isTwin ? 'text-sm' : 'text-xs'
          } truncate ${
            isActive || hasActiveSubItem ? 'text-white' : 'text-white/82'
          }`}>
            {label}
          </div>
          <div className={`sidebar-item-subtitle text-xxs truncate ${isPrimary ? 'mt-0.5' : 'mt-0'} ${
            isActive || hasActiveSubItem ? 'text-white/70' : 'text-white/50'
          }`}>
            {subtitle}
          </div>
        </div>

        {/* Badge d'action uniquement pour les forges sans sous-menus */}
        {isForge && actionLabel && !hasSubItems && (
          <div
            className={`sidebar-item-action-badge ${isActive ? 'sidebar-item-action-badge--active' : ''}`}
          >
            {actionLabel}
          </div>
        )}
      </Link>

      {/* Sub-items menu */}
      {hasSubItems && (
        <div
          className={`sidebar-submenu ${isExpanded ? 'sidebar-submenu--expanded' : ''}`}
          role="group"
          aria-label={`Sous-menu ${label}`}
        >
          <div className="sidebar-submenu-inner">
            {subItems.map((subItem) => {
              const SubIcon = ICONS[subItem.icon];
              const subPath = subItem.to.split('#')[0];
              const subHash = subItem.to.split('#')[1];
              const currentPath = location.pathname;
              const currentHash = location.hash.replace('#', '') || 'daily';
              const isSubActive = currentPath === subPath && (!subHash || currentHash === subHash);

              // Le bouton primaire (Scanner/Tracker) est toujours lumineux si on est sur cette page
              const isPrimaryAndPageActive = subItem.isPrimarySubMenu && currentPath === subPath;

              return (
                <Link
                  key={subItem.to}
                  to={subItem.to}
                  className={`
                    sidebar-submenu-item
                    ${subItem.isPrimarySubMenu ? 'sidebar-submenu-item--primary' : 'sidebar-submenu-item--secondary'}
                    ${isSubActive || isPrimaryAndPageActive ? 'sidebar-submenu-item--active' : ''}
                    focus-ring
                  `}
                  onClick={() => sidebarClick()}
                  aria-current={isSubActive ? 'page' : undefined}
                  style={{ '--item-circuit-color': subItem.color || itemColor } as React.CSSProperties}
                >
                  <div className={`sidebar-submenu-item-icon-container ${isSubActive || isPrimaryAndPageActive ? 'sidebar-submenu-item-icon-container--active' : ''}`}>
                    <SpatialIcon
                      Icon={SubIcon}
                      size={subItem.isPrimarySubMenu ? 16 : 14}
                      className="sidebar-submenu-item-icon"
                    />
                  </div>
                  <span className="sidebar-submenu-item-label">
                    {subItem.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
NavItem.displayName = 'NavItem';

const Section = ({
  title,
  type,
  children,
  isLastCategory
}: {
  title: string;
  type?: 'primary' | 'twin' | 'forge-category';
  children: React.ReactNode;
  isLastCategory?: boolean;
}) => {
  // Pas d'espacement avant pour primary et twin (premières sections)
  const shouldHaveTopSpace = type === 'forge-category';
  const needsSeparator = title === 'Alimentation' || title === 'Activité' || title === 'Santé';

  return (
    <div className={`space-y-1 ${shouldHaveTopSpace ? 'mt-4' : ''}`}>
      {title && (
        <>
          {/* Séparateur visuel avant Alimentation, Activité et Santé */}
          {needsSeparator && (
            <div className="sidebar-category-separator" />
          )}
          <h3
            className={`sidebar-section-title ${getSectionClass(title, type)}`}
            role="heading"
            aria-level="3"
          >
            {title}
          </h3>
        </>
      )}
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
};

/**
 * Get section-specific CSS class for visual differentiation
 */
function getSectionClass(title: string, type?: string): string {
  if (type === 'forge-category') {
    return 'sidebar-section--forge-category';
  }

  // Classes legacy pour compatibilité
  switch (title) {
    case 'Rituels du Forgeron':
      return 'sidebar-section--daily-tracking';
    case 'Ateliers du Forgeron':
      return 'sidebar-section--forge-tools';
    case 'Mon Profil':
      return 'sidebar-section--profile';
    default:
      return '';
  }
}

const Sidebar = React.memo(({ className = '' }: { className?: string }) => {
  const location = useLocation();
  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);
  const hideFastingForBulking = useHideFastingForBulking();

  const [expandedForges, setExpandedForges] = useState<Record<string, boolean>>({});
  const [activeForge, setActiveForge] = useState<string | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const navigation = navFor();

  // Filtrer la navigation pour masquer la Forge du Temps si prise de masse
  const filteredNavigation = React.useMemo(() => {
    return navigation.map(section => {
      // Si c'est la section Santé, filtrer la Forge du Temps
      if (section.title === 'Santé' && hideFastingForBulking) {
        return {
          ...section,
          items: section.items.filter(item => item.to !== '/fasting')
        };
      }
      return section;
    });
  }, [navigation, hideFastingForBulking]);

  const handleLogoutClick = useCallback(() => {
    logger.info('SIDEBAR', 'Logout button clicked');
    setIsLogoutModalOpen(true);
  }, []);

  const handleLogoutConfirm = useCallback(async () => {
    logger.info('SIDEBAR', 'Logout confirmed');
    await LogoutService.softLogout();
  }, []);

  const handleLogoutCancel = useCallback(() => {
    logger.info('SIDEBAR', 'Logout cancelled');
    setIsLogoutModalOpen(false);
  }, []);

  // Auto-expand menu if user is on a sub-page and close others
  React.useEffect(() => {
    const currentPath = location.pathname;
    let newActiveForge: string | null = null;
    const newExpandedState: Record<string, boolean> = {};

    filteredNavigation.forEach(section => {
      section.items.forEach(item => {
        if (item.subItems && item.subItems.length > 0) {
          const hasActiveSubItem = item.subItems.some(subItem => {
            const subPath = subItem.to.split('#')[0];
            return currentPath === subPath;
          });

          // If this item has an active sub-item, expand it and mark as active
          if (hasActiveSubItem) {
            newExpandedState[item.to] = true;
            newActiveForge = item.to;
          } else {
            // Close all other items
            newExpandedState[item.to] = false;
          }
        }
      });
    });

    // Update states
    setExpandedForges(newExpandedState);
    setActiveForge(newActiveForge);
  }, [location.pathname, filteredNavigation]);

  // Log sidebar render
  React.useEffect(() => {
    logger.trace('SIDEBAR', 'Component rendered', { currentPath: location.pathname });
  }, [location.pathname]);

  // Handle toggle expand for forge items with auto-close others
  const handleToggleExpand = useCallback((itemTo: string) => {
    setExpandedForges(prev => {
      const isCurrentlyExpanded = prev[itemTo];

      // If closing the current item, just toggle it
      if (isCurrentlyExpanded) {
        return {
          ...prev,
          [itemTo]: false
        };
      }

      // If opening, close all others and open this one
      const newState: Record<string, boolean> = {};
      Object.keys(prev).forEach(key => {
        newState[key] = false;
      });
      newState[itemTo] = true;

      setActiveForge(itemTo);
      return newState;
    });
  }, []);

  return (
    <aside
      className={`hidden lg:flex flex-col ${className}
        sticky top-[88px] left-0
        h-[calc(100dvh-104px)]
        w-full
        sidebar-glass-enhanced rounded-2xl visionos-grid
      `}
      role="complementary"
      aria-label="Main navigation"
    >
      <div className="sidebar-content space-y-2 flex-1 pt-2">

        {/* Navigation Dynamique avec 3 Niveaux Hiérarchiques + Sous-menus */}
        {filteredNavigation.map((section, sectionIndex) => (
          <React.Fragment key={section.title || section.type}>
            <Section
              title={section.title}
              type={section.type}
              isLastCategory={sectionIndex === filteredNavigation.length - 1 && section.type === 'forge-category'}
            >
              {section.items.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  subtitle={item.subtitle}
                  actionLabel={item.actionLabel}
                  isPrimary={item.isPrimary}
                  isTwin={item.isTwin}
                  isForge={item.isForge}
                  isActive={isActive(item.to)}
                  circuitColor={item.circuitColor}
                  tabs={item.tabs}
                  subItems={item.subItems}
                  isExpanded={expandedForges[item.to]}
                  onToggleExpand={() => handleToggleExpand(item.to)}
                />
              ))}
            </Section>
            {/* Séparateur après le Tableau de Bord (section primaire) */}
            {section.type === 'primary' && (
              <div className="sidebar-primary-separator" aria-hidden="true" />
            )}
          </React.Fragment>
        ))}

        {/* ========== SECTION COMPTE ========== */}
        <div className="mt-4 pt-2">
          <div className="sidebar-category-separator mb-3" />
          <h3 className="sidebar-section-title text-white/50 text-xs uppercase tracking-wider font-semibold mb-1 px-1">
            Compte
          </h3>
          <div className="space-y-1">
            {/* Token Balance Widget */}
            <div className="mb-2">
              <TokenBalanceWidget />
            </div>

            {/* Bouton Profil */}
            <Link
              to="/profile"
              className={`
                sidebar-item group focus-ring
                ${isActive('/profile') ? 'text-white shadow-sm' : 'text-white/70 hover:text-white'}
              `}
              style={{ '--item-circuit-color': '#FDC830' } as React.CSSProperties}
            >
              <div className={`sidebar-item-icon-container ${isActive('/profile') ? 'sidebar-item-icon-container--active' : ''}`}>
                <SpatialIcon
                  Icon={ICONS.User}
                  size={18}
                  className={`sidebar-item-icon ${isActive('/profile') ? '' : 'opacity-80 group-hover:opacity-100'}`}
                  style={isActive('/profile') ? {
                    color: '#FDC830',
                    filter: 'drop-shadow(0 0 8px rgba(253, 200, 48, 0.6))'
                  } : undefined}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`sidebar-item-label font-medium text-xs truncate ${isActive('/profile') ? 'text-white' : 'text-white/82'}`}>
                  Mon Profil
                </div>
                <div className={`sidebar-item-subtitle text-xxs truncate mt-0 ${isActive('/profile') ? 'text-white/70' : 'text-white/50'}`}>
                  Infos personnelles
                </div>
              </div>
            </Link>

            {/* Bouton Paramètres */}
            <Link
              to="/settings"
              className={`
                sidebar-item group focus-ring
                ${isActive('/settings') ? 'text-white shadow-sm' : 'text-white/70 hover:text-white'}
              `}
              style={{ '--item-circuit-color': '#FDC830' } as React.CSSProperties}
            >
              <div className={`sidebar-item-icon-container ${isActive('/settings') ? 'sidebar-item-icon-container--active' : ''}`}>
                <SpatialIcon
                  Icon={ICONS.Settings}
                  size={18}
                  className={`sidebar-item-icon ${isActive('/settings') ? '' : 'opacity-80 group-hover:opacity-100'}`}
                  style={isActive('/settings') ? {
                    color: '#FDC830',
                    filter: 'drop-shadow(0 0 8px rgba(253, 200, 48, 0.6))'
                  } : undefined}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`sidebar-item-label font-medium text-xs truncate ${isActive('/settings') ? 'text-white' : 'text-white/82'}`}>
                  Paramètres
                </div>
                <div className={`sidebar-item-subtitle text-xxs truncate mt-0 ${isActive('/settings') ? 'text-white/70' : 'text-white/50'}`}>
                  Configuration
                </div>
              </div>
            </Link>
          </div>

          {/* Séparateur avant déconnexion */}
          <div className="sidebar-category-separator my-2" />

          {/* Bouton Déconnexion avec gradient orange */}
          <button
            onClick={handleLogoutClick}
            className="sidebar-item group focus-ring text-white/70 hover:text-white w-full"
            style={{
              '--item-circuit-color': '#FF6B35',
              textAlign: 'left'
            } as React.CSSProperties}
          >
            <div
              className="sidebar-item-icon-container"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(247, 147, 30, 0.15))',
                border: '1.5px solid rgba(255, 107, 53, 0.35)',
                boxShadow: '0 0 16px rgba(255, 107, 53, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
            >
              <SpatialIcon
                Icon={ICONS.LogOut}
                size={18}
                className="sidebar-item-icon opacity-80 group-hover:opacity-100"
                style={{
                  color: '#FF6B35',
                  filter: 'drop-shadow(0 0 6px rgba(255, 107, 53, 0.4))'
                }}
              />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="sidebar-item-label font-medium text-xs truncate text-white/82 text-left">
                Déconnexion
              </div>
              <div className="sidebar-item-subtitle text-xxs truncate mt-0 text-white/50 text-left">
                Se déconnecter
              </div>
            </div>
          </button>
        </div>
      </div>

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
    </aside>
  );
});
Sidebar.displayName = 'Sidebar';


export default Sidebar;
