import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Glass } from "@/components/Glass";
import { StarRating } from "@/components/StarRating";
import { TypeBadge } from "@/components/TypeBadge";
import { StateView } from "@/components/StateView";
import { useAuth } from "@/lib/auth";
import {
  useAddComment,
  useFavoriteSpots,
  useRateSpot,
  useSpot,
  useSpotComments,
  useToggleFavorite,
  useUpdateSpotPhotos,
  useUserRating,
} from "@/lib/db";
import { uploadSpotImage } from "@/lib/images";
import { fmtTime, getSolarTimes } from "@/lib/solar";
import { fetchWeather, scoreLabel, skyScore } from "@/lib/weather";
import { scheduleGoldenHourAlert } from "@/lib/notifications";
import { formatCoord } from "@/lib/geo";
import { colors, radius, space } from "@/theme/theme";

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, canContribute, isAdmin } = useAuth();

  const { data: spot, isLoading, error } = useSpot(id);
  const { data: comments } = useSpotComments(id);
  const { data: userRating } = useUserRating(id, user?.id);
  const { data: favs } = useFavoriteSpots(user?.id);
  const rate = useRateSpot();
  const addComment = useAddComment();
  const toggleFav = useToggleFavorite();
  const updatePhotos = useUpdateSpotPhotos();

  const [comment, setComment] = useState("");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Photo management is a web-only admin tool.
  const isWeb = Platform.OS === "web";
  const canManagePhotos = isWeb && isAdmin;

  const solar = useMemo(
    () => (spot ? getSolarTimes(spot.latitude, spot.longitude) : null),
    [spot],
  );

  const weather = useQuery({
    queryKey: ["weather", spot?.id],
    queryFn: () => fetchWeather(spot!.latitude, spot!.longitude),
    enabled: !!spot,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <StateView loading />;
  if (error || !spot) return <StateView message="This spot couldn't be loaded." />;

  const isFav = !!favs?.some((f) => f.id === spot.id);
  const score = weather.data ? skyScore(weather.data) : null;
  const cover = spot.photo_urls?.[0] ?? null;

  function requireContributor(action: () => void) {
    if (!canContribute) {
      router.push("/sign-in");
      return;
    }
    action();
  }

  async function onAlert() {
    if (!solar) return;
    const id = await scheduleGoldenHourAlert(spot!.name, solar.eveningGoldenStart);
    setAlertMsg(
      id
        ? "Alert set — we'll remind you 15 minutes before golden hour."
        : "Today's golden hour has passed, or notifications are disabled.",
    );
  }

  // Open turn-by-turn directions in the platform's maps app.
  async function openDirections() {
    const { latitude: lat, longitude: lng } = spot!;
    const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
      android: `google.navigation:q=${lat},${lng}`,
      default: web,
    })!;
    try {
      // On Android the geo intent can be unavailable (no Google Maps) — fall back.
      if (Platform.OS === "android" && !(await Linking.canOpenURL(url))) {
        await Linking.openURL(web);
        return;
      }
      await Linking.openURL(url);
    } catch {
      await Linking.openURL(web).catch(() => {});
    }
  }

  async function addPhoto() {
    if (!spot || !user) return;
    setPhotoErr(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPhotoErr("Photo-library permission is needed to add an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled) return;
    setPhotoBusy(true);
    try {
      const url = await uploadSpotImage(result.assets[0].uri, user.id);
      const next = [...(spot.photo_urls ?? []), url];
      await updatePhotos.mutateAsync({ id: spot.id, photo_urls: next });
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : "Could not add the photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(url: string) {
    if (!spot) return;
    setPhotoErr(null);
    setPhotoBusy(true);
    try {
      const next = (spot.photo_urls ?? []).filter((u) => u !== url);
      await updatePhotos.mutateAsync({ id: spot.id, photo_urls: next });
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : "Could not remove the photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Web: lead with the spot's cover photo as a hero, with Back overlaid. */}
        {isWeb && cover ? (
          <View style={styles.heroWrap}>
            <Image source={{ uri: cover }} style={styles.hero} contentFit="cover" transition={200} />
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.heroBack}>
              <Text style={styles.heroBackText}>‹</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        )}

        <TypeBadge type={spot.type} />
        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.coord}>{formatCoord(spot.latitude, spot.longitude)}</Text>
        {spot.description ? <Text style={styles.desc}>{spot.description}</Text> : null}

        <View style={styles.row}>
          <Text style={styles.rating}>★ {(spot.average_rating ?? 0).toFixed(1)}</Text>
          <Text style={styles.count}>{spot.ratings_count} ratings</Text>
          <Pressable
            onPress={() => requireContributor(() => toggleFav.mutate({ spotId: spot.id, userId: user!.id }))}
            style={styles.favBtn}
          >
            <Text style={styles.favText}>{isFav ? "♥ Saved" : "♡ Save"}</Text>
          </Pressable>
        </View>

        {/* directions */}
        <Pressable style={styles.directionsBtn} onPress={openDirections}>
          <Text style={styles.directionsText}>🚗 Drive there</Text>
        </Pressable>

        {/* admin: photo management (web only) */}
        {canManagePhotos ? (
          <Glass style={styles.glass}>
            <Text style={styles.glassTitle}>Photos · admin</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {(spot.photo_urls ?? []).map((url) => (
                <View key={url} style={styles.photoItem}>
                  <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => removePhoto(url)}
                    disabled={photoBusy}
                    hitSlop={8}
                  >
                    <Text style={styles.photoRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={styles.photoAdd}
                onPress={addPhoto}
                disabled={photoBusy}
              >
                {photoBusy ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.photoAddText}>＋</Text>
                )}
              </Pressable>
            </ScrollView>
            {photoErr ? <Text style={styles.muted}>{photoErr}</Text> : null}
          </Glass>
        ) : null}

        {/* solar */}
        {solar ? (
          <Glass style={styles.glass}>
            <Text style={styles.glassTitle}>Today&apos;s light</Text>
            <View style={styles.timesGrid}>
              <Time label="Sunrise" value={fmtTime(solar.sunrise)} />
              <Time label="AM golden ends" value={fmtTime(solar.morningGoldenEnd)} />
              <Time label="PM golden starts" value={fmtTime(solar.eveningGoldenStart)} />
              <Time label="Sunset" value={fmtTime(solar.sunset)} />
            </View>
          </Glass>
        ) : null}

        {/* sky score */}
        <Glass style={styles.glass}>
          <Text style={styles.glassTitle}>Sky-suitability score</Text>
          {weather.isLoading ? (
            <Text style={styles.muted}>Checking the forecast…</Text>
          ) : score == null ? (
            <Text style={styles.muted}>Forecast unavailable right now.</Text>
          ) : (
            <>
              <Text style={styles.score}>
                {score}
                <Text style={styles.scoreMax}> / 100</Text>
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${score}%` }]} />
              </View>
              <Text style={styles.muted}>
                {scoreLabel(score)} · {Math.round(weather.data!.cloudCover)}% cloud ·{" "}
                {Math.round(weather.data!.windSpeed)} km/h wind
              </Text>
            </>
          )}
        </Glass>

        {/* alert */}
        <Pressable style={styles.alertBtn} onPress={onAlert}>
          <Text style={styles.alertText}>🔔 Alert me before golden hour</Text>
        </Pressable>
        {alertMsg ? <Text style={styles.alertMsg}>{alertMsg}</Text> : null}

        {/* your rating */}
        <Glass style={styles.glass}>
          <Text style={styles.glassTitle}>Your rating</Text>
          <StarRating
            value={userRating?.score ?? 0}
            size={28}
            onChange={(n) =>
              requireContributor(() =>
                rate.mutate({ spotId: spot.id, userId: user!.id, score: n }),
              )
            }
          />
          {!canContribute ? (
            <Text style={styles.muted}>Sign in with a confirmed email to rate.</Text>
          ) : null}
        </Glass>

        {/* comments */}
        <Text style={styles.h}>Reviews</Text>
        <View style={styles.commentBox}>
          <TextInput
            style={styles.input}
            placeholder={canContribute ? "Share what it's like…" : "Sign in to review"}
            placeholderTextColor={colors.textFaint}
            value={comment}
            onChangeText={setComment}
            editable={canContribute}
            multiline
          />
          <Pressable
            style={styles.send}
            onPress={() =>
              requireContributor(() => {
                if (!comment.trim()) return;
                addComment.mutate(
                  { spotId: spot.id, authorId: user!.id, body: comment.trim() },
                  { onSuccess: () => setComment("") },
                );
              })
            }
          >
            <Text style={styles.sendText}>Post</Text>
          </Pressable>
        </View>

        {(comments ?? []).map((c) => (
          <Glass key={c.id} style={styles.comment}>
            <Text style={styles.commentBody}>{c.body}</Text>
          </Glass>
        ))}
        {comments && comments.length === 0 ? (
          <Text style={styles.muted}>No reviews yet — be the first.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Time({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.time}>
      <Text style={styles.timeValue}>{value}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.md },
  back: { color: colors.accent, fontSize: 16, marginBottom: 4 },
  heroWrap: {
    width: "100%",
    height: 300,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.bg2,
  },
  hero: { width: "100%", height: "100%" },
  heroBack: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBackText: { color: "#fff", fontSize: 26, fontWeight: "700", lineHeight: 28, marginTop: -2 },
  name: { color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  coord: { color: colors.textFaint, fontSize: 13, fontFamily: "monospace" },
  desc: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  rating: { color: colors.star, fontSize: 18, fontWeight: "700" },
  count: { color: colors.textFaint, fontSize: 13 },
  favBtn: {
    marginLeft: "auto",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  favText: { color: colors.text, fontWeight: "600" },
  directionsBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  directionsText: { color: "#2a160c", fontWeight: "700", fontSize: 15 },
  glass: { gap: space.sm },
  photoRow: { gap: space.sm, paddingVertical: 4 },
  photoItem: { position: "relative" },
  photo: { width: 92, height: 92, borderRadius: radius.sm, backgroundColor: colors.card },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: { color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 18 },
  photoAdd: {
    width: 92,
    height: 92,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddText: { color: colors.accent, fontSize: 30, fontWeight: "300" },
  glassTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  timesGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  time: { width: "44%", gap: 2 },
  timeValue: { color: colors.accent, fontSize: 18, fontWeight: "700" },
  timeLabel: { color: colors.textMuted, fontSize: 12 },
  score: { color: colors.text, fontSize: 34, fontWeight: "800" },
  scoreMax: { color: colors.textFaint, fontSize: 16, fontWeight: "600" },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.accent },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  alertBtn: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  alertText: { color: colors.text, fontWeight: "600" },
  alertMsg: { color: colors.good, fontSize: 13 },
  h: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: space.sm },
  commentBox: { flexDirection: "row", gap: space.sm, alignItems: "flex-end" },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendText: { color: "#2a160c", fontWeight: "700" },
  comment: { padding: space.md },
  commentBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
