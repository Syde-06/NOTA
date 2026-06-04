import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../components/supabase';
import {
  COLOR_ROLES,
  SAMPLE_DOCUMENTS,
  createActivityEntry,
  normalizeDocument,
} from '../components/notaData';

const SESSION_KEY = '@nota/session';
const PROFILE_KEY = '@nota/profile';
const STATUS_KEY = '@nota/status';
const ACTIVITY_KEY = '@nota/activity';
const DOCUMENTS_KEY = '@nota/documents';
const HIGHLIGHTS_KEY = '@nota/highlights';
const PREFERENCES_KEY = '@nota/preferences';
const FALLBACK_EMAIL = 'test@example.com';
const FALLBACK_PASSWORD = '123456';

const AppContext = createContext(null);

const DEFAULT_PREFERENCES = {
  roleLabels: Object.fromEntries(COLOR_ROLES.map((role) => [role.id, role.label])),
  settings: {
    notifications: true,
    darkMode: false,
    defaultExportFormat: 'markdown',
    defaultExportTemplate: 'study-notes',
    onboardingComplete: false,
    rolePreset: 'study',
  },
};

function normalizePreferences(preferences = {}) {
  return {
    roleLabels: {
      ...DEFAULT_PREFERENCES.roleLabels,
      ...(preferences.roleLabels || {}),
    },
    settings: {
      ...DEFAULT_PREFERENCES.settings,
      ...(preferences.settings || {}),
    },
  };
}

async function persistSessionBundle({
  session,
  profile,
  statusMessage,
  activityFeed,
  documents,
  highlightsByDoc,
  preferences,
}) {
  const writes = [
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)),
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)),
    AsyncStorage.setItem(STATUS_KEY, statusMessage ?? ''),
    AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityFeed ?? [])),
    AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents ?? [])),
    AsyncStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(highlightsByDoc ?? {})),
    AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences))),
  ];

  await Promise.all(writes);
}

