import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../components/supabase';
import { extractText, normalizeDocument } from '../utils/documentUtils';

const SESSION_KEY = '@nota/session';
const PROFILE_KEY = '@nota/profile';
const STATUS_KEY = '@nota/status';
const ACTIVITY_KEY = '@nota/activity';
const DOCUMENTS_KEY = '@nota/documents';
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
  const [storedDocuments, setStoredDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const [
          [, storedSession],
          [, storedProfile],
          [, storedStatus],
          [, storedActivity],
          [, storedDocs],
        ] = await AsyncStorage.multiGet([
          SESSION_KEY,
          PROFILE_KEY,
          STATUS_KEY,
          ACTIVITY_KEY,
          DOCUMENTS_KEY,
        ]);

        if (!mounted) {
          return;
        }

        const parsedSession = storedSession ? JSON.parse(storedSession) : null;
        const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
        const parsedActivity = storedActivity ? JSON.parse(storedActivity) : [];
        const parsedDocs = storedDocs ? JSON.parse(storedDocs) : [];

        supabase._session = parsedSession;
        setSession(parsedSession);
        setProfile(parsedProfile);
        setStatusMessage(storedStatus || 'Ready to annotate smarter.');
        setActivityFeed(Array.isArray(parsedActivity) ? parsedActivity : []);
        setStoredDocuments(Array.isArray(parsedDocs) ? parsedDocs : []);
      } catch (error) {
        console.log('hydrate app state error:', error);
      } finally {
        if (mounted) {
          setAuthLoading(false);
          setDocumentsLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && session?.user?.id) {
      refreshDocuments(session);
    }
  }, [authLoading, session?.user?.id]);

  const persistDocuments = async (nextDocuments) => {
    setStoredDocuments(nextDocuments);
    await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(nextDocuments));
  };

  const appendActivity = async (message, nextFeed) => {
    const resolvedFeed = nextFeed ?? [createActivityEntry(message), ...activityFeed].slice(0, 10);
    setActivityFeed(resolvedFeed);
    await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(resolvedFeed));
  };

  const upsertDocument = async (document) => {
    const normalized = normalizeDocument(document);
    const nextDocuments = [
      normalized,
      ...storedDocuments.filter((item) => item.id !== normalized.id),
    ];
    await persistDocuments(nextDocuments);
    return normalized;
  };

  const refreshDocuments = async (activeSession = session) => {
    if (!activeSession?.user?.id) {
      await persistDocuments([]);
      return [];
    }

    if (!activeSession?.access_token) {
      return storedDocuments.filter((item) => item.ownerId === activeSession.user.id);
    }

    setDocumentsLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/documents?user_id=eq.${activeSession.user.id}&deleted_at=is.null&select=id,name,size,uploaded_at,url,extracted_text,highlights&order=uploaded_at.desc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${activeSession.access_token}`,
          },
        }
      );

      if (!res.ok) {
        return storedDocuments.filter((item) => item.ownerId === activeSession.user.id);
      }

      const rows = await res.json();
      const localOnlyDocs = storedDocuments.filter(
        (item) => item.ownerId === activeSession.user.id && item.source === 'local'
      );
      const cloudDocs = rows.map((row) =>
        normalizeDocument({
          ...row,
          source: 'cloud',
          syncStatus: 'synced',
          ownerId: activeSession.user.id,
        })
      );
      const nextDocuments = [...localOnlyDocs, ...cloudDocs].sort(
        (left, right) => new Date(right.uploaded_at).getTime() - new Date(left.uploaded_at).getTime()
      );
      await persistDocuments(nextDocuments);
      return nextDocuments;
    } catch (error) {
      console.log('refreshDocuments error:', error);
      return storedDocuments.filter((item) => item.ownerId === activeSession.user.id);
    } finally {
      setDocumentsLoading(false);
    }
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
      await refreshDocuments(fallbackSession);

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
    await refreshDocuments(nextSession);

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
    setStoredDocuments([]);
    await clearSessionBundle();
    await AsyncStorage.removeItem(DOCUMENTS_KEY);
  };

  const importDocument = async (file) => {
    if (!session?.user?.id) {
      return { error: { message: 'Please sign in first.' } };
    }

    const extractedText = await extractText(file.uri, file.mimeType);
    const baseDocument = {
      title: file.name,
      size: file.size ?? file.fileSize ?? 0,
      uploaded_at: new Date().toISOString(),
      ownerId: session.user.id,
      extracted_text: extractedText ?? '',
      localUri: file.uri,
      mimeType: file.mimeType || null,
      highlights: {},
    };

    if (!session?.access_token) {
      const localDocument = await upsertDocument({
        ...baseDocument,
        id: `local-${Date.now()}`,
        source: 'local',
        syncStatus: 'local',
      });
      const nextFeed = [createActivityEntry(`Imported ${file.name} locally.`), ...activityFeed].slice(0, 10);
      await appendActivity(`Imported ${file.name} locally.`, nextFeed);
      return { error: null, doc: localDocument, remoteSaved: false };
    }

    try {
      const fileName = `${session.user.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const fileBlob = await (await fetch(file.uri)).blob();
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${fileName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': file.mimeType || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: fileBlob,
      });

      if (!uploadRes.ok) {
        throw new Error(await uploadRes.text());
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/documents/${fileName}`;
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size ?? file.fileSize ?? 0,
          url: publicUrl,
          uploaded_at: baseDocument.uploaded_at,
          user_id: session.user.id,
          extracted_text: extractedText ?? null,
          highlights: {},
        }),
      });

      const data = await dbRes.json();
      if (!dbRes.ok) {
        throw new Error(data?.message || 'Metadata save failed.');
      }

      const remoteDocument = await upsertDocument({
        ...(data[0] || {}),
        title: file.name,
        url: publicUrl,
        localUri: file.uri,
        extracted_text: extractedText ?? '',
        ownerId: session.user.id,
        source: 'cloud',
        syncStatus: 'synced',
      });
      const nextFeed = [createActivityEntry(`Imported ${file.name}.`), ...activityFeed].slice(0, 10);
      await appendActivity(`Imported ${file.name}.`, nextFeed);
      return { error: null, doc: remoteDocument, remoteSaved: true };
    } catch (error) {
      console.log('importDocument error:', error);
      const fallbackDocument = await upsertDocument({
        ...baseDocument,
        id: `local-${Date.now()}`,
        source: 'local',
        syncStatus: 'local',
      });
      const nextFeed = [
        createActivityEntry(`Imported ${file.name} locally after upload fallback.`),
        ...activityFeed,
      ].slice(0, 10);
      await appendActivity(`Imported ${file.name} locally after upload fallback.`, nextFeed);
      return {
        error: null,
        doc: fallbackDocument,
        remoteSaved: false,
        warning: 'Cloud upload failed, but the file was saved locally on this device.',
      };
    }
  };

  const deleteDocument = async (docId) => {
    const target = storedDocuments.find((item) => item.id === docId);
    if (!target) {
      return { error: null };
    }

    if (target.source === 'cloud' && session?.access_token) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/documents?id=eq.${docId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleted_at: new Date().toISOString() }),
      });

      if (!res.ok && res.status !== 204) {
        return { error: { message: 'Could not delete document.' } };
      }
    }

    const nextDocuments = storedDocuments.filter((item) => item.id !== docId);
    await persistDocuments(nextDocuments);
    await appendActivity(`Removed ${target.title}.`);
    return { error: null };
  };

  const saveDocumentHighlights = async (docId, highlights) => {
    const existing = storedDocuments.find((item) => item.id === docId);
    if (!existing) {
      return { error: { message: 'Document not found.' } };
    }

    const updated = normalizeDocument({
      ...existing,
      highlights,
      extracted_text: existing.extracted_text,
      localUri: existing.localUri,
      url: existing.url,
      ownerId: existing.ownerId,
      source: existing.source,
      syncStatus: existing.syncStatus,
      mimeType: existing.mimeType,
      size: existing.size,
      uploaded_at: existing.uploaded_at,
      id: existing.id,
    });

    await upsertDocument(updated);

    if (existing.source === 'cloud' && session?.access_token) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/documents?id=eq.${docId}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ highlights }),
        });
      } catch (error) {
        console.log('saveDocumentHighlights remote sync error:', error);
      }
    }

    return { error: null, doc: updated };
  };

  const documents = useMemo(() => {
    if (!session?.user?.id) return [];
    return storedDocuments
      .filter((item) => item.ownerId === session.user.id)
      .sort((left, right) => new Date(right.uploaded_at).getTime() - new Date(left.uploaded_at).getTime());
  }, [session, storedDocuments]);

  const value = useMemo(
    () => ({
      session,
      profile,
      statusMessage,
      activityFeed,
      authLoading,
      documentsLoading,
      isAuthenticated: Boolean(session),
      documents,
      login,
      signUp,
      logout,
      refreshProfile,
      updateProfile,
      appendActivity,
      refreshDocuments,
      importDocument,
      deleteDocument,
      saveDocumentHighlights,
    }),
    [session, profile, statusMessage, activityFeed, authLoading, documentsLoading, documents]
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
