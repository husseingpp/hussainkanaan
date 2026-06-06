import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { colors, space } from "@/theme/theme";

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
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
});
