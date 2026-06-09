import { Redirect } from "expo-router";

/**
 * Appearance settings are a web-only feature. On native this route redirects
 * back into the app; the real screen lives in `settings.web.tsx`.
 */
export default function SettingsNativeStub() {
  return <Redirect href="/(tabs)/map" />;
}
