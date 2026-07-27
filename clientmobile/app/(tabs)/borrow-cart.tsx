import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { DeviceEventEmitter } from "react-native";
import { useAuth } from "../../src/hooks/useAuth";
import { API_BASE_URL } from "../../src/constants/api";
import {
  fetchReservedBorrowCart,
  removeBorrowCartItem,
  submitBorrowCart,
} from "../../src/services/borrowCart";
import type { BorrowCartItem } from "../../src/types/borrowCart";

function normalizeImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  return imageUrl.startsWith("http") ? imageUrl : `${API_BASE_URL}${imageUrl}`;
}

function getUnitLabel(item: BorrowCartItem) {
  if (item.unit_number) {
    return `#${item.unit_number}`;
  }

  if (item.unit_id && String(item.unit_id).startsWith("temp-")) {
    return "Temporary unit";
  }

  return `Unit ${String(item.unit_id).slice(0, 8)}`;
}

export default function BorrowCartScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState<BorrowCartItem[]>([]);
  const [requestId, setRequestId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cartCount = useMemo(() => cartItems.length, [cartItems]);
  const totalItemCount = useMemo(() => cartItems.length, [cartItems]);

  const fetchCart = useCallback(async () => {
    if (!user?.id) {
      setCartItems([]);
      setRequestId(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchReservedBorrowCart(user.id);
      setCartItems(Array.isArray(data.items) ? data.items : []);
      setRequestId(data.request_id ?? null);
    } catch (error: any) {
      console.error("Error fetching borrow cart:", error?.response?.data || error?.message || error);
      setErrorMessage("Unable to load your borrow cart.");
      setCartItems([]);
      setRequestId(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchCart();
  }, [fetchCart]);

  useFocusEffect(
    useCallback(() => {
      void fetchCart();
    }, [fetchCart])
  );

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("mobile:refresh", (payload) => {
      if (payload?.screen && payload.screen !== "all" && payload.screen !== "borrow-cart") {
        return;
      }

      void fetchCart();
    });

    return () => subscription.remove();
  }, [fetchCart]);

  const handleRemoveItem = useCallback(
    async (item: BorrowCartItem) => {
      if (!user?.id) {
        return;
      }

      const payload = { borrower_id: String(user.id) } as { borrower_id: string; unit_id?: string | number; item_id?: string | number };
      const unitId = item.unit_id ?? item.unitId;

      if (unitId && !String(unitId).startsWith("temp-")) {
        payload.unit_id = unitId;
      } else {
        payload.item_id = item.item_id ?? item.itemId;
      }

      try {
        await removeBorrowCartItem(payload);
        await fetchCart();
      } catch (error: any) {
        console.error("Error removing borrow cart item:", error?.response?.data || error?.message || error);
        Alert.alert("Could not remove item", error?.response?.data?.error || "Please try again.");
      }
    },
    [fetchCart, user?.id]
  );

  const handleSubmitRequest = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert("Your cart is empty", "Add an item before submitting your borrow request.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await submitBorrowCart({
        borrower_id: String(user.id),
        request_id: requestId,
        items: cartItems.map((item) => ({
          unit_id: item.unit_id ?? item.unitId,
          item_id: item.item_id ?? item.itemId,
          quantity: 1,
        })),
        quantity: cartItems.length,
        finalQuantity: cartItems.length,
        item_count: cartItems.length,
      });

      if (response?.success) {
        Alert.alert("Request submitted", response.message || "Your borrow request was submitted successfully.");
        await fetchCart();
        router.push("/(tabs)/borrowed");
        return;
      }

      Alert.alert("Submission failed", response?.error || "Unable to submit your borrow request.");
    } catch (error: any) {
      console.error("Error submitting borrow request:", error?.response?.data || error?.message || error);
      Alert.alert("Submission failed", error?.response?.data?.error || "Unable to submit your borrow request.");
    } finally {
      setSubmitting(false);
    }
  }, [cartItems, fetchCart, requestId, user?.id]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Loading borrow cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateContainer}>
          <Ionicons name="cart-outline" size={42} color="#ef4444" />
          <Text style={styles.stateTitle}>Borrow cart unavailable</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <Pressable onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={cartItems}
        keyExtractor={(item) => String(item.unit_id ?? item.unitId)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
        contentContainerStyle={[styles.content, cartItems.length === 0 && styles.emptyContent]}
        ListHeaderComponent={null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={42} color="#94a3b8" />
            <Text style={styles.stateTitle}>Your cart is empty</Text>
            <Text style={styles.stateText}>Add items from Available Items to begin borrowing.</Text>
            <Pressable onPress={() => router.push("/(tabs)/available-items")} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Continue Borrowing</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const imageUrl = normalizeImageUrl(item.image_url);
          const status = item.status || "reserved";

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.imageWrap}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <View style={styles.imageFallback}>
                      <Ionicons
                        name={(item.category || item.garment_type || "").toLowerCase() === "instrument" ? "musical-notes" : "shirt"}
                        size={28}
                        color="#94a3b8"
                      />
                    </View>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.categoryLabel} numberOfLines={1}>
                    {item.category || item.garment_type || "Item"}
                  </Text>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.unitLabel} numberOfLines={1}>
                    Selected Unit: {getUnitLabel(item)}
                  </Text>
                  <Text style={styles.statusLabel}>Borrow Status: {status}</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <Pressable onPress={() => void handleRemoveItem(item)} style={styles.removeButton}>
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  <Text style={styles.removeButtonText}>Remove from cart</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <View style={styles.footerSummary}>
          <Text style={styles.footerSummaryText}>Units: {cartCount}</Text>
          <Text style={styles.footerSummaryText}>Items: {totalItemCount}</Text>
          {requestId ? <Text style={styles.footerSummaryText}>Request #{String(requestId)}</Text> : null}
        </View>

        <View style={styles.footerButtons}>
          <Pressable onPress={() => router.push("/(tabs)/available-items")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Continue Borrow</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSubmitRequest()}
            disabled={submitting || cartItems.length === 0}
            style={({ pressed }) => [
              styles.primaryButton,
              (submitting || cartItems.length === 0) && styles.primaryButtonDisabled,
              pressed && !(submitting || cartItems.length === 0) && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Submitting..." : "Submit Request"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
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
    marginTop: 4,
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
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffffff",
  },
  card: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  imageWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748b",
  },
  itemName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  unitLabel: {
    fontSize: 13,
    color: "#334155",
    marginTop: 2,
  },
  statusLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fef2f2",
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#dc2626",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  footerSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  footerSummaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  footerButtons: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
});