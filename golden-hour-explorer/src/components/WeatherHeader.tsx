import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { Glass } from "@/components/Glass";
import { fetchWeather, scoreLabel, skyScore } from "@/lib/weather";
import { fmtTime, nextGoldenHour } from "@/lib/solar";
import { colors, fonts, radius, space } from "@/theme/theme";

type Coords = { latitude: number; longitude: number };
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * A compact "sky conditions where you are" banner for the Explore and Map tabs.
 * Reuses fetchWeather/skyScore and the solar helpers. Degrades gracefully when
 * location is unavailable — never blocks or crashes the host screen. Works on
 * web too (expo-location proxies to the browser Geolocation API).
 */
export function WeatherHeader({ style }: { style?: object }) {
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

  // On mount, use location only if already granted — no surprise permission prompt.
  useEffect(() => {
    locate(false);
  }, []);

  const weather = useQuery({
    queryKey: ["weather", "me", coords && round(coords.latitude), coords && round(coords.longitude)],
    queryFn: () => fetchWeather(coords!.latitude, coords!.longitude),
    enabled: !!coords,
    staleTime: 10 * 60 * 1000,
  });

  // No location yet: prompt to enable (tap = user gesture, reliable on web).
  if (!coords) {
    return (
      <Glass style={[styles.banner, style]}>
        {denied ? (
          <Pressable style={styles.enable} onPress={() => locate(true)}>
            <Text style={styles.enableText}>📍 Enable location for live sky conditions</Text>
          </Pressable>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Checking the sky…</Text>
          </>
        )}
      </Glass>
    );
  }

  if (weather.isLoading) {
    return (
      <Glass style={[styles.banner, style]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Checking the sky…</Text>
      </Glass>
    );
  }

  if (weather.error || !weather.data) {
    return (
      <Glass style={[styles.banner, style]}>
        <Text style={styles.muted}>Sky forecast unavailable right now.</Text>
      </Glass>
    );
  }

  const score = skyScore(weather.data);
  const next = nextGoldenHour(coords.latitude, coords.longitude);

  return (
    <Glass style={[styles.banner, style]}>
      <View style={styles.scoreCol}>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.scoreMax}>/100</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>{scoreLabel(score)} sky · where you are</Text>
        <Text style={styles.muted}>
          {Math.round(weather.data.cloudCover)}% cloud · {Math.round(weather.data.windSpeed)} km/h
          wind
        </Text>
      </View>
      {next ? (
        <View style={styles.nextCol}>
          <Text style={styles.nextTime}>{fmtTime(next.at)}</Text>
          <Text style={styles.nextLabel}>{next.label.replace(" golden hour", "")}</Text>
        </View>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
  },
  enable: { flex: 1 },
  enableText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  muted: { color: colors.textMuted, fontSize: 13 },
  scoreCol: { flexDirection: "row", alignItems: "baseline" },
  score: { fontFamily: fonts.display, color: colors.accent, fontSize: 30, fontWeight: "600" },
  scoreMax: { color: colors.textFaint, fontSize: 13, fontWeight: "600" },
  info: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  nextCol: { alignItems: "flex-end" },
  nextTime: { color: colors.text, fontSize: 16, fontWeight: "700" },
  nextLabel: { color: colors.textMuted, fontSize: 11, textTransform: "capitalize" },
});
