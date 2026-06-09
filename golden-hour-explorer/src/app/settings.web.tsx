import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTweaks, type Tweaks } from "@/lib/tweaks";
import { colors, radius, space } from "@/theme/theme";

type Opt<T extends string> = { value: T; label: string };

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.seg}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[styles.segBtn, on && styles.segBtnOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { tweaks, setTweak } = useTweaks();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Appearance</Text>
        <Text style={styles.subtitle}>
          Tweak the look of the app. Your choices are saved on this device.
        </Text>

        <View style={styles.card}>
          <Segmented<Tweaks["mode"]>
            label="Theme"
            value={tweaks.mode}
            onChange={(v) => setTweak("mode", v)}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <View style={styles.divider} />
          <Segmented<Tweaks["density"]>
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
          <View style={styles.divider} />
          <Segmented<Tweaks["radius"]>
            label="Corners"
            value={tweaks.radius}
            onChange={(v) => setTweak("radius", v)}
            options={[
              { value: "soft", label: "Soft" },
              { value: "sharp", label: "Sharp" },
            ]}
          />
        </View>

        <Text style={styles.note}>
          Theme “System” follows your device’s light/dark setting.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.md, maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { color: colors.accent, fontSize: 16, marginBottom: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  card: {
    marginTop: space.sm,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: space.md,
    flexWrap: "wrap",
  },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  seg: {
    flexDirection: "row",
    backgroundColor: colors.bg2,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: colors.accent },
  segText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  segTextOn: { color: "#1a1206" },
  note: { color: colors.textFaint, fontSize: 12, marginTop: space.xs },
});
