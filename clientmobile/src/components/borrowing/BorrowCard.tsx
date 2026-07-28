import { memo, useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/api";
import type { BorrowHistoryRecord } from "../../types/borrowHistory";
import BorrowStatusBadge from "./BorrowStatusBadge";

function normalizeImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  return imageUrl.startsWith("http") ? imageUrl : `${API_BASE_URL}${imageUrl}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const BorrowCard = memo(function BorrowCard({
  record,
  onPress,
  onReturnPress,
  onViewPhotosPress,
  highlighted = false,
}: {
  record: BorrowHistoryRecord;
  onPress: (record: BorrowHistoryRecord) => void;
  onReturnPress?: (record: BorrowHistoryRecord) => void;
  onViewPhotosPress?: (record: BorrowHistoryRecord) => void;
  highlighted?: boolean;
}) {
  const firstItem = record.items?.[0];
  const imageUrl = useMemo(() => normalizeImageUrl(firstItem?.image_url || null), [firstItem?.image_url]);
  const itemName = firstItem?.item_name || firstItem?.name || "Borrow record";
  const category = firstItem?.category || firstItem?.garment_type || "Item";
  const quantity = record.items?.length ?? 0;

  return (
    <Pressable
      onPress={() => onPress(record)}
      style={({ pressed }) => [
        styles.card,
        highlighted && styles.cardHighlighted,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.receiptHeader}>
        <View style={styles.headerMain}>
          <Text style={styles.requestId}>Req #{String(record.request_id)}</Text>
          <Text style={styles.itemName} numberOfLines={2}>
            {itemName}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {category}
          </Text>
        </View>
        <View style={styles.headerBadgeWrap}>
          <BorrowStatusBadge status={record.status} />
          {record.is_overdue ? <Text style={styles.overdueText}>Overdue</Text> : null}
        </View>
      </View>

      <View style={styles.receiptBody}>
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="cube-outline" size={24} color="#94a3b8" />
            </View>
          )}
        </View>

        <View style={styles.detailsWrap}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Borrowed</Text>
            <Text style={styles.detailValue}>{formatDate(record.request_date || record.created_at)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due</Text>
            <Text style={styles.detailValue}>{formatDate(record.due_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Returned</Text>
            <Text style={styles.detailValue}>{formatDate(record.returned_at)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Qty</Text>
            <Text style={styles.detailValue}>{quantity}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <Text style={styles.footerText} numberOfLines={1}>
          {record.items.map((item) => item.unit_number || item.unit_id || item.id).filter(Boolean).join(", ") || "No unit details"}
        </Text>
        <Text style={styles.footerAccent}>Receipt</Text>
      </View>

      <View style={styles.actionRow}>
        {record.status === "approved" && onReturnPress ? (
          <Pressable onPress={() => onReturnPress(record)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Return Items</Text>
          </Pressable>
        ) : null}

        {record.status === "returned" && onViewPhotosPress ? (
          <Pressable onPress={() => onViewPhotosPress(record)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>View Photos</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHighlighted: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  cardPressed: {
    opacity: 0.92,
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerMain: {
    flex: 1,
    gap: 4,
  },
  requestId: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    lineHeight: 22,
  },
  category: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  headerBadgeWrap: {
    alignItems: "flex-end",
    gap: 4,
  },
  overdueText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#dc2626",
  },
  receiptBody: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  imageWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  detailsWrap: {
    flex: 1,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    flexShrink: 1,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    flex: 1,
  },
  footerAccent: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
  },
});

export default BorrowCard;
