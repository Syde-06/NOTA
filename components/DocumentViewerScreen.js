import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Share,
  Animated,
  Dimensions,
} from 'react-native';
import { supabase } from './supabase';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLOR_ROLES = [
  { color: '#FF3B30', label: 'Title' },
  { color: '#FFCC00', label: 'Definition' },
  { color: '#34C759', label: 'List' },
  { color: '#007AFF', label: 'Example' },
  { color: '#AF52DE', label: 'Summary' },
];

export default function DocumentViewerScreen({ route, navigation }) {
  const { doc } = route.params;
  const [loading, setLoading] = useState(true);
  const [docUrl, setDocUrl] = useState(doc.url || null);
  const [error, setError] = useState(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [activeColor, setActiveColor] = useState(null);
  const toolbarAnim = useRef(new Animated.Value(1)).current;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    console.log('Doc URL:', docUrl);
    console.log('Doc object:', JSON.stringify(doc, null, 2));
  }, [docUrl]);

  const fetchDocUrl = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `https://vfbhliljrxkyjxxhfjep.supabase.co/rest/v1/documents?id=eq.${doc.id}&select=url`,
        {
          headers: {
            apikey:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmYmhsaWxqcnhreWp4eGhmamVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDQzODUsImV4cCI6MjA4ODk4MDM4NX0.9egrWItvdc1LAbOWyxyz2S8Gp5NvmUuAxujazGFqaEg',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data[0]?.url) setDocUrl(data[0].url);
        else setError('Document URL not found.');
      }
    } catch (e) {
      setError('Failed to load document.');
    }
  };

  const toggleToolbar = () => {
    const toValue = toolbarVisible ? 0 : 1;
    Animated.spring(toolbarAnim, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    setToolbarVisible(!toolbarVisible);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: doc.title,
        message: `Check out this document: ${doc.title}\n${docUrl}`,
        url: docUrl,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const toolbarTranslateY = toolbarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  const getViewerUrl = (url) => {
    if (!url) return null;
    const isDocx = url.toLowerCase().includes('.docx');
    const isPdf = url.toLowerCase().includes('.pdf');

    if (isDocx) {
      // Microsoft Office Online viewer - fastest for docx
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
        url
      )}`;
    }
    if (isPdf) {
      // Google viewer for PDF
      return `https://docs.google.com/gviewer?embedded=true&url=${encodeURIComponent(
        url
      )}`;
    }
    // Fallback to raw URL
    return url;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {doc.title}
          </Text>
          <Text style={styles.headerSub}>
            {doc.pages} pages · {doc.sizeLabel || doc.date}
          </Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Document Viewer */}
      <View style={styles.viewerContainer}>
        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Couldn't load document</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setError(null);
                setLoading(true);
                fetchDocUrl();
              }}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : docUrl ? (
          <>
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={toggleToolbar}>
              <WebView
                source={{ uri: getViewerUrl(docUrl) }}
                onLoadStart={() => {
                  setLoading(true);
                  setTimedOut(false);
                }}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setError('Failed to render document.');
                  setLoading(false);
                }}
                onLoadProgress={({ nativeEvent }) => {
                  if (nativeEvent.progress === 0) {
                    setTimeout(() => setTimedOut(true), 15000);
                  }
                }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#1C1C1E" />
                    <Text style={styles.loadingText}>Loading document…</Text>
                  </View>
                )}
              />
            </TouchableOpacity>
            {timedOut && loading && (
              <View style={styles.timeoutBanner}>
                <Text style={styles.timeoutText}>
                  Still loading… large files may take a moment.
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#1C1C1E" />
            <Text style={styles.loadingText}>Fetching document…</Text>
          </View>
        )}
      </View>

      {/* Floating Highlight Toolbar */}
      <Animated.View
        style={[
          styles.toolbar,
          {
            opacity: toolbarAnim,
            transform: [{ translateY: toolbarTranslateY }],
          },
        ]}
        pointerEvents={toolbarVisible ? 'auto' : 'none'}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}>
          <Text style={styles.toolbarLabel}>Highlight:</Text>
          {COLOR_ROLES.map((role) => (
            <TouchableOpacity
              key={role.color}
              style={[
                styles.colorBtn,
                { backgroundColor: role.color },
                activeColor === role.color && styles.colorBtnActive,
              ]}
              onPress={() =>
                setActiveColor(activeColor === role.color ? null : role.color)
              }>
              {activeColor === role.color && (
                <Text style={styles.colorBtnCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
          <View style={styles.toolbarDivider} />
          <TouchableOpacity style={styles.toolbarActionBtn}>
            <Text style={styles.toolbarActionIcon}>🔖</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolbarActionBtn}
            onPress={handleShare}>
            <Text style={styles.toolbarActionIcon}>⬆️</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F7',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  backIcon: { fontSize: 26, color: '#1C1C1E', marginTop: -2 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  headerSub: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  viewerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  webview: { flex: 1, backgroundColor: '#fff' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  loadingText: { fontSize: 15, color: '#8E8E93', fontWeight: '500' },

  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  errorIcon: { fontSize: 48, marginBottom: 14 },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  errorSub: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  toolbar: {
    position: 'absolute',
    bottom: 34,
    left: 16,
    right: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  toolbarContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  toolbarLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  colorBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorBtnActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },
  colorBtnCheck: { color: '#fff', fontSize: 13, fontWeight: '800' },
  toolbarDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#3A3A3C',
    marginHorizontal: 4,
  },
  toolbarActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarActionIcon: { fontSize: 16 },
});
