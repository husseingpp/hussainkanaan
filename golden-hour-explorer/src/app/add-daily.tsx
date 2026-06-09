import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { useCreateDailySpot } from "@/lib/db";
import { uploadSpotImage } from "@/lib/images";
import { formatCoord } from "@/lib/geo";
import { colors, radius, space } from "@/theme/theme";

export default function AddDailyScreen() {
  const router = useRouter();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const { user, canContribute } = useAuth();
  const createDaily = useCreateDailySpot();
  const autoPicked = useRef(false);

  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Launched from the feed camera button (?pick=1): jump straight to the picker.
  useEffect(() => {
    if (pick === "1" && canContribute && !autoPicked.current) {
      autoPicked.current = true;
      void pickPhoto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, canContribute]);

  if (!canContribute) {
    return (
      <Screen title="Add a daily photo" edges={["top", "bottom"]}>
        <View style={styles.gate}>
          <Text style={styles.gateText}>
            Sharing a daily photo needs an account with a confirmed email.
          </Text>
          <Pressable style={styles.primary} onPress={() => router.replace("/sign-in")}>
            <Text style={styles.primaryText}>Sign in</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  async function captureLocation() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setErr("Location permission is needed to tag the photo.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function share() {
    setErr(null);
    if (!photoUri) return setErr("Pick a photo to share.");
    if (!user) return setErr("You need to be signed in.");
    setBusy(true);
    try {
      const photoUrl = await uploadSpotImage(photoUri, user.id);
      await createDaily.mutateAsync({
        authorId: user.id,
        photoUrl,
        caption: caption.trim(),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        locationName: locationName.trim(),
      });
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not share the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Add a daily photo" subtitle="Share today's sky" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.action} onPress={pickPhoto}>
          <Text style={styles.actionText}>{photoUri ? "Change photo" : "🖼️ Pick a photo"}</Text>
        </Pressable>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
        ) : null}

        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Say something about this moment…"
          placeholderTextColor={colors.textFaint}
          value={caption}
          onChangeText={setCaption}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Location name (optional)"
          placeholderTextColor={colors.textFaint}
          value={locationName}
          onChangeText={setLocationName}
        />

        <Pressable style={styles.action} onPress={captureLocation}>
          <Text style={styles.actionText}>
            {coords
              ? `📍 ${formatCoord(coords.latitude, coords.longitude)}`
              : "📍 Tag current location"}
          </Text>
        </Pressable>

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable style={styles.primary} onPress={share} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#2a160c" />
          ) : (
            <Text style={styles.primaryText}>Share</Text>
          )}
        </Pressable>
        <Text style={styles.note}>Daily photos appear in the feed for 7 days.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  action: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  actionText: { color: colors.text, fontWeight: "600" },
  preview: { width: "100%", height: 180, borderRadius: radius.md },
  err: { color: colors.danger, fontSize: 13 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#2a160c", fontWeight: "700", fontSize: 16 },
  note: { color: colors.textFaint, fontSize: 12, textAlign: "center" },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, padding: space.xl },
  gateText: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
});
