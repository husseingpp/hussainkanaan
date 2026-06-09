import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Glass } from "@/components/Glass";
import { StateView } from "@/components/StateView";
import { useAuth } from "@/lib/auth";
import { usePendingSpots, useModerateSpot } from "@/lib/db";
import { formatCoord } from "@/lib/geo";
import { colors, radius, space } from "@/theme/theme";
import type { Spot } from "@/lib/types";

export default function AdminScreen() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();
  const { data: pending, isLoading } = usePendingSpots();
  const moderate = useModerateSpot();

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StateView loading />
      </SafeAreaView>
    );
  }

  if (!user || !isAdmin) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header />
        <StateView message="Admins only. Sign in with a moderator account to review submissions." />
        <View style={styles.center}>
          <Pressable style={styles.ghost} onPress={() => router.replace("/(tabs)/map")}>
            <Text style={styles.ghostText}>Back to the app</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const list = pending ?? [];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Header count={list.length} />
      {isLoading ? (
        <StateView loading message="Loading the moderation queue…" />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          ListEmptyComponent={
            <StateView message="Nothing pending — the queue is clear. 🎉" />
          }
          renderItem={({ item }) => (
            <PendingCard
              spot={item}
              busy={moderate.isPending}
              onOpen={() => router.push(`/spot/${item.id}`)}
              onApprove={() => moderate.mutate({ id: item.id, status: "approved" })}
              onReject={() => moderate.mutate({ id: item.id, status: "rejected" })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Header({ count }: { count?: number }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Moderation</Text>
      <Text style={styles.subtitle}>
        {count == null
          ? "Review community-submitted spots"
          : `${count} spot${count === 1 ? "" : "s"} awaiting review`}
      </Text>
    </View>
  );
}

function PendingCard({
  spot,
  busy,
  onOpen,
  onApprove,
  onReject,
}: {
  spot: Spot;
  busy: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const thumb = spot.photo_urls?.[0];
  return (
    <Glass style={styles.card}>
      <Pressable onPress={onOpen} style={styles.cardTop}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Text style={styles.thumbEmptyText}>No photo</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={1}>
            {spot.name}
          </Text>
          <Text style={styles.coord}>{formatCoord(spot.latitude, spot.longitude)}</Text>
          {spot.description ? (
            <Text style={styles.desc} numberOfLines={2}>
              {spot.description}
            </Text>
          ) : null}
          <Text style={styles.type}>{spot.type}</Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          style={[styles.action, styles.reject]}
          onPress={onReject}
          disabled={busy}
        >
          <Text style={styles.rejectText}>Reject</Text>
        </Pressable>
        <Pressable
          style={[styles.action, styles.approve]}
          onPress={onApprove}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#06281a" />
          ) : (
            <Text style={styles.approveText}>Approve</Text>
          )}
        </Pressable>
      </View>
    </Glass>
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
  list: { padding: space.lg, paddingTop: space.sm },
  card: { padding: space.md, gap: space.md },
  cardTop: { flexDirection: "row", gap: space.md },
  thumb: { width: 84, height: 84, borderRadius: radius.sm, backgroundColor: colors.card },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  thumbEmptyText: { color: colors.textFaint, fontSize: 11 },
  cardBody: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 17, fontWeight: "700" },
  coord: { color: colors.textFaint, fontSize: 12, fontFamily: "monospace" },
  desc: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  type: { color: colors.accent, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  actions: { flexDirection: "row", gap: space.sm },
  action: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.md,
    minHeight: 44,
  },
  approve: { backgroundColor: colors.good },
  approveText: { color: "#06281a", fontWeight: "700", fontSize: 15 },
  reject: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
  },
  rejectText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
  center: { alignItems: "center", paddingBottom: space.xxl },
  ghost: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  ghostText: { color: colors.text, fontWeight: "600" },
});
