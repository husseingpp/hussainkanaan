import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Animated, StyleSheet, Text, View, type ColorValue } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/components/TopBar";
import { colors } from "@/theme/theme";

// Translucent brand amber used for the active-tab pill. A fixed rgba (rather
// than the themed accent var) so it reads correctly in both light and dark.
const ACTIVE_PILL = "rgba(240,146,47,0.16)";

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * Tab item with a characterful spring: the line icon sits in a pill that fades
 * in and springs up when its tab is focused, with the label directly beneath.
 * We render the label ourselves (the tab bar's built-in label is hidden) so the
 * icon + label are reliably centered in the floating dock — the library's own
 * stack is top-aligned, which left the glyphs sitting high in the pill. Only the
 * transform uses the native driver (color/background can't), so the scale
 * animates smoothly everywhere while the highlight toggles instantly.
 */
function TabIcon({
  name,
  label,
  focused,
  color,
}: {
  name: FeatherName;
  label: string;
  focused: boolean;
  color: ColorValue;
}) {
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
    <View style={styles.item}>
      <Animated.View
        style={[
          styles.iconWrap,
          focused && styles.iconWrapActive,
          { transform: [{ scale: scale.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) }] },
        ]}
      >
        <Feather name={name} size={20} color={color} />
      </Animated.View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Lift the floating dock above the home indicator; clamp so it never hugs
  // the very bottom edge on devices without an inset (and on web).
  const bottom = Math.max(insets.bottom, 12) + 6;

  return (
    <SafeAreaView edges={["top"]} style={styles.shell}>
      <TopBar />
      <View style={styles.body}>
        <Tabs
          screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        // We draw our own label inside TabIcon so the icon + label sit centered
        // in the pill; hide the library's (top-aligned) one to avoid doubling.
        tabBarShowLabel: false,
        // A centered, floating pill — same dock on web and mobile.
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom,
          marginHorizontal: "auto",
          maxWidth: 460,
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
          paddingHorizontal: 12,
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
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: "Map", tabBarIcon: ({ focused, color }) => <TabIcon name="map" label="Map" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarIcon: ({ focused, color }) => <TabIcon name="compass" label="Explore" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: "Daily", tabBarIcon: ({ focused, color }) => <TabIcon name="camera" label="Daily" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: "Saved", tabBarIcon: ({ focused, color }) => <TabIcon name="heart" label="Saved" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused, color }) => <TabIcon name="user" label="Profile" focused={focused} color={color} /> }}
      />
        </Tabs>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  // Fills its tab cell and centers the icon + label, so the pair sits vertically
  // centered in the dock regardless of the library's internal alignment.
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  iconWrap: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: ACTIVE_PILL },
  label: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
