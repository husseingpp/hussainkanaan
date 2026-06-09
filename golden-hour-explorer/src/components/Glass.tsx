import { BlurView } from "expo-blur";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { colors, radius, space } from "@/theme/theme";

/** A frosted glass surface — the core of the app's outdoor-friendly UI. */
export function Glass({
  children,
  style,
  intensity = 24,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.glass, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    overflow: "hidden",
    padding: space.md,
  },
});
