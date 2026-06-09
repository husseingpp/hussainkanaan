import { Stack } from "expo-router";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { TweaksProvider } from "@/lib/tweaks";
import { configureNotifications } from "@/lib/notifications";
import { colors } from "@/theme/theme";

configureNotifications();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  // Preload the icon fonts so Feather/Ionicons glyphs render on native (without
  // this they show as tofu/bracket fallbacks). Web auto-injects @font-face, so
  // only gate the first render on native.
  const [fontsLoaded] = useFonts({ ...Feather.font, ...Ionicons.font });
  if (!fontsLoaded && Platform.OS !== "web") return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TweaksProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="spot/[id]" />
                <Stack.Screen name="daily/[id]" />
                <Stack.Screen name="admin" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="submit" options={{ presentation: "modal" }} />
                <Stack.Screen name="add-daily" options={{ presentation: "modal" }} />
                <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
                <Stack.Screen name="weather" options={{ presentation: "modal" }} />
              </Stack>
            </TweaksProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
