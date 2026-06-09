import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { colors, fonts, space } from "@/theme/theme";

export function Screen({
  children,
  title,
  accent,
  subtitle,
  right,
  center,
  edges = ["top"],
}: {
  children: ReactNode;
  title?: string;
  /** Second word rendered in italic amber — the two-tone headline treatment. */
  accent?: string;
  subtitle?: string;
  /** Optional control aligned to the right of the headline (e.g. a button). */
  right?: ReactNode;
  /** Center the headline block (used by the Daily feed). */
  center?: boolean;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {title ? (
        <View style={[styles.header, center && styles.headerCenter]}>
          <View style={center ? styles.colCenter : styles.col}>
            <Text style={[styles.title, center && styles.textCenter]}>
              {title}
              {accent ? <Text style={styles.accent}> {accent}</Text> : null}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, center && styles.textCenter]}>{subtitle}</Text>
            ) : null}
          </View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  headerCenter: { justifyContent: "center", position: "relative" },
  col: { flex: 1 },
  colCenter: { alignItems: "center" },
  // Heavy uppercase grotesk headline — the reference's section-title treatment.
  title: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    lineHeight: 34,
  },
  accent: { color: colors.accent, fontStyle: "italic" },
  subtitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 6,
  },
  textCenter: { textAlign: "center" },
  right: { position: "absolute", right: space.lg },
});