async function clearSessionBundle() {
  await AsyncStorage.multiRemove([
    SESSION_KEY,
    PROFILE_KEY,
    STATUS_KEY,
    ACTIVITY_KEY,
    DOCUMENTS_KEY,
    HIGHLIGHTS_KEY,
    PREFERENCES_KEY,
  ]);
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Ready to annotate smarter.');
  const [activityFeed, setActivityFeed] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [highlightsByDoc, setHighlightsByDoc] = useState({});
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const [
          [, storedSession],
          [, storedProfile],
          [, storedStatus],
          [, storedActivity],
          [, storedDocuments],
          [, storedHighlights],
          [, storedPreferences],
        ] = await AsyncStorage.multiGet([
          SESSION_KEY,
          PROFILE_KEY,
          STATUS_KEY,
          ACTIVITY_KEY,
          DOCUMENTS_KEY,
          HIGHLIGHTS_KEY,
          PREFERENCES_KEY,
        ]);

        if (!mounted) {
          return;
        }

        const parsedSession = storedSession ? JSON.parse(storedSession) : null;
        const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
        const parsedActivity = storedActivity ? JSON.parse(storedActivity) : [];
        const parsedDocuments = storedDocuments ? JSON.parse(storedDocuments) : [];
        const parsedHighlights = storedHighlights ? JSON.parse(storedHighlights) : {};
        const parsedPreferences = storedPreferences ? JSON.parse(storedPreferences) : DEFAULT_PREFERENCES;

        supabase._session = parsedSession;
        setSession(parsedSession);
        setProfile(parsedProfile);
        setStatusMessage(storedStatus || 'Ready to annotate smarter.');
        setActivityFeed(Array.isArray(parsedActivity) ? parsedActivity : []);
        setDocuments(Array.isArray(parsedDocuments) ? parsedDocuments.map(normalizeDocument) : []);
        setHighlightsByDoc(parsedHighlights && typeof parsedHighlights === 'object' ? parsedHighlights : {});
        setPreferences(normalizePreferences(parsedPreferences));
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

  const replaceDocuments = async (nextDocuments) => {
    const normalized = nextDocuments.map(normalizeDocument);
    setDocuments(normalized);
    await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(normalized));
    return normalized;
  };

  const addDocument = async (doc) => {
    const normalized = normalizeDocument(doc);
    const nextDocuments = [normalized, ...documents.filter((item) => item.id !== normalized.id)];
    await replaceDocuments(nextDocuments);
    await appendActivity(`Imported ${normalized.title}.`);
    return normalized;
  };

  const deleteDocument = async (docId) => {
    const target = documents.find((doc) => doc.id === docId);
    const nextDocuments = documents.filter((doc) => doc.id !== docId);
    const nextHighlights = { ...highlightsByDoc };
    delete nextHighlights[docId];
    setDocuments(nextDocuments);
    setHighlightsByDoc(nextHighlights);
    await Promise.all([
      AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(nextDocuments)),
      AsyncStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(nextHighlights)),
    ]);
    await appendActivity(`Deleted ${target?.title || 'a document'}.`);
  };

  const saveHighlightsForDoc = async (docId, highlights) => {
    if (!docId) return;
    let resolvedHighlights = highlights || {};

    if (session?.access_token && session?.user?.id) {
      try {
        const { data: remoteRows } = await supabase
          .from('highlights')
          .select('highlights, updated_at')
          .eq('document_id', docId)
          .eq('user_id', session.user.id)
          .limit(1);

        const remoteHighlights = remoteRows?.[0]?.highlights || {};
        resolvedHighlights = {
          ...remoteHighlights,
          ...resolvedHighlights,
        };

        await supabase.from('highlights').upsert(
          {
            document_id: docId,
            user_id: session.user.id,
            highlights: resolvedHighlights,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'document_id,user_id' }
        );
      } catch (error) {
        console.log('cloud highlight sync failed:', error);
      }
    }

    const next = { ...highlightsByDoc, [docId]: resolvedHighlights };
    setHighlightsByDoc(next);
    await AsyncStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(next));
  };

  const updatePreferences = async (updates = {}) => {
    const nextPreferences = normalizePreferences({
      roleLabels: {
        ...preferences.roleLabels,
        ...(updates.roleLabels || {}),
      },
      settings: {
        ...preferences.settings,
        ...(updates.settings || {}),
      },
    });

    setPreferences(nextPreferences);
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(nextPreferences));

    if (updates.activityMessage) {
      await appendActivity(updates.activityMessage);
    }

    return { error: null };
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
        avatar_url: activeSession.user.user_metadata?.avatar_url || null,
      };
      setProfile(fallbackProfile);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fallbackProfile));
      return fallbackProfile;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, avatar_url')
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
        avatar_url: data?.avatar_url || activeSession.user.user_metadata?.avatar_url || null,
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
        avatar_url: null,
      };
      const nextFeed = [createActivityEntry('Signed in with the demo account.'), ...activityFeed].slice(0, 10);

      supabase._session = fallbackSession;
      setSession(fallbackSession);
      setProfile(fallbackProfile);
      const seededDocuments = documents.length ? documents : SAMPLE_DOCUMENTS.map(normalizeDocument);
      setActivityFeed(nextFeed);
      setDocuments(seededDocuments);
      await persistSessionBundle({
        session: fallbackSession,
        profile: fallbackProfile,
        statusMessage,
        activityFeed: nextFeed,
        documents: seededDocuments,
        highlightsByDoc,
        preferences,
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
      preferences,
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

  const updateProfile = async ({ fullName, status, avatarUrl }) => {
    const trimmedName = fullName.trim();
    const trimmedStatus = status.trim() || 'Ready to annotate smarter.';
    let nextProfile = profile
      ? {
          ...profile,
          full_name: trimmedName,
          avatar_url: avatarUrl !== undefined ? avatarUrl : profile.avatar_url,
        }
      : {
          id: session?.user?.id,
          full_name: trimmedName,
          email: session?.user?.email || '',
          avatar_url: avatarUrl || null,
        };

    if (session?.access_token && session?.user?.id) {
      const { error } = await supabase
        .from('profiles')
        .eq('id', session.user.id)
        .update({
          full_name: trimmedName,
          avatar_url: nextProfile.avatar_url,
        });

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
      preferences,
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
    setDocuments([]);
    setHighlightsByDoc({});
    setPreferences(DEFAULT_PREFERENCES);
    await clearSessionBundle();
  };

  const value = useMemo(
    () => ({
      session,
      profile,
      statusMessage,
      activityFeed,
      documents,
      highlightsByDoc,
      preferences,
      authLoading,
      isAuthenticated: Boolean(session),
      login,
      signUp,
      logout,
      refreshProfile,
      updateProfile,
      appendActivity,
      replaceDocuments,
      addDocument,
      deleteDocument,
      saveHighlightsForDoc,
      updatePreferences,
    }),
    [session, profile, statusMessage, activityFeed, documents, highlightsByDoc, preferences, authLoading]
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
