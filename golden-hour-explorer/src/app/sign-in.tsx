import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { colors, radius, space } from "@/theme/theme";

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, user, loading } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");

  // Handles the web Google OAuth flow: after the provider redirects back,
  // detectSessionInUrl sets the session asynchronously — this effect is the
  // only thing that navigates away from the sign-in screen once it lands.
  // router.replace avoids leaving /sign-in in the back stack.
  useEffect(() => {
    if (!loading && user) router.replace("/map");
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res =
      mode === "in"
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(
            email.trim(),
            password,
            name.trim() || email.split("@")[0],
          );
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    if (mode === "up") {
      setMsg("Account created — check your email to confirm it, then sign in.");
      setMode("in");
      return;
    }
    router.back();
  }

  async function google() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await signInWithGoogle();
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    // Web redirects away; native returns here with a session set.
    if (Platform.OS !== "web") router.back();
  }

  return (
    <Screen title={mode === "in" ? "Sign in" : "Create account"} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Contributing (submitting spots, rating, commenting) needs a confirmed email.
            You can keep browsing as a guest without an account.
          </Text>

          {mode === "up" ? (
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          <Pressable style={styles.primary} onPress={submit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#2a160c" />
            ) : (
              <Text style={styles.primaryText}>
                {mode === "in" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>or</Text>
            <View style={styles.line} />
          </View>

          <Pressable style={styles.google} onPress={google} disabled={busy}>
            <Ionicons name="logo-google" size={18} color={colors.text} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>

          <Pressable onPress={() => setMode(mode === "in" ? "up" : "in")}>
            <Text style={styles.switch}>
              {mode === "in"
                ? "No account? Create one"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.guest}>Continue as guest</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
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
  err: { color: colors.danger, fontSize: 13 },
  msg: { color: colors.good, fontSize: 13 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#2a160c", fontWeight: "700", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: space.sm, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { color: colors.textFaint, fontSize: 12, fontWeight: "600" },
  google: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.bg2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 13,
  },
  googleText: { color: colors.text, fontWeight: "700", fontSize: 15 },
  switch: { color: colors.accent, textAlign: "center", marginTop: 4 },
  guest: { color: colors.textFaint, textAlign: "center", marginTop: space.sm },
});
