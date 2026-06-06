import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/theme/theme";
import { formatDistance } from "@/lib/geo";
import type { Spot, SpotWithDistance } from "@/lib/types";
import { TypeBadge } from "./TypeBadge";

export function SpotCard({
  spot,
  onPress,
}: {
  spot: Spot | SpotWithDistance;
  onPress: () => void;
}) {
  const distanceKm = "distanceKm" in spot ? spot.distanceKm : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <TypeBadge type={spot.type} />
        <Text style={styles.rating}>★ {(spot.average_rating ?? 0).toFixed(1)}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {spot.name}
      </Text>
      {spot.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          {spot.description}
        </Text>
      ) : null}
      <View style={styles.meta}>
        <Text style={styles.metaText}>{spot.ratings_count} ratings</Text>
        {distanceKm != null ? (
          <Text style={styles.metaText}>· {formatDistance(distanceKm)} away</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.md,
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rating: { color: colors.star, fontWeight: "700", fontSize: 14 },
  name: { color: colors.text, fontSize: 17, fontWeight: "700" },
  desc: { color: colors.textMuted, fontSize: 13.5, lineHeight: 19 },
  meta: { flexDirection: "row", gap: 6, marginTop: 2 },
  metaText: { color: colors.textFaint, fontSize: 12.5 },
});
