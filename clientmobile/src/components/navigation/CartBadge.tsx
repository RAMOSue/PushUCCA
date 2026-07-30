import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type CartBadgeProps = {
  count: number;
  pulseKey?: number;
  direction?: "in" | "out";
};

export default function CartBadge({ count, pulseKey, direction = "in" }: CartBadgeProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulseKey) {
      return;
    }

    Animated.parallel([
      Animated.timing(scale, {
        toValue: direction === "out" ? 0.75 : 1.22,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: direction === "out" ? 3 : -3,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [direction, pulseKey, scale, translateY]);

  if (!count || count <= 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale }, { translateY }] }]}>
      <Text style={styles.text}>{count > 99 ? "99+" : String(count)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  text: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
  },
});