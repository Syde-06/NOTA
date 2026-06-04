import React from 'react';
import HomeScreen from './HomeScreen';
import DocumentScreen from './DocumentScreen';
import ProfileScreen from './ProfileScreen';
import BottomNav from './BottomNav';

const TAB_SCREENS = {
  Home: HomeScreen,
  Document: DocumentScreen,
  Profile: ProfileScreen,
};

export default function MainTabs({ navigation, activeTab = 'Home' }) {
  const ActiveScreen = TAB_SCREENS[activeTab] || HomeScreen;

  return (
    <>
      <ActiveScreen navigation={navigation} route={{ name: activeTab, params: {} }} />
      <BottomNav navigation={navigation} active={activeTab} />
    </>
  );
}
