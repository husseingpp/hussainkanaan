import { Link, useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { SpotCard } from "@/components/SpotCard";
import { StateView } from "@/components/StateView";
import { useAuth } from "@/lib/auth";
import { useFavoriteSpots } from "@/lib/db";
import { colors, radius, space } from "@/theme/theme";

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useFavoriteSpots(user?.id);

  if (!user) {
    return (
      <Screen title="Saved">
        <StateView message="Sign in to bookmark spots and find them here." />
        <View style={styles.cta}>
          <Link href="/sign-in" style={styles.link}>
            Sign in
          </Link>
        </View>
      </Screen>
    );
  }

  if (isLoading)
    return (
      <Screen title="Saved">
        <StateView loading />
      </Screen>
    );

  return (
    <Screen title="Saved">
      <FlatList
        data={data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <SpotCard spot={item} onPress={() => router.push(`/spot/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListEmptyComponent={<StateView message="No saved spots yet." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 120 },
  cta: { alignItems: "center", paddingBottom: space.xxl },
  link: {
    color: "#2a160c",
    backgroundColor: colors.accent,
    fontWeight: "700",
    fontSize: 15,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});
