import { View, Text, StyleSheet } from "react-native";

type CartBadgeProps = {
  count: number;
};

export default function CartBadge({ count }: CartBadgeProps) {
  if (!count || count <= 0) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? "99+" : String(count)}</Text>
    </View>
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