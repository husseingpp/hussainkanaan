import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { format } from "date-fns";
import { getSolarTimes } from "@/lib/solar";
import { fetchWeather } from "@/lib/weather";
import { colors, fonts, radius, space } from "@/theme/theme";

type Coords = { latitude: number; longitude: number };
const round = (n: number) => Math.round(n * 10) / 10;

function conditionLabel(cloudCover: number): string {
  if (cloudCover < 12) return "Clear sky";
  if (cloudCover < 40) return "Partly cloudy";
  if (cloudCover < 75) return "Cloudy";
  return "Overcast";
}

/** "3h 40m" until the next sunrise (today's if still ahead, else tomorrow's). */
function nextSunriseIn(lat: number, lng: number, now: Date): string | null {
  const today = getSolarTimes(lat, lng, now);
  const tomorrow = getSolarTimes(lat, lng, new Date(now.getTime() + 86_400_000));
  const sunrise = today.sunrise.getTime() > now.getTime() ? today.sunrise : tomorrow.sunrise;
  const ms = sunrise.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function Chip({
  icon,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.chip}>
      <Feather name={icon} size={13} color={colors.accent} />
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

/**
 * Persistent app header shown above every tab: the SunSpot wordmark with a live
 * "next sunrise" countdown on the left, and sunrise / sunset / weather chips on
 * the right. Location is used only if already granted (no surprise prompt); the
 * chips appear once it resolves. On narrow screens the solar chips collapse to
 * keep the bar to a single row.
 */
export function TopBar() {
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  const [coords, setCoords] = useState<Coords | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Refresh the countdown each minute.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Locate only if permission is already granted — never prompts on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({});
        if (!cancelled)
          setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        /* no location — chips stay hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enableLocation() {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      /* ignore */
    }
  }

  const weather = useQuery({
    queryKey: ["weather", "me", coords && round(coords.latitude), coords && round(coords.longitude)],
    queryFn: () => fetchWeather(coords!.latitude, coords!.longitude),
    enabled: !!coords,
    staleTime: 10 * 60 * 1000,
  });

  const solar = coords ? getSolarTimes(coords.latitude, coords.longitude, now) : null;
  const countdown = coords ? nextSunriseIn(coords.latitude, coords.longitude, now) : null;

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Feather name="sun" size={18} color={colors.accent} />
          <Text style={styles.wordmark}>SunSpot</Text>
        </View>
        <Text style={styles.tagline}>
          {countdown ? `Next sunrise in ${countdown}` : "Chase the golden hour"}
        </Text>
      </View>

      <View style={styles.spacer} />

      {coords && solar ? (
        <View style={styles.chips}>
          {wide ? (
            <>
              <Chip icon="sunrise">{format(solar.sunrise, "h:mm a")}</Chip>
              <Chip icon="sunset">{format(solar.sunset, "h:mm a")}</Chip>
            </>
          ) : null}
          {weather.data ? (
            <View style={styles.chip}>
              <Feather name="thermometer" size={13} color={colors.accent} />
              <Text style={styles.chipText}>{Math.round(weather.data.temperature)}°</Text>
              <Feather name="cloud" size={13} color={colors.textFaint} style={{ marginLeft: 4 }} />
              <Text style={styles.chipText}>{conditionLabel(weather.data.cloudCover)}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable style={styles.chip} onPress={enableLocation}>
          <Feather name="map-pin" size={13} color={colors.accent} />
          <Text style={styles.chipText}>Enable location</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 30,
  },
  brand: { gap: 2 },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  tagline: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  spacer: { flex: 1 },
  chips: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap", justifyContent: "flex-end" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipText: { color: colors.text, fontSize: 12.5, fontWeight: "700", letterSpacing: 0.3 },
});
