import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { BorrowStatus } from "../../types/borrowHistory";

function getStatusStyles(status: BorrowStatus) {
  switch (status) {
    case "pending":
      return { backgroundColor: "#fff7ed", borderColor: "#fdba74", textColor: "#b45309" };
    case "approved":
      return { backgroundColor: "#eff6ff", borderColor: "#93c5fd", textColor: "#1d4ed8" };
    case "pending_return":
      return { backgroundColor: "#fffbeb", borderColor: "#fcd34d", textColor: "#b45309" };
    case "returned":
      return { backgroundColor: "#f0fdf4", borderColor: "#86efac", textColor: "#15803d" };
    case "rejected":
    case "declined":
      return { backgroundColor: "#fef2f2", borderColor: "#fca5a5", textColor: "#b91c1c" };
    case "cancelled":
    case "canceled":
      return { backgroundColor: "#f8fafc", borderColor: "#cbd5e1", textColor: "#475569" };
    case "borrowed":
      return { backgroundColor: "#eef2ff", borderColor: "#c7d2fe", textColor: "#4338ca" };
    default:
      return { backgroundColor: "#f8fafc", borderColor: "#cbd5e1", textColor: "#475569" };
  }
}

function formatStatusLabel(status: BorrowStatus) {
  switch (status) {
    case "pending_return":
      return "Returning";
    case "rejected":
      return "Rejected";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "borrowed":
      return "Borrowed";
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  }
}

const BorrowStatusBadge = memo(function BorrowStatusBadge({ status }: { status: BorrowStatus }) {
  const { backgroundColor, borderColor, textColor } = getStatusStyles(status);

  return (
    <View style={[styles.badge, { backgroundColor, borderColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{formatStatusLabel(status)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
});

export default BorrowStatusBadge;
