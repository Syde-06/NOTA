import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StatusBar as RNStatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from "./components/LoginScreen";
import TabNav from "./components/TabNav";
import { AppProvider, useAppContext } from './contexts/AppContext';

const MAIN_TABS = ['Home', 'Document', 'Profile'];

const SCREENS = {
  Login: { component: LoginScreen },
  Onboarding: { load: () => require('./components/OnboardingScreen').default },
  MainTabs: { component: TabNav },
  Import: { load: () => require('./components/ImportScreen').default },
  Export: { load: () => require('./components/ExportScreen').default },
  Preview: { load: () => require('./components/PreviewScreen').default },
  Documents: { load: () => require('./components/DocumentScreen').default },
  DocumentViewer: { load: () => require('./components/DocumentViewerScreen').default },
  HighlightWorkspace: { load: () => require('./components/HighlightScreen').default },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ResponsiveSurface({ children, darkMode }) {
  const { width, height } = useWindowDimensions();
  const scale = clamp(Math.min(width / 390, height / 844), 0.84, 1.18);
  const scaledWidth = width / scale;
  const scaledHeight = height / scale;

  return (
    <View
      style={{
        flex: 1,
        overflow: 'hidden',
        backgroundColor: darkMode ? '#0B0B0C' : '#F5F5F7',
      }}>
      <View
        style={{
          width: scaledWidth,
          height: scaledHeight,
          transform: [{ scale }],
          transformOrigin: 'top left',
        }}>
        {children}
      </View>
    </View>
  );
}

function StartupLoader({ darkMode = false }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 720,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    spinLoop.start();

    return () => {
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, [pulse, spin]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.06],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.48, 1],
  });
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: darkMode ? '#0B0B0C' : '#F5F5F7',
      }}>
      <Animated.View
        style={{
          width: 92,
          height: 92,
          borderRadius: 28,
          backgroundColor: darkMode ? '#F5F5F7' : '#1C1C1E',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}>
        <Text style={{ color: darkMode ? '#0B0B0C' : '#fff', fontSize: 44, fontWeight: '900' }}>N</Text>
      </Animated.View>
      <Animated.View
        style={{
          width: 118,
          height: 118,
          borderRadius: 59,
          borderWidth: 3,
          borderColor: darkMode ? '#F5F5F7' : '#1C1C1E',
          borderTopColor: 'transparent',
          position: 'absolute',
          opacity,
          transform: [{ rotate }],
        }}
      />
      <Text style={{ marginTop: 22, color: darkMode ? '#F5F5F7' : '#1C1C1E', fontSize: 16, fontWeight: '800' }}>
        Loading Nota
      </Text>
    </View>
  );
}

function AppNavigator() {
  const { authLoading, isAuthenticated, preferences } = useAppContext();
  const darkMode = Boolean(preferences?.settings?.darkMode);
  const getStartScreen = () => {
    if (!isAuthenticated) return 'Login';
    return preferences?.settings?.onboardingComplete ? 'MainTabs' : 'Onboarding';
  };
  const [stack, setStack] = useState([{ name: getStartScreen(), params: {} }]);
  const [activeTab, setActiveTab] = useState('Home');
  const transition = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setStack([{ name: getStartScreen(), params: {} }]);
    setActiveTab('Home');
  }, [isAuthenticated, preferences?.settings?.onboardingComplete]);

  const current = stack[stack.length - 1];
  const screenKey = `${current?.name || 'MainTabs'}:${activeTab}:${stack.length}`;

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenKey, transition]);

  const navigation = useMemo(
    () => ({
      navigate(name, params = {}) {
        if (MAIN_TABS.includes(name)) {
          setActiveTab(name);
          setStack((current) => {
            const root = current[0]?.name === 'Login' ? { name: 'MainTabs', params: {} } : current[0];
            return [root || { name: 'MainTabs', params: {} }];
          });
          return;
        }

        if (name === 'Login' || name === 'MainTabs') {
          setStack([{ name, params }]);
          return;
        }

        setStack((current) => [...current, { name, params }]);
      },
      goBack() {
        setStack((current) => {
          if (current.length > 1) {
            return current.slice(0, -1);
          }
          return current;
        });
      },
      addListener() {
        return () => {};
      },
      getState() {
        return {
          index: MAIN_TABS.indexOf(activeTab),
          routes: MAIN_TABS.map((name) => ({ name })),
        };
      },
    }),
    [activeTab]
  );

  if (authLoading) {
    return <StartupLoader darkMode={darkMode} />;
  }

  const screen = SCREENS[current.name] || SCREENS.MainTabs;
  const CurrentScreen = screen.component || screen.load();
  const route = { name: current.name, params: current.params || {} };
  const opacity = transition;
  const translateX = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <ResponsiveSurface darkMode={darkMode}>
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }] }}>
        <CurrentScreen
          navigation={navigation}
          route={route}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </Animated.View>
    </ResponsiveSurface>
  );
}

export default function App() {
  function StatusBarTheme() {
    const { preferences } = useAppContext();
    const darkMode = Boolean(preferences?.settings?.darkMode);

    return (
      <RNStatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor={darkMode ? '#0B0B0C' : '#F5F5F7'}
        translucent={false}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBarTheme />
          <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
