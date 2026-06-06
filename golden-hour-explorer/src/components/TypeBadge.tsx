import { StyleSheet, Text, View } from "react-native";
import { typeColor } from "@/theme/theme";
import type { SpotType } from "@/lib/types";

const LABEL: Record<SpotType, string> = {
  sunrise: "Sunrise",
  sunset: "Sunset",
  both: "Sunrise & sunset",
};

export function TypeBadge({ type }: { type: SpotType }) {
  const color = typeColor[type];
  return (
    <View style={[styles.badge, { backgroundColor: color + "26", borderColor: color + "66" }]}>
      <Text style={[styles.text, { color }]}>{LABEL[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
});
