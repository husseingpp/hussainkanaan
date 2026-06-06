import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, space } from "@/theme/theme";

/** Shared loading / empty / error placeholder centred in the available space. */
export function StateView({
  loading,
  message,
}: {
  loading?: boolean;
  message?: string;
}) {
  return (
    <View style={styles.root}>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  text: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
});
