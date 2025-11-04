import React from 'react';
import { useLocation } from 'react-router-dom';
import Tabs from '../../ui/tabs/TabsComponent';
import { useTabsKeyboard } from '../../ui/tabs/useTabsKeyboard';
import { useScrollMemory } from '../../hooks/scroll/useScrollMemory';
import ProfileIdentityTab from './Profile/ProfileIdentityTab';
import ProfileNutritionTab from './Profile/ProfileNutritionTab';
import ProfileHealthTab from './Profile/ProfileHealthTab';
import ProfileFastingTab from './Profile/ProfileFastingTab';
import ProfileTrainingTab from './Profile/ProfileTrainingTab';
import ProfileGeoTab from './Profile/ProfileGeoTab';
import ProfileMenstrualTab from './Profile/ProfileMenstrualTab';
import { useFeedback } from '../../hooks/useFeedback';
import logger from '../../lib/utils/logger';
import ProfileAvatarTab from './Profile/ProfileAvatarTab';
import PageHeader from '../../ui/page/PageHeader';
import { useUserStore } from '../../system/store/userStore';

/**
 * Get dynamic header content based on active tab
 */
function getTabHeaderContent(activeTab: string) {
  switch (activeTab) {
    case 'identity':
      return {
        icon: 'User' as const,
        title: 'Identité Personnelle',
        subtitle: 'Vos informations de base et mesures corporelles',
        circuit: 'home' as const,
        color: '#60A5FA',
      };
    case 'nutrition':
      return {
        icon: 'Utensils' as const,
        title: 'Préférences Nutritionnelles',
        subtitle: 'Régime alimentaire et restrictions',
        circuit: 'meals' as const,
        color: '#10B981',
      };
    case 'health':
      return {
        icon: 'Heart' as const,
        title: 'Santé & Médical',
        subtitle: 'Conditions médicales et contraintes de santé',
        circuit: 'health' as const,
        color: '#EF4444',
      };
    case 'menstrual':
      return {
        icon: 'Heart' as const,
        title: 'Cycle Menstruel',
        subtitle: 'Suivi et personnalisation selon votre cycle',
        circuit: 'health' as const,
        color: '#EC4899',
      };
    case 'fasting':
      return {
        icon: 'Timer' as const,
        title: 'Préférences de Jeûne',
        subtitle: 'Protocoles et objectifs de jeûne',
        circuit: 'fasting' as const,
        color: '#F59E0B',
      };
    case 'preferences':
    case 'training':
      return {
        icon: 'Dumbbell' as const,
        title: 'Préférences de Training',
        subtitle: 'Objectifs et préférences d\'entraînement',
        circuit: 'training' as const,
        color: '#18E3FF',
      };
    case 'geo':
      return {
        icon: 'MapPin' as const,
        title: 'Géolocalisation',
        subtitle: 'Pays et données environnementales',
        circuit: 'home' as const,
        color: '#EC4899',
      };
    case 'avatar':
      return {
        icon: 'Camera' as const,
        title: 'Avatar 3D',
        subtitle: 'Données morphologiques et scans',
        circuit: 'avatar' as const,
        color: '#A855F7',
      };
    default:
      return {
        icon: 'User' as const,
        title: 'Profil Utilisateur',
        subtitle: 'Votre fiche personnelle complète',
        circuit: 'home' as const,
        color: '#60A5FA',
      };
  }
}

/**
 * Profile - Simplified for Body Scan development
 * Only Identity and Avatar tabs
 */
