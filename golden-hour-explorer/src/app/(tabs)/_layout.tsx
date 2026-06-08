import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/theme";

// Translucent brand amber used for the active-tab pill. A fixed rgba (rather
// than the themed accent var) so it reads correctly in both light and dark.
const ACTIVE_PILL = "rgba(240,146,47,0.16)";

/**
 * Tab icon with a characterful spring: the emoji sits in a pill that fades in
 * and springs up when its tab is focused. Only the transform uses the native
 * driver (color/background can't), so the scale animates smoothly everywhere
 * while the highlight toggles instantly.
 */
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        focused && styles.iconWrapActive,
        { transform: [{ scale: scale.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }] },
      ]}
    >
      <Text style={styles.icon}>{emoji}</Text>
    </Animated.View>
  );
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
          height: 72,
          paddingTop: 10,
          paddingBottom: 12,
          paddingHorizontal: 16,
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
        tabBarItemStyle: { paddingVertical: 0, borderRadius: 999 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 3 },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: "Map", tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarIcon: ({ focused }) => <TabIcon emoji="🧭" focused={focused} /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: "Feed", tabBarIcon: ({ focused }) => <TabIcon emoji="🌅" focused={focused} /> }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: "Saved", tabBarIcon: ({ focused }) => <TabIcon emoji="♥" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    paddingHorizontal: 13,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: ACTIVE_PILL },
  icon: { fontSize: 17 },
});
