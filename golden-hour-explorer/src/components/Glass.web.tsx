import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { colors, radius, space } from "@/theme/theme";

/**
 * Web surface — a flat, minimal card themed entirely via CSS variables (no
 * blur). This is what gives the web app its clean, minimal look. The native
 * Glass.tsx keeps the frosted BlurView, so native is unchanged. Same props as
 * native Glass (`intensity` is accepted but ignored on web).
 */
export function Glass({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
    padding: space.md,
  },
});
