import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../../src/constants/api";
import { api } from "../../src/services/api";
import type { InventoryItem } from "../../src/types/inventory";

function normalizeImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  return imageUrl.startsWith("http") ? imageUrl : `${API_BASE_URL}${imageUrl}`;
}

function getAvailabilityCount(item: InventoryItem) {
  return item.units?.filter((unit) => unit.status === "available").length ?? 0;
}

function getTotalCount(item: InventoryItem) {
  return item.units?.length ?? item.quantity ?? 0;
}

export default function ItemDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const itemId = params.id;

  const fetchItem = useCallback(async () => {
    if (!itemId) {
      setErrorMessage("Missing item identifier.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data } = await api.get<InventoryItem[]>("/api/inventory/");
      const matchedItem = Array.isArray(data)
        ? data.find((inventoryItem) => String(inventoryItem.id) === String(itemId))
        : null;

      if (!matchedItem) {
        setItem(null);
        setErrorMessage("Item not found.");
        return;
      }

      setItem(matchedItem);
    } catch (error: any) {
      console.error("Error fetching item details:", error?.response?.data || error?.message || error);
      setItem(null);
      setErrorMessage("Unable to load item details.");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const availableCount = useMemo(() => (item ? getAvailabilityCount(item) : 0), [item]);
  const totalCount = useMemo(() => (item ? getTotalCount(item) : 0), [item]);
  const imageUrl = normalizeImageUrl(item?.image_url);

  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Loading item details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !item) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={42} color="#ef4444" />
          <Text style={styles.stateTitle}>Item unavailable</Text>
          <Text style={styles.stateText}>{errorMessage || "The selected item could not be loaded."}</Text>
          <Pressable onPress={() => void fetchItem()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </Pressable>
          <Text style={styles.topBarLabel}>Item Details</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroImageWrapper}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={styles.heroImageFallback}>
                <Ionicons
                  name={item.category?.toLowerCase() === "instrument" ? "musical-notes" : "shirt"}
                  size={52}
                  color="#94a3b8"
                />
              </View>
            )}
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.categoryLabel}>{item.category || "Item"}</Text>
            <Text style={styles.itemName}>{item.name}</Text>

            <View style={styles.statusRow}>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, availableCount > 0 ? styles.statusAvailable : styles.statusUnavailable]} />
                <Text style={styles.statusText}>{availableCount > 0 ? `${availableCount} available` : "All borrowed"}</Text>
              </View>
              <Text style={styles.totalText}>{totalCount} total</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.infoGrid}>
            <InfoTile label="Category" value={item.category || "Item"} />
            <InfoTile label="Group" value={item.collection_group || "N/A"} />
            <InfoTile label="Available" value={String(availableCount)} />
            <InfoTile label="Total" value={String(totalCount)} />
          </View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Units</Text>
          {item.units && item.units.length > 0 ? (
            <View style={styles.unitList}>
              {item.units.map((unit, index) => {
                const isAvailable = unit.status === "available";

                return (
                  <View key={String(unit.id)}>
                    {index > 0 ? <View style={styles.unitSeparator} /> : null}
                    <View style={styles.unitRow}>
                      <View>
                        <Text style={styles.unitTitle}>
                          {unit.unit_number ? `#${unit.unit_number}` : `Unit ${index + 1}`}
                        </Text>
                        <Text style={styles.unitSubtitle}>{unit.size ? unit.size : "No size"}</Text>
                      </View>
                      <Text style={[styles.unitStatus, isAvailable ? styles.unitAvailable : styles.unitUnavailable]}>
                        {isAvailable ? "Available" : unit.status || "Unknown"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyUnitsText}>No unit records are available for this item.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  heroCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroImageWrapper: {
    height: 260,
    backgroundColor: "#e2e8f0",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  heroBody: {
    padding: 16,
    gap: 10,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748b",
  },
  itemName: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    color: "#0f172a",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusAvailable: {
    backgroundColor: "#22c55e",
  },
  statusUnavailable: {
    backgroundColor: "#ef4444",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  totalText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  sectionCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoTile: {
    width: "48%",
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: "#334155",
  },
  unitSeparator: {
    height: 10,
  },
  unitList: {
    gap: 0,
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  unitTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  unitSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  unitStatus: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  unitAvailable: {
    color: "#16a34a",
  },
  unitUnavailable: {
    color: "#dc2626",
  },
  emptyUnitsText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2563eb",
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});