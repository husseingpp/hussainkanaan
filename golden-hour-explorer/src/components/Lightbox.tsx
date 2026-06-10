import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A minimal full-screen image viewer. Shows each image uncropped (contain) on a
 * black backdrop and pages horizontally through `images` when there's more than
 * one — swipe on touch, on-screen arrows on web. Tapping an image or the close
 * control dismisses. Built on the core RN Modal so it works identically on web
 * and native.
 */
export function Lightbox({
  visible,
  images,
  index = 0,
  onClose,
}: {
  visible: boolean;
  images: string[];
  index?: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(index);

  // Jump to the requested image whenever the viewer opens.
  useEffect(() => {
    if (!visible) return;
    setPage(index);
    const id = setTimeout(
      () => scrollRef.current?.scrollTo({ x: index * width, animated: false }),
      0,
    );
    return () => clearTimeout(id);
  }, [visible, index, width]);

  if (!images.length) return null;

  const multi = images.length > 1;

  function go(delta: number) {
    const next = Math.min(images.length - 1, Math.max(0, page + delta));
    setPage(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={multi}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {images.map((uri, i) => (
            <Pressable key={`${uri}-${i}`} style={{ width, height }} onPress={onClose}>
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={150}
              />
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Feather name="x" size={24} color="#fff" />
        </Pressable>

        {multi ? (
          <View style={[styles.counter, { bottom: insets.bottom + 20 }]} pointerEvents="none">
            <Text style={styles.counterText}>
              {page + 1} / {images.length}
            </Text>
          </View>
        ) : null}

        {Platform.OS === "web" && multi ? (
          <>
            {page > 0 ? (
              <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => go(-1)}>
                <Feather name="chevron-left" size={30} color="#fff" />
              </Pressable>
            ) : null}
            {page < images.length - 1 ? (
              <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => go(1)}>
                <Feather name="chevron-right" size={30} color="#fff" />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  close: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  counterText: { color: "#fff", fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLeft: { left: 18 },
  arrowRight: { right: 18 },
});
