import { Dimensions, FlatList, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { formatDistanceToNow } from "date-fns";
import { Screen } from "@/components/Screen";
import { StateView } from "@/components/StateView";
import { Glass } from "@/components/Glass";
import { useDailyFeed } from "@/lib/db";
import { colors, space } from "@/theme/theme";
import type { DailySpot } from "@/lib/types";

const { width } = Dimensions.get("window");

function Moment({ item }: { item: DailySpot }) {
  return (
    <View style={[styles.page, { width }]}>
      <Image
        source={{ uri: item.photo_url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.scrim} />
      <Glass style={styles.caption}>
        {item.location_name ? <Text style={styles.place}>{item.location_name}</Text> : null}
        {item.caption ? <Text style={styles.text}>{item.caption}</Text> : null}
        <Text style={styles.time}>
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </Text>
      </Glass>
    </View>
  );
}

export default function FeedScreen() {
  const { data, isLoading, error } = useDailyFeed();

  if (isLoading)
    return (
      <Screen title="Today's skies">
        <StateView loading />
      </Screen>
    );
  if (error)
    return (
      <Screen title="Today's skies">
        <StateView message="Couldn't load the feed." />
      </Screen>
    );
  if (!data || data.length === 0)
    return (
      <Screen title="Today's skies">
        <StateView message="No moments in the last 24 hours. Be the first to share one!" />
      </Screen>
    );

  return (
    <View style={styles.root}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <Moment item={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  page: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  caption: { margin: space.lg, marginBottom: space.xxl, gap: 4 },
  place: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22 },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
