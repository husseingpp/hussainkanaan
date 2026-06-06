import { useState } from "react";
import { useRouter } from "expo-router";
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
import { useCreateSpot } from "@/lib/db";
import { uploadSpotImage } from "@/lib/images";
import { formatCoord } from "@/lib/geo";
import { colors, radius, space } from "@/theme/theme";
import type { SpotType } from "@/lib/types";

const TYPES: { key: SpotType; label: string }[] = [
  { key: "sunrise", label: "Sunrise" },
  { key: "sunset", label: "Sunset" },
  { key: "both", label: "Both" },
];

export default function SubmitScreen() {
  const router = useRouter();
  const { user, canContribute } = useAuth();
  const createSpot = useCreateSpot();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SpotType>("sunset");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!canContribute) {
    return (
      <Screen title="Add a spot" edges={["top", "bottom"]}>
        <View style={styles.gate}>
          <Text style={styles.gateText}>
            Submitting a spot needs an account with a confirmed email.
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
      setErr("Location permission is needed to capture the spot's coordinates.");
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

  async function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Give the spot a name.");
    if (!coords) return setErr("Capture the location first.");
    setBusy(true);
    try {
      const photo_urls: string[] = [];
      if (photoUri && user) {
        photo_urls.push(await uploadSpotImage(photoUri, user.id));
      }
      await createSpot.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        type,
        best_months: [],
        photo_urls,
        authorId: user!.id,
      });
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit the spot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Add a spot" subtitle="Share a golden-hour view" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.input}
          placeholder="Spot name"
          placeholderTextColor={colors.textFaint}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="What makes it special?"
          placeholderTextColor={colors.textFaint}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Best for</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => {
            const on = type === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setType(t.key)}
                style={[styles.type, on && styles.typeOn]}
              >
                <Text style={[styles.typeText, on && styles.typeTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.action} onPress={captureLocation}>
          <Text style={styles.actionText}>
            {coords ? `📍 ${formatCoord(coords.latitude, coords.longitude)}` : "📍 Capture GPS location"}
          </Text>
        </Pressable>

        <Pressable style={styles.action} onPress={pickPhoto}>
          <Text style={styles.actionText}>{photoUri ? "Change photo" : "🖼️ Add a photo"}</Text>
        </Pressable>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#2a160c" />
          ) : (
            <Text style={styles.primaryText}>Submit for review</Text>
          )}
        </Pressable>
        <Text style={styles.note}>
          New spots are submitted as “pending” and appear once approved.
        </Text>
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
  label: { color: colors.text, fontWeight: "700", fontSize: 14 },
  typeRow: { flexDirection: "row", gap: 8 },
  type: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  typeOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeText: { color: colors.textMuted, fontWeight: "600" },
  typeTextOn: { color: "#2a160c" },
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
