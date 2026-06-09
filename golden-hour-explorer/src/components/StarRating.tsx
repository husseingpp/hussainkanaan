import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/theme";

export function StarRating({
  value,
  size = 18,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (n: number) => void;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Text style={{ fontSize: size, color: filled ? colors.star : colors.textFaint }}>
            {filled ? "★" : "☆"}
          </Text>
        );
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: 3 } });
