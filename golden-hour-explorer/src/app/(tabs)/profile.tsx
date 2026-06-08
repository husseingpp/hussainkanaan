import { Link } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Glass } from "@/components/Glass";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radius, space } from "@/theme/theme";

const BADGES = [
  { emoji: "🌄", name: "Dawn Chaser", desc: "Logged a sunrise spot" },
  { emoji: "🌇", name: "Golden Hour", desc: "Rated five sunsets" },
  { emoji: "🧭", name: "Explorer", desc: "Visited ten spots" },
  { emoji: "📸", name: "Storyteller", desc: "Shared a daily moment" },
];

export default function ProfileScreen() {
  const { user, canContribute, isAdmin, signOut } = useAuth();
  const isWeb = Platform.OS === "web";
  // The admin queue is a web-only screen; only surface the entry there.
  const showAdminLink = isWeb && isAdmin;

  return (
    <Screen title="Profile">
      <ScrollView contentContainerStyle={styles.body}>
        <Glass style={styles.card}>
          <Text style={styles.name}>
            {user ? user.email ?? "Signed in" : "Browsing as guest"}
          </Text>
          <Text style={styles.sub}>
            {user
              ? canContribute
                ? "Verified — you can submit and rate spots."
                : "Confirm your email to submit and rate spots."
              : "Read-only access. Sign in to contribute."}
          </Text>
          {user ? (
            <Pressable style={styles.btn} onPress={signOut}>
              <Text style={styles.btnText}>Sign out</Text>
            </Pressable>
          ) : (
            <Link href="/sign-in" style={styles.btnLink}>
              Sign in / create account
            </Link>
          )}
        </Glass>

        {isWeb ? (
          <Link href="/settings" style={styles.adminLink}>
            ⚙︎ Appearance
          </Link>
        ) : null}

        {showAdminLink ? (
          <Link href="/admin" style={styles.adminLink}>
            🛡️ Open moderation queue
          </Link>
        ) : null}

        <Text style={styles.h}>Badges</Text>
        <View style={styles.badges}>
          {BADGES.map((b) => (
            <Glass key={b.name} style={styles.badge}>
              <Text style={styles.badgeEmoji}>{b.emoji}</Text>
              <Text style={styles.badgeName}>{b.name}</Text>
              <Text style={styles.badgeDesc}>{b.desc}</Text>
            </Glass>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: 120, gap: space.lg },
  card: { gap: 8 },
  name: { fontFamily: fonts.display, color: colors.text, fontSize: 21, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  btn: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  btnText: { color: colors.text, fontWeight: "600" },
  adminLink: {
    alignSelf: "flex-start",
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontWeight: "700",
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  btnLink: {
    marginTop: 6,
    alignSelf: "flex-start",
    color: "#2a160c",
    backgroundColor: colors.accent,
    fontWeight: "700",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  h: { fontFamily: fonts.display, color: colors.text, fontSize: 19, fontWeight: "600" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  badge: { width: "47%", alignItems: "flex-start", gap: 4 },
  badgeEmoji: { fontSize: 28 },
  badgeName: { color: colors.text, fontWeight: "700", fontSize: 14 },
  badgeDesc: { color: colors.textFaint, fontSize: 12 },
});