const Profile: React.FC = () => {
  const location = useLocation();
  const { click } = useFeedback();
  const profile = useUserStore((state) => state.profile);

  // Check if user is female to show menstrual tab
  const isFemale = profile?.sex === 'female';

  // Debug log
  React.useEffect(() => {
    console.log('🌸 MENSTRUAL TAB DEBUG:', {
      profileSex: profile?.sex,
      isFemale,
      profileExists: !!profile,
      profileKeys: profile ? Object.keys(profile) : [],
    });
    logger.debug('PROFILE_TAB', 'Menstrual tab visibility check', {
      profileSex: profile?.sex,
      isFemale,
      profileExists: !!profile,
    });
  }, [profile?.sex, isFemale, profile]);

  // Derive activeTab from URL search params or hash
  const activeTab = React.useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && ['identity', 'nutrition', 'health', 'menstrual', 'fasting', 'training', 'geo', 'avatar'].includes(tabParam)) {
      return tabParam;
    }
    const hash = location.hash.replace('#', '');
    return hash && ['identity', 'nutrition', 'health', 'menstrual', 'fasting', 'preferences', 'geo', 'avatar'].includes(hash) ? hash : 'identity';
  }, [location.hash, location.search]);
  
  // Enable keyboard navigation for tabs
  useTabsKeyboard();
  
  // Mémoriser la position de scroll pour chaque onglet
  useScrollMemory(`profile:${activeTab}`);

  // Get dynamic header content based on active tab
  const headerContent = getTabHeaderContent(activeTab);

  const handleTabChange = (value: string) => {
    click();
    
    logger.debug('PROFILE', 'Tab change triggered', { newTab: value });
  };


  return (
    <div className="space-y-6 w-full overflow-visible">
      <PageHeader
        icon={headerContent.icon}
        title={headerContent.title}
        subtitle={headerContent.subtitle}
        circuit={headerContent.circuit}
        iconColor={headerContent.color}
      />

      {/* Temporary debug display */}
      <div style={{
        padding: '12px',
        background: 'rgba(255, 100, 255, 0.1)',
        border: '1px solid rgba(255, 100, 255, 0.3)',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <strong>🔍 DEBUG - Menstrual Tab Visibility:</strong><br/>
        Profile Sex: {profile?.sex || 'undefined'}<br/>
        Is Female: {isFemale ? 'YES ✅' : 'NO ❌'}<br/>
        Profile Loaded: {profile ? 'YES ✅' : 'NO ❌'}<br/>
        Should Show Tab: {isFemale ? 'YES - Tab should be visible' : 'NO - Tab hidden'}
      </div>
      
      <Tabs
        defaultValue="identity"
        value={activeTab}
        className="w-full min-w-0 profile-tabs"
        onValueChange={handleTabChange}
        forgeContext="profile"
      >
        <Tabs.List role="tablist" aria-label="Sections du profil" className="mb-6 w-full">
          <Tabs.Trigger value="identity" icon="User">
            <span className="tab-text">Identité</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="nutrition" icon="Utensils">
            <span className="tab-text">Nutrition</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="preferences" icon="Dumbbell">
            <span className="tab-text">Training</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="fasting" icon="Timer">
            <span className="tab-text">Jeûne</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="health" icon="Heart">
            <span className="tab-text">Santé</span>
          </Tabs.Trigger>
          {isFemale && (
            <Tabs.Trigger value="menstrual" icon="Heart">
              <span className="tab-text">Cycle</span>
            </Tabs.Trigger>
          )}
          <Tabs.Trigger value="geo" icon="MapPin">
            <span className="tab-text">Geo</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="avatar" icon="Camera">
            <span className="tab-text">Avatar</span>
          </Tabs.Trigger>
        </Tabs.List>
        
        <Tabs.Panel value="identity">
          <ProfileIdentityTab />
        </Tabs.Panel>
        
        <Tabs.Panel value="nutrition">
          <ProfileNutritionTab />
        </Tabs.Panel>
        
        <Tabs.Panel value="health">
          <ProfileHealthTab />
        </Tabs.Panel>

        {isFemale && (
          <Tabs.Panel value="menstrual">
            <ProfileMenstrualTab />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="preferences">
          <ProfileTrainingTab />
        </Tabs.Panel>
        
        <Tabs.Panel value="fasting">
          <ProfileFastingTab />
        </Tabs.Panel>

        <Tabs.Panel value="geo">
          <ProfileGeoTab />
        </Tabs.Panel>

        <Tabs.Panel value="avatar">
          <ProfileAvatarTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default Profile;
