import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { colors, radius, space, typeColor } from "@/theme/theme";
import { formatDistance } from "@/lib/geo";
import type { Spot, SpotWithDistance } from "@/lib/types";
import { TypeBadge } from "./TypeBadge";

// Web-only easing for the hover zoom (no-op on native, where hover never fires).
const ZOOM_TRANSITION =
  Platform.OS === "web"
    ? ({
        transitionProperty: "transform",
        transitionDuration: "420ms",
        transitionTimingFunction: "cubic-bezier(.2,.8,.2,1)",
      } as object)
    : null;

export function SpotCard({
  spot,
  onPress,
}: {
  spot: Spot | SpotWithDistance;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const distanceKm = "distanceKm" in spot ? spot.distanceKm : null;
  const photo = spot.photo_urls?.[0];

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.photoFrame}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={[styles.photo, ZOOM_TRANSITION, { transform: [{ scale: hovered ? 1.05 : 1 }] }]}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: typeColor[spot.type] }]}>
            <Text style={styles.photoEmoji}>🌄</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
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
    overflow: "hidden",
  },
  pressed: { opacity: 0.92 },
  // Wide 3:2 cover that scales with the card width — imagery leads the card.
  photoFrame: { width: "100%", aspectRatio: 3 / 2, overflow: "hidden", backgroundColor: colors.bg2 },
  photo: { width: "100%", height: "100%" },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  photoEmoji: { fontSize: 40 },
  body: { padding: space.md, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rating: { color: colors.star, fontWeight: "700", fontSize: 14 },
  name: { color: colors.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  desc: { color: colors.textMuted, fontSize: 13.5, lineHeight: 19 },
  meta: { flexDirection: "row", gap: 6, marginTop: 2 },
  metaText: { color: colors.textFaint, fontSize: 12.5 },
});
