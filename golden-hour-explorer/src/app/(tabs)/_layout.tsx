import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors } from "@/theme/theme";

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 19, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bg2,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: "Map", tabBarIcon: ({ color }) => <TabIcon emoji="🗺️" color={color} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarIcon: ({ color }) => <TabIcon emoji="🧭" color={color} /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: "Feed", tabBarIcon: ({ color }) => <TabIcon emoji="🌅" color={color} /> }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: "Saved", tabBarIcon: ({ color }) => <TabIcon emoji="♥" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
    </Tabs>
  );
}
