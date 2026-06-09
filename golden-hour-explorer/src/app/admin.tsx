import { Redirect } from "expo-router";

/**
 * Admin moderation is a web-only feature. On native this route immediately
 * redirects back into the app; the real screen lives in `admin.web.tsx`, which
 * Metro resolves for the web bundle.
 */
export default function AdminNativeStub() {
  return <Redirect href="/(tabs)/map" />;
}
