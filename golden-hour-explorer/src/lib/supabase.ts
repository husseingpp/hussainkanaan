import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/**
 * Persist the auth session in the device keychain via expo-secure-store.
 * Note: SecureStore values are capped (~2KB on Android); Supabase sessions fit
 * comfortably for email/password + publishable-key auth used here.
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/**
 * On web, expo-secure-store has no implementation — persist to localStorage
 * instead so the session survives reloads and the OAuth redirect can complete.
 */
const WebStorageAdapter = {
  getItem: (key: string) =>
    Promise.resolve(
      typeof localStorage !== "undefined" ? localStorage.getItem(key) : null,
    ),
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return Promise.resolve();
  },
};

const isWeb = Platform.OS === "web";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isWeb ? WebStorageAdapter : SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // On web the Google OAuth redirect returns the tokens in the URL hash —
    // let supabase-js parse and store them so the session completes. Native
    // handles the redirect manually in signInWithGoogle().
    detectSessionInUrl: isWeb,
  },
});
