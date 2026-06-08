import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { configureNotifications } from "@/lib/notifications";
import { colors } from "@/theme/theme";

configureNotifications();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="spot/[id]" />
              <Stack.Screen name="admin" />
              <Stack.Screen name="submit" options={{ presentation: "modal" }} />
              <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
