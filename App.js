import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./components/LoginScreen";
import TabNav from "./components/TabNav";
import ImportScreen from "./components/ImportScreen";
import ExportScreen from "./components/ExportScreen";
import PreviewScreen from "./components/PreviewScreen";
import DocumentsScreen from "./components/DocumentScreen";
import DocumentViewerScreen from "./components/DocumentViewerScreen";
import HighlightWorkspaceScreen from "./components/HighlightScreen"
import { AppProvider, useAppContext } from './contexts/AppContext';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { authLoading, isAuthenticated } = useAppContext();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F7' }}>
        <ActivityIndicator size="large" color="#1C1C1E" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
        <Stack.Screen name="MainTabs" component={TabNav} />
        <Stack.Screen name="Import" component={ImportScreen} />
        <Stack.Screen name="Export" component={ExportScreen} />
        <Stack.Screen name="Preview" component={PreviewScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} />
        <Stack.Screen name="HighlightWorkspace" component={HighlightWorkspaceScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  );
}
