import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './HomeScreen';
import DocumentScreen from './DocumentScreen';
import ProfileScreen from './ProfileScreen';
import BottomNav from './BottomNav'; // Reuse custom nav bar

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: 'absolute', height: 80 }, // Match BottomNav
      }}
tabBar={props => <BottomNav navigation={props.navigation} state={props.state} />}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="Document" 
        component={DocumentScreen}
        options={{ tabBarLabel: 'Docs' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
