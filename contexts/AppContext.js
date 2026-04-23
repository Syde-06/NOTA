import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../components/supabase';

const SESSION_KEY = '@nota/session';
const PROFILE_KEY = '@nota/profile';
const STATUS_KEY = '@nota/status';
const ACTIVITY_KEY = '@nota/activity';
const FALLBACK_EMAIL = 'test@example.com';
const FALLBACK_PASSWORD = '123456';

const AppContext = createContext(null);

function createActivityEntry(message) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    createdAt: new Date().toISOString(),
  };
}

async function persistSessionBundle({ session, profile, statusMessage, activityFeed }) {
  const writes = [
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)),
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)),
    AsyncStorage.setItem(STATUS_KEY, statusMessage ?? ''),
    AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityFeed ?? [])),
  ];

  await Promise.all(writes);
}

async function clearSessionBundle() {
  await AsyncStorage.multiRemove([SESSION_KEY, PROFILE_KEY, STATUS_KEY, ACTIVITY_KEY]);
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Ready to annotate smarter.');
  const [activityFeed, setActivityFeed] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const [[, storedSession], [, storedProfile], [, storedStatus], [, storedActivity]] =
          await AsyncStorage.multiGet([SESSION_KEY, PROFILE_KEY, STATUS_KEY, ACTIVITY_KEY]);

        if (!mounted) {
          return;
        }

        const parsedSession = storedSession ? JSON.parse(storedSession) : null;
        const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
        const parsedActivity = storedActivity ? JSON.parse(storedActivity) : [];

        supabase._session = parsedSession;
        setSession(parsedSession);
        setProfile(parsedProfile);
        setStatusMessage(storedStatus || 'Ready to annotate smarter.');
        setActivityFeed(Array.isArray(parsedActivity) ? parsedActivity : []);
      } catch (error) {
        console.log('hydrate app state error:', error);
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const appendActivity = async (message, nextFeed) => {
    const resolvedFeed = nextFeed ?? [createActivityEntry(message), ...activityFeed].slice(0, 10);
    setActivityFeed(resolvedFeed);
    await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(resolvedFeed));
  };

  const refreshProfile = async (activeSession = session) => {
    if (!activeSession?.user) {
      setProfile(null);
      return null;
    }

    if (!activeSession.access_token) {
      const fallbackProfile = {
        id: activeSession.user.id,
        full_name: activeSession.user.user_metadata?.full_name || 'Demo User',
        email: activeSession.user.email || FALLBACK_EMAIL,
      };
      setProfile(fallbackProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fallbackProfile));
      return fallbackProfile;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', activeSession.user.id)
        .single();

      const nextProfile = {
        id: activeSession.user.id,
        full_name:
          data?.full_name ||
          activeSession.user.user_metadata?.full_name ||
          activeSession.user.email?.split('@')[0] ||
          'Nota User',
        email: data?.email || activeSession.user.email || '',
      };

      setProfile(nextProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      return nextProfile;
    } catch (error) {
      console.log('refreshProfile error:', error);
      return null;
    }
  };

  const login = async ({ email, password }) => {
    if (email.trim().toLowerCase() === FALLBACK_EMAIL && password === FALLBACK_PASSWORD) {
      const fallbackSession = {
        access_token: null,
        user: {
          id: 'local-test-user',
          email: FALLBACK_EMAIL,
          user_metadata: { full_name: 'Test User' },
        },
      };
      const fallbackProfile = {
        id: fallbackSession.user.id,
        full_name: 'Test User',
        email: FALLBACK_EMAIL,
      };
      const nextFeed = [createActivityEntry('Signed in with the demo account.'), ...activityFeed].slice(0, 10);

      supabase._session = fallbackSession;
      setSession(fallbackSession);
      setProfile(fallbackProfile);
      setActivityFeed(nextFeed);
      await persistSessionBundle({
        session: fallbackSession,
        profile: fallbackProfile,
        statusMessage,
        activityFeed: nextFeed,
      });

      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error };
    }

    const nextSession = data?.session || null;
    supabase._session = nextSession;
    setSession(nextSession);

    const nextProfile = await refreshProfile(nextSession);
    const nextFeed = [createActivityEntry('Signed in successfully.'), ...activityFeed].slice(0, 10);
    setActivityFeed(nextFeed);

    await persistSessionBundle({
      session: nextSession,
      profile: nextProfile,
      statusMessage,
      activityFeed: nextFeed,
    });

    return { error: null };
  };

  const signUp = async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });

    if (error) {
      return { error };
    }

    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: name.trim(),
        email: email.trim(),
        created_at: new Date().toISOString(),
      });
    }

    return { error: null };
  };

  const updateProfile = async ({ fullName, status }) => {
    const trimmedName = fullName.trim();
    const trimmedStatus = status.trim() || 'Ready to annotate smarter.';
    let nextProfile = profile
      ? { ...profile, full_name: trimmedName }
      : {
          id: session?.user?.id,
          full_name: trimmedName,
          email: session?.user?.email || '',
        };

    if (session?.access_token && session?.user?.id) {
      const { error } = await supabase
        .from('profiles')
        .eq('id', session.user.id)
        .update({ full_name: trimmedName });

      if (error) {
        return { error };
      }
    }

    setProfile(nextProfile);
    setStatusMessage(trimmedStatus);

    const nextFeed = [createActivityEntry('Updated profile details.'), ...activityFeed].slice(0, 10);
    setActivityFeed(nextFeed);
    await persistSessionBundle({
      session,
      profile: nextProfile,
      statusMessage: trimmedStatus,
      activityFeed: nextFeed,
    });

    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    supabase._session = null;
    setSession(null);
    setProfile(null);
    setStatusMessage('Ready to annotate smarter.');
    setActivityFeed([]);
    await clearSessionBundle();
  };

  const value = useMemo(
    () => ({
      session,
      profile,
      statusMessage,
      activityFeed,
      authLoading,
      isAuthenticated: Boolean(session),
      login,
      signUp,
      logout,
      refreshProfile,
      updateProfile,
      appendActivity,
    }),
    [session, profile, statusMessage, activityFeed, authLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }

  return context;
}
