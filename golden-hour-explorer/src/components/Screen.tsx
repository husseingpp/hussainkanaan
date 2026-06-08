import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { colors, fonts, space } from "@/theme/theme";

export function Screen({
  children,
  title,
  subtitle,
  edges = ["top"],
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {title ? (
        <View style={styles.header}>
          {subtitle ? <Text style={styles.eyebrow}>{subtitle}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : null}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  // Small, tracked, uppercase label that sits above the headline — editorial style.
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: -0.5,
    lineHeight: 38,
  },
});
