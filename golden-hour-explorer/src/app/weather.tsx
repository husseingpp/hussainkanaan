import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Screen } from "@/components/Screen";
import { Glass } from "@/components/Glass";
import { getSolarTimes, fmtTime } from "@/lib/solar";
import { fetchWeather, skyScore, scoreLabel } from "@/lib/weather";
import { colors, radius, space } from "@/theme/theme";

type Coords = { latitude: number; longitude: number };
type FeatherName = keyof typeof Feather.glyphMap;
const round = (n: number) => Math.round(n * 10) / 10;

function condition(cc: number): string {
  if (cc < 12) return "Clear sky";
  if (cc < 40) return "Partly cloudy";
  if (cc < 75) return "Cloudy";
  return "Overcast";
}

function Metric({ icon, label, value }: { icon: FeatherName; label: string; value: string }) {
  return (
    <Glass style={styles.metric}>
      <Feather name={icon} size={18} color={colors.accent} />
      <Text style={styles.metricVal}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Glass>
  );
}

function TimeRow({ icon, label, value }: { icon: FeatherName; label: string; value: string }) {
  return (
    <View style={styles.timeRow}>
      <Feather name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeVal}>{value}</Text>
    </View>
  );
}

export default function WeatherScreen() {
  const router = useRouter();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);

  async function locate(prompt: boolean) {
    try {
      const perm = prompt
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        setDenied(true);
        return;
      }
      setDenied(false);
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setDenied(true);
    }
  }
  useEffect(() => {
    locate(false);
  }, []);

  const weather = useQuery({
    queryKey: ["weather", "report", coords && round(coords.latitude), coords && round(coords.longitude)],
    queryFn: () => fetchWeather(coords!.latitude, coords!.longitude),
    enabled: !!coords,
    staleTime: 600_000,
  });

  const solar = coords ? getSolarTimes(coords.latitude, coords.longitude) : null;
  const score = weather.data ? skyScore(weather.data) : null;

  const close = (
    <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
      <Feather name="x" size={20} color={colors.text} />
    </Pressable>
  );

  return (
    <Screen title="Weather" accent="Report" subtitle="Conditions at your location" right={close} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        {!coords ? (
          <Glass style={styles.card}>
            {denied ? (
              <>
                <Text style={styles.muted}>Enable location to see the sky report where you are.</Text>
                <Pressable style={styles.btn} onPress={() => locate(true)}>
                  <Text style={styles.btnText}>Enable location</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>Finding your location…</Text>
              </>
            )}
          </Glass>
        ) : weather.isLoading ? (
          <Glass style={styles.card}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Checking the sky…</Text>
          </Glass>
        ) : weather.error || !weather.data ? (
          <Glass style={styles.card}>
            <Text style={styles.muted}>Forecast unavailable right now.</Text>
          </Glass>
        ) : (
          <>
            <Glass style={styles.hero}>
              <Feather name="sun" size={42} color={colors.accent} />
              <Text style={styles.temp}>{Math.round(weather.data.temperature)}°</Text>
              <Text style={styles.cond}>{condition(weather.data.cloudCover)}</Text>
            </Glass>

            <Glass style={styles.card}>
              <Text style={styles.h}>Sky-suitability score</Text>
              <Text style={styles.score}>
                {score}
                <Text style={styles.scoreMax}> / 100</Text>
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${score ?? 0}%` }]} />
              </View>
              <Text style={styles.muted}>{scoreLabel(score ?? 0)} for golden-hour photography right now.</Text>
            </Glass>

            <View style={styles.metrics}>
              <Metric icon="cloud" label="Cloud" value={`${Math.round(weather.data.cloudCover)}%`} />
              <Metric icon="wind" label="Wind" value={`${Math.round(weather.data.windSpeed)} km/h`} />
              <Metric icon="droplet" label="Humidity" value={`${Math.round(weather.data.humidity)}%`} />
            </View>

            {solar ? (
              <Glass style={styles.card}>
                <Text style={styles.h}>Today&apos;s light</Text>
                <View style={styles.times}>
                  <TimeRow icon="sunrise" label="Sunrise" value={fmtTime(solar.sunrise)} />
                  <TimeRow icon="sun" label="AM golden ends" value={fmtTime(solar.morningGoldenEnd)} />
                  <TimeRow icon="sun" label="PM golden starts" value={fmtTime(solar.eveningGoldenStart)} />
                  <TimeRow icon="sunset" label="Sunset" value={fmtTime(solar.sunset)} />
                </View>
              </Glass>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { gap: space.sm, alignItems: "flex-start" },
  hero: { alignItems: "center", gap: 4, paddingVertical: space.lg },
  temp: { color: colors.text, fontSize: 52, fontWeight: "800", letterSpacing: -1 },
  cond: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  h: { color: colors.text, fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  score: { color: colors.accent, fontSize: 36, fontWeight: "800" },
  scoreMax: { color: colors.textFaint, fontSize: 16, fontWeight: "600" },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.card, overflow: "hidden", width: "100%" },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.accent },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  metrics: { flexDirection: "row", gap: space.sm },
  metric: { flex: 1, alignItems: "center", gap: 4 },
  metricVal: { color: colors.text, fontSize: 18, fontWeight: "800" },
  metricLabel: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  times: { gap: space.sm, width: "100%" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  timeLabel: { color: colors.textMuted, fontSize: 14, flex: 1 },
  timeVal: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 4,
  },
  btnText: { color: "#2a160c", fontWeight: "700" },
});
