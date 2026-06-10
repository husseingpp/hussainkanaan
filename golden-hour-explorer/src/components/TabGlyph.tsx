import Feather from "@expo/vector-icons/Feather";
import type { ColorValue } from "react-native";

/** The five icons used by the bottom tab bar. */
export type TabGlyphName = "map" | "compass" | "camera" | "heart" | "user";

/**
 * Tab-bar glyph. On native the icon font is preloaded (and the app render is
 * gated on it) so Feather is reliable. The web build draws inline SVG instead
 * (see TabGlyph.web.tsx) because the tab bar mounts before the icon font is
 * ready and never repaints — which left the glyphs as fallback brackets.
 */
export function TabGlyph({
  name,
  size = 20,
  color,
}: {
  name: TabGlyphName;
  size?: number;
  color: ColorValue;
}) {
  return <Feather name={name} size={size} color={color as string} />;
}
