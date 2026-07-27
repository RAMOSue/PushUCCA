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
}: {
  record: BorrowHistoryRecord;
  onPress: (record: BorrowHistoryRecord) => void;
  onReturnPress?: (record: BorrowHistoryRecord) => void;
  onViewPhotosPress?: (record: BorrowHistoryRecord) => void;
}) {
  const firstItem = record.items?.[0];
  const imageUrl = useMemo(() => normalizeImageUrl(firstItem?.image_url || null), [firstItem?.image_url]);

  return (
    <Pressable onPress={() => onPress(record)} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="cube-outline" size={26} color="#94a3b8" />
            </View>
          )}
        </View>

        <View style={styles.contentWrap}>
          <Text style={styles.itemName} numberOfLines={2}>
            {firstItem?.item_name || firstItem?.name || "Borrow record"}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {firstItem?.category || firstItem?.garment_type || "Item"}
          </Text>
          <View style={styles.badgeRow}>
            <BorrowStatusBadge status={record.status} />
            {record.is_overdue ? <Text style={styles.overdueText}>Overdue</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Borrowed</Text>
          <Text style={styles.metaValue}>{formatDate(record.request_date || record.created_at)}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Due</Text>
          <Text style={styles.metaValue}>{formatDate(record.due_date)}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Returned</Text>
          <Text style={styles.metaValue}>{formatDate(record.returned_at)}</Text>
        </View>
      </View>

      <View style={styles.unitRow}>
        <Text style={styles.unitText} numberOfLines={1}>
          Units: {record.items.length}
        </Text>
        <Text style={styles.unitText} numberOfLines={1}>
          {record.items.map((item) => item.unit_number || item.unit_id || item.id).filter(Boolean).join(", ") || "No unit details"}
        </Text>
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
  topRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  imageWrap: {
    width: 70,
    height: 70,
    borderRadius: 16,
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
  contentWrap: {
    flex: 1,
    gap: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
  },
  category: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  overdueText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#dc2626",
  },
  metaGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metaCell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  unitRow: {
    gap: 4,
  },
  unitText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
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
