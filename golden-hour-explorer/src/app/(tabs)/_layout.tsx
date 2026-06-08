import { Tabs } from "expo-router";
import { StyleSheet, Text, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/theme";

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 18, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Lift the floating dock above the home indicator; clamp so it never hugs
  // the very bottom edge on devices without an inset (and on web).
  const bottom = Math.max(insets.bottom, 12) + 6;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        // A centered, floating pill — same dock on web and mobile.
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom,
          marginHorizontal: "auto",
          maxWidth: 460,
          height: 62,
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 8,
          borderRadius: 999,
          borderTopWidth: 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.bg2,
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        },
        tabBarItemStyle: { paddingVertical: 2, borderRadius: 999 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600", marginTop: 1 },
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
