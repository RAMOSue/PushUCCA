import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetModal,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../../src/constants/api";
import { api } from "../../src/services/api";
import { useAuth } from "../../src/hooks/useAuth";
import type {
  InventoryItem,
  InventoryUnit,
  InventoryRecommendation,
} from "../../src/types/inventory";

type CategoryFilter = "all" | "costume" | "instrument" | "accessories";

type DivisionOption = {
  id: string | number;
  name: string;
  status?: string | null;
};

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "costume", label: "Costume" },
  { key: "instrument", label: "Instrument" },
  { key: "accessories", label: "Accessories" },
];

const SIZE_FILTERS = ["small", "medium", "large"];

function normalizeImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  return imageUrl.startsWith("http") ? imageUrl : `${API_BASE_URL}${imageUrl}`;
}

function getAvailabilityCount(item: InventoryItem) {
  return item.units?.filter((unit) => unit.status === "available").length ?? 0;
}

function getAvailabilityLabel(item: InventoryItem) {
  const count = getAvailabilityCount(item);
  return count > 0 ? `${count} avail` : "All borrowed";
}

function getItemDivisionName(item?: InventoryItem | null) {
  if (!item) {
    return null;
  }

  const candidate = (item as InventoryItem & { division?: { name?: string | null } | null; division_name?: string | null; divisionName?: string | null }).division?.name
    ?? (item as InventoryItem & { division?: { name?: string | null } | null; division_name?: string | null; divisionName?: string | null }).division_name
    ?? (item as InventoryItem & { division?: { name?: string | null } | null; division_name?: string | null; divisionName?: string | null }).divisionName;

  return candidate ? String(candidate).trim() : null;
}

function getPerformanceStatus(startTime?: string | null) {
  if (!startTime) {
    return null;
  }

  const now = new Date();
  const performanceDate = new Date(startTime);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const perfDate = new Date(
    performanceDate.getFullYear(),
    performanceDate.getMonth(),
    performanceDate.getDate()
  );

  if (perfDate < today) {
    return "past";
  }

  if (perfDate.getTime() === today.getTime()) {
    return "today";
  }

  return "upcoming";
}

export default function AvailableItems() {
  const { user, isLoading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ search?: string }>();
  const sheetRef = useRef<BottomSheetModal>(null);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [recommendations, setRecommendations] = useState<InventoryRecommendation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<InventoryUnit[]>([]);
  const [unitSearchQuery, setUnitSearchQuery] = useState("");
  const [activeSizeFilter, setActiveSizeFilter] = useState<string | null>(null);
  const [borrowRequestId, setBorrowRequestId] = useState<string | number | null>(null);
  const [borrowMessage, setBorrowMessage] = useState<string | null>(null);
  const [borrowing, setBorrowing] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showDivisionMenu, setShowDivisionMenu] = useState(false);
  const [isFlyingToCart, setIsFlyingToCart] = useState(false);
  const [cartOrigin, setCartOrigin] = useState<{ x: number; y: number } | null>(null);
  const cartFlyAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cardRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    const initialSearch = params.search;
    if (typeof initialSearch === "string" && initialSearch.trim()) {
      setSearchQuery(initialSearch.trim());
    }
  }, [params.search]);

  const fetchRecommendations = useCallback(async () => {
    if (!user?.id || user?.role !== "borrower") {
      setRecommendations([]);
      return;
    }

    try {
      const { data } = await api.get<InventoryRecommendation[]>(
        `/api/performances/recommendations/${user.id}`
      );

      const now = new Date();
      const activeRecommendations = data.filter((recommendation) => {
        if (!recommendation.start_time) {
          return false;
        }

        return new Date(recommendation.start_time) >= now;
      });

      setRecommendations(activeRecommendations);
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        console.error("Error fetching recommendations:", error);
      }
      setRecommendations([]);
    }
  }, [user?.id, user?.role]);

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    setErrorMessage(null);

    try {
      const { data } = await api.get<InventoryItem[]>("/api/inventory/");
      setItems(Array.isArray(data) ? data : []);
      await fetchRecommendations();
    } catch (error: any) {
      console.error("Error fetching items:", error?.response?.data || error?.message || error);
      setErrorMessage("Unable to load available items.");
      setItems([]);
    } finally {
      setLoadingItems(false);
      setRefreshing(false);
    }
  }, [fetchRecommendations]);

  const fetchDivisions = useCallback(async () => {
    try {
      const { data } = await api.get<DivisionOption[]>("/api/inventory/divisions");
      const activeDivisions = Array.isArray(data)
        ? data.filter((division) => (division.status || "Active").toLowerCase() !== "inactive")
        : [];
      setDivisions(activeDivisions);
    } catch (error: any) {
      console.error("Error fetching divisions:", error?.response?.data || error?.message || error);
    }
  }, []);

  const fetchReservedRequest = useCallback(async () => {
    if (!user?.id || user?.role !== "borrower") {
      setBorrowRequestId(null);
      return;
    }

    try {
      const { data } = await api.get(`/api/borrow/reserved/${user.id}`);
      if (data?.success && data?.request_id) {
        setBorrowRequestId(data.request_id);
      } else {
        setBorrowRequestId(null);
      }
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        console.error("Error fetching reserved request:", error);
      }
      setBorrowRequestId(null);
    }
  }, [user?.id, user?.role]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        void fetchItems();
        void fetchDivisions();
        void fetchReservedRequest();
      }
      return undefined;
    }, [authLoading, fetchDivisions, fetchItems, fetchReservedRequest])
  );

  useEffect(() => {
    if (!authLoading) {
      void fetchItems();
      void fetchDivisions();
      void fetchReservedRequest();
    }
  }, [authLoading, fetchDivisions, fetchItems, fetchReservedRequest, user?.id, user?.role]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("mobile:refresh", (payload) => {
      if (payload?.screen && payload.screen !== "all" && payload.screen !== "available-items") {
        return;
      }

      void fetchItems();
      void fetchDivisions();
      void fetchReservedRequest();
    });

    return () => subscription.remove();
  }, [fetchDivisions, fetchItems, fetchReservedRequest]);

  const handleOpenSheet = useCallback((item: InventoryItem) => {
    const availableUnits = item.units?.filter((unit) => unit.status === "available") ?? [];

    setSelectedItem(item);
    setSelectedUnits(availableUnits.length > 0 ? [availableUnits[0]] : []);
    setUnitSearchQuery("");
    setActiveSizeFilter(null);
    setBorrowMessage(null);
    sheetRef.current?.present();
  }, []);

  const handleDismissSheet = useCallback(() => {
    setSelectedItem(null);
    setSelectedUnits([]);
    setUnitSearchQuery("");
    setActiveSizeFilter(null);
    setBorrowMessage(null);
    setBorrowing(false);
  }, []);

  const animateCartToTopBar = useCallback((origin?: { x: number; y: number } | null) => {
    const startPoint = origin ?? cartOrigin ?? { x: 24, y: 140 };
    setCartOrigin(startPoint);
    setIsFlyingToCart(true);
    cartFlyAnim.setValue({ x: 0, y: 0 });

    Animated.timing(cartFlyAnim, {
      toValue: { x: 24, y: 28 },
      duration: 650,
      useNativeDriver: true,
    }).start(() => {
      setIsFlyingToCart(false);
      cartFlyAnim.setValue({ x: 0, y: 0 });
    });
  }, [cartFlyAnim, cartOrigin]);

  const availableSheetUnits = useMemo(() => {
    if (!selectedItem) {
      return [];
    }

    return (selectedItem.units ?? [])
      .filter((unit) => unit.status === "available")
      .filter((unit) => {
        if (!activeSizeFilter) {
          return true;
        }

        return (unit.size || "").toLowerCase() === activeSizeFilter;
      })
      .filter((unit) => {
        if (!unitSearchQuery.trim()) {
          return true;
        }

        const searchLower = unitSearchQuery.trim().toLowerCase();
        return (unit.unit_number || "").toLowerCase().includes(searchLower);
      });
  }, [activeSizeFilter, selectedItem, unitSearchQuery]);

  const selectedRecommendation = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    return recommendations.find((entry) => entry.inventory_item_id === selectedItem.id) ?? null;
  }, [recommendations, selectedItem]);

  const handleToggleUnit = useCallback((unit: InventoryUnit) => {
    setSelectedUnits((previous) => {
      const isSelected = previous.some((entry) => entry.id === unit.id);

      if (isSelected) {
        return previous.filter((entry) => entry.id !== unit.id);
      }

      return [...previous, unit];
    });
  }, []);

  const handleBorrow = useCallback(async () => {
    if (!selectedItem || !user?.id) {
      return;
    }

    const unitsToBorrow = selectedUnits.length > 0 ? selectedUnits : availableSheetUnits.slice(0, 1);

    if (unitsToBorrow.length === 0) {
      setBorrowMessage("No available units to borrow.");
      return;
    }

    setBorrowing(true);
    setBorrowMessage(null);

    try {
      const response = await api.post("/api/borrow/cart", {
        borrower_id: String(user.id),
        request_id: borrowRequestId,
        items: unitsToBorrow.map((unit) => ({
          unit_id: unit.id,
          item_id: selectedItem.id,
          quantity: 1,
        })),
      });

      const responseItems = Array.isArray(response.data?.items) ? response.data.items : [];
      const failedItems = Array.isArray(response.data?.failed_items) ? response.data.failed_items : [];

      if (response.data?.request_id) {
        setBorrowRequestId(response.data.request_id);
      }

      if (responseItems.length > 0) {
        await fetchItems();
        await fetchReservedRequest();

        const successLabel = responseItems.length === 1 ? "1 unit added to cart." : `${responseItems.length} units added to cart.`;
        const failureLabel = failedItems.length > 0 ? ` ${failedItems.length} unit(s) could not be reserved.` : "";

        Alert.alert("Borrow request updated", `${successLabel}${failureLabel}`);
        animateCartToTopBar(cartOrigin);
        DeviceEventEmitter.emit("cart:animate", {
          fromX: cartOrigin?.x ?? 24,
          fromY: cartOrigin?.y ?? 140,
        });
        DeviceEventEmitter.emit("mobile:refresh", { screen: "all" });
        sheetRef.current?.dismiss();
        return;
      }

      const failureText = failedItems.length > 0
        ? failedItems.map((entry: { error?: string }) => entry.error || "Unavailable").join("\n")
        : response.data?.error || "Unable to reserve selected units.";

      setBorrowMessage(failureText);
    } catch (error: any) {
      const failedItems = error?.response?.data?.failed_items;
      const failureText = Array.isArray(failedItems) && failedItems.length > 0
        ? failedItems.map((entry: { error?: string }) => entry.error || "Unavailable").join("\n")
        : error?.response?.data?.error || error?.message || "Unable to reserve selected units.";

      setBorrowMessage(failureText);
    } finally {
      setBorrowing(false);
    }
  }, [animateCartToTopBar, availableSheetUnits, borrowRequestId, cartOrigin, fetchItems, fetchReservedRequest, selectedItem, selectedUnits, user?.id]);

  const renderSheetFooter = useCallback(
    (footerProps: BottomSheetFooterProps) => (
      <BottomSheetFooter {...footerProps} bottomInset={12}>
        <View style={styles.sheetFooter}>
          {borrowMessage ? <Text style={styles.sheetFooterMessage}>{borrowMessage}</Text> : null}
          <Pressable
            onPress={() => void handleBorrow()}
            disabled={borrowing || selectedUnits.length === 0 || !selectedItem}
            style={({ pressed }) => [
              styles.borrowButton,
              (borrowing || selectedUnits.length === 0 || !selectedItem) && styles.borrowButtonDisabled,
              pressed && !(borrowing || selectedUnits.length === 0 || !selectedItem) && styles.borrowButtonPressed,
            ]}
          >
            <Text style={styles.borrowButtonText}>
              {borrowing ? "Borrowing..." : selectedUnits.length > 0 ? `Borrow (${selectedUnits.length})` : "Borrow"}
            </Text>
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [borrowMessage, borrowing, handleBorrow, selectedItem, selectedUnits.length]
  );

  const filteredItems = useMemo(() => {
    let nextItems = [...items];

    if (selectedCategory !== "all") {
      nextItems = nextItems.filter((item) =>
        (item.category || "").toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    if (searchQuery.trim()) {
      const searchLower = searchQuery.trim().toLowerCase();
      nextItems = nextItems.filter((item) => item.name?.toLowerCase().includes(searchLower));
    }

    if (selectedDivision) {
      const selectedDivisionName = selectedDivision.trim().toLowerCase();
      nextItems = nextItems.filter((item) => {
        const divisionName = getItemDivisionName(item)?.trim().toLowerCase();
        return divisionName === selectedDivisionName;
      });
    }

    if (user?.role === "borrower" && recommendations.length > 0) {
      const recommendedIds = new Set(
        recommendations.map((recommendation) => recommendation.inventory_item_id)
      );

      nextItems.sort((left, right) => {
        const leftRecommended = recommendedIds.has(left.id);
        const rightRecommended = recommendedIds.has(right.id);

        if (leftRecommended && !rightRecommended) return -1;
        if (!leftRecommended && rightRecommended) return 1;
        return 0;
      });
    }

    return nextItems;
  }, [items, recommendations, searchQuery, selectedCategory, selectedDivision, user?.role]);

  const recommendedItemIds = useMemo(() => {
    return new Set(recommendations.map((recommendation) => recommendation.inventory_item_id));
  }, [recommendations]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchItems();
    void fetchDivisions();
    void fetchReservedRequest();
  }, [fetchDivisions, fetchItems, fetchReservedRequest]);

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const imageUrl = normalizeImageUrl(item.image_url);
    const isRecommended = recommendedItemIds.has(item.id);
    const recommendation = recommendations.find(
      (entry) => entry.inventory_item_id === item.id
    );
    const recommendationStatus = recommendation ? getPerformanceStatus(recommendation.start_time) : null;
    const showRecommendation = Boolean(recommendation && recommendationStatus !== "past");
    const availabilityCount = getAvailabilityCount(item);
    const divisionName = getItemDivisionName(item);
    const categoryLabel = (item.category || "Item")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    const cardLabel = divisionName ? `${divisionName} • ${categoryLabel}` : categoryLabel;

    return (
      <Pressable
        onPress={() => {
          const target = cardRefs.current[String(item.id)];
          if (target) {
            target.measureInWindow((x, y, width, height) => {
              setCartOrigin({ x: x + width / 2 - 20, y: y + height / 2 - 20 });
            });
          }
          handleOpenSheet(item);
        }}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
      >
        <View
          ref={(ref) => {
            cardRefs.current[String(item.id)] = ref;
          }}
          style={[styles.card, isRecommended && styles.recommendedCard]}
        >
          <View style={styles.imageWrapper}>
            {showRecommendation && recommendation && (
              <View style={styles.recommendationBadge}>
                <Ionicons name="star" size={14} color="#ffffff" />
                <Text style={styles.recommendationText} numberOfLines={1}>
                  {recommendation.performance_title || "Recommended"}
                </Text>
              </View>
            )}

            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imageFallback}>
                <Ionicons
                  name={item.category?.toLowerCase() === "instrument" ? "musical-notes" : "shirt"}
                  size={32}
                  color="#b0b9c3"
                />
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.categoryLabel} numberOfLines={1}>
              {cardLabel}
            </Text>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {availabilityCount > 0
                ? `${availabilityCount} unit${availabilityCount === 1 ? "" : "s"} ready`
                : "Fully borrowed"}
            </Text>

            <View style={styles.metaRow}>
              <Text style={[styles.availabilityLabel, availabilityCount > 0 ? styles.available : styles.unavailable]}>
                {getAvailabilityLabel(item)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#6b7280" />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (authLoading || loadingItems) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.stateText}>Loading items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color="#ef4444" />
          <Text style={styles.stateTitle}>Could not load items</Text>
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
      <View style={styles.stickyHeader}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search items..."
              placeholderTextColor="#d1d5db"
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterWrap}>
            <Pressable
              onPress={() => setShowDivisionMenu(true)}
              style={[styles.filterButton, selectedDivision && styles.filterButtonActive]}
            >
              <Text style={[styles.filterButtonText, selectedDivision && styles.filterButtonTextActive]}>
                {selectedDivision || "Division"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={selectedDivision ? "#ffffff" : "#166534"} />
            </Pressable>

            <Pressable
              onPress={() => setShowCategoryMenu(true)}
              style={[styles.filterButton, selectedCategory !== "all" && styles.filterButtonActive]}
            >
              <Text style={[styles.filterButtonText, selectedCategory !== "all" && styles.filterButtonTextActive]}>
                {selectedCategory === "all" ? "Category" : CATEGORY_FILTERS.find((filter) => filter.key === selectedCategory)?.label || "Category"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={selectedCategory !== "all" ? "#ffffff" : "#166534"} />
            </Pressable>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={44} color="#d1d5db" />
            <Text style={styles.stateTitle}>No items found</Text>
            <Text style={styles.stateText}>
              {searchQuery.trim()
                ? "Try a different search term or category filter."
                : "There are no available items to show right now."}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal
        transparent
        visible={showCategoryMenu}
        animationType="fade"
        onRequestClose={() => setShowCategoryMenu(false)}
      >
        <Pressable style={styles.dropdownOverlay} onPress={() => setShowCategoryMenu(false)}>
          <View style={styles.dropdownPanel}>
            {CATEGORY_FILTERS.map((filter) => {
              const active = selectedCategory === filter.key;

              return (
                <Pressable
                  key={filter.key}
                  onPress={() => {
                    setSelectedCategory(filter.key);
                    setShowCategoryMenu(false);
                  }}
                  style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
                >
                  <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={showDivisionMenu}
        animationType="fade"
        onRequestClose={() => setShowDivisionMenu(false)}
      >
        <Pressable style={styles.dropdownOverlay} onPress={() => setShowDivisionMenu(false)}>
          <View style={styles.dropdownPanel}>
            <Pressable
              onPress={() => {
                setSelectedDivision(null);
                setShowDivisionMenu(false);
              }}
              style={[styles.dropdownOption, !selectedDivision && styles.dropdownOptionActive]}
            >
              <Text style={[styles.dropdownOptionText, !selectedDivision && styles.dropdownOptionTextActive]}>All Divisions</Text>
            </Pressable>

            {divisions.map((division) => {
              const active = selectedDivision === division.name;

              return (
                <Pressable
                  key={division.id}
                  onPress={() => {
                    setSelectedDivision(division.name);
                    setShowDivisionMenu(false);
                  }}
                  style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
                >
                  <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                    {division.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {isFlyingToCart ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingCart,
            {
              transform: [
                { translateX: cartFlyAnim.x },
                { translateY: cartFlyAnim.y },
              ],
            },
          ]}
        >
          <Ionicons name="cart-outline" size={22} color="#ffffff" />
        </Animated.View>
      ) : null}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["75%", "100%"]}
        index={0}
        enablePanDownToClose
        backdropComponent={(backdropProps) => (
          <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
        )}
        footerComponent={renderSheetFooter}
        onDismiss={handleDismissSheet}
      >
        <BottomSheetFlatList
          data={availableSheetUnits}
          keyExtractor={(unit) => String(unit.id)}
          contentContainerStyle={styles.sheetListContent}
          ListHeaderComponent={
            selectedItem ? (
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderTopRow}>
                  <View style={styles.sheetDragPill} />
                  <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={10}>
                    <Ionicons name="close" size={20} color="#1f2937" />
                  </Pressable>
                </View>

                <View style={styles.sheetHeroCard}>
                  <View style={styles.sheetImageWrap}>
                    {normalizeImageUrl(selectedItem.image_url) ? (
                      <Image
                        source={{ uri: normalizeImageUrl(selectedItem.image_url) || undefined }}
                        style={styles.sheetImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.sheetImageFallback}>
                        <Ionicons
                          name={selectedItem.category?.toLowerCase() === "instrument" ? "musical-notes" : "shirt"}
                          size={44}
                          color="#b0b9c3"
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.sheetInfoBlock}>
                    <Text style={styles.sheetCategory}>
                      {getItemDivisionName(selectedItem)
                        ? `${getItemDivisionName(selectedItem)} • ${selectedItem.category || "Item"}`
                        : selectedItem.category || "Item"}
                    </Text>
                    <Text style={styles.sheetTitle}>{selectedItem.name}</Text>

                    {selectedItem.description ? (
                      <Text style={styles.sheetDescription}>{selectedItem.description}</Text>
                    ) : null}

                    <View style={styles.sheetMetaRow}>
                      <View style={styles.sheetAvailabilityPill}>
                        <View
                          style={[
                            styles.sheetStatusDot,
                            getAvailabilityCount(selectedItem) > 0 ? styles.sheetStatusAvailable : styles.sheetStatusUnavailable,
                          ]}
                        />
                        <Text style={styles.sheetAvailabilityText}>
                          {getAvailabilityLabel(selectedItem)}
                        </Text>
                      </View>
                      <Text style={styles.sheetAvailabilityTextSecondary}>
                        {selectedUnits.length} selected
                      </Text>
                    </View>

                    {selectedRecommendation ? (
                      <View style={styles.sheetRecommendationBadge}>
                        <Ionicons name="star" size={13} color="#ca8a04" />
                        <Text style={styles.sheetRecommendationText} numberOfLines={1}>
                          {selectedRecommendation.performance_title || "Recommended"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.sheetControlsRow}>
                  <TextInput
                    value={unitSearchQuery}
                    onChangeText={setUnitSearchQuery}
                    placeholder="Search units..."
                    placeholderTextColor="#d1d5db"
                    style={styles.sheetSearchInput}
                  />

                  <View style={styles.sheetFilterRow}>
                    {SIZE_FILTERS.map((sizeFilter) => {
                      const active = activeSizeFilter === sizeFilter;

                      return (
                        <Pressable
                          key={sizeFilter}
                          onPress={() => setActiveSizeFilter(active ? null : sizeFilter)}
                          style={[styles.sheetFilterChip, active && styles.sheetFilterChipActive]}
                        >
                          <Text style={[styles.sheetFilterChipText, active && styles.sheetFilterChipTextActive]}>
                            {sizeFilter.charAt(0).toUpperCase() + sizeFilter.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.sheetEmptyState}>
              <Ionicons name="grid-outline" size={36} color="#d1d5db" />
              <Text style={styles.sheetEmptyTitle}>No available units</Text>
              <Text style={styles.sheetEmptyText}>
                {selectedItem ? "This item is currently fully borrowed." : "Select an item to view details."}
              </Text>
            </View>
          }
          renderItem={({ item: unit }) => {
            const isSelected = selectedUnits.some((selectedUnit) => selectedUnit.id === unit.id);

            return (
              <Pressable
                onPress={() => handleToggleUnit(unit)}
                style={({ pressed }) => [
                  styles.unitRow,
                  isSelected && styles.unitRowSelected,
                  pressed && styles.unitRowPressed,
                ]}
              >
                <View>
                  <Text style={styles.unitTitle}>
                    {unit.unit_number ? `#${unit.unit_number}` : `Unit ${String(unit.id).slice(0, 8)}`}
                  </Text>
                  <Text style={styles.unitSubtitle}>
                    {unit.size ? unit.size.charAt(0).toUpperCase() + unit.size.slice(1) : "No size"}
                  </Text>
                </View>
                <View style={styles.unitActionChip}>
                  <Text style={styles.unitActionChipText}>{isSelected ? "Selected" : "Select"}</Text>
                </View>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  stickyHeader: {
    zIndex: 20,
    paddingTop: -2,
    paddingBottom: 8,
    paddingHorizontal: 14,
    backgroundColor: "#f9fafb",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 1,
    paddingBottom: 24,
  },
  header: {
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
    paddingVertical: 0,
  },
  filterWrap: {
    alignItems: "flex-end",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f2fdf5",
    borderWidth: 1,
    borderColor: "#166534",
    minWidth: 50,
  },
  filterButtonActive: {
    backgroundColor: "#166534",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  filterButtonTextActive: {
    color: "#ffffff",
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.16)",
  },
  dropdownPanel: {
    position: "absolute",
    top: 96,
    right: 14,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 6,
    minWidth: 148,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownOptionActive: {
    backgroundColor: "#f2fdf5",
  },
  dropdownOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  dropdownOptionTextActive: {
    color: "#166534",
    fontWeight: "700",
  },
  flyingCart: {
    position: "absolute",
    left: 24,
    top: 140,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    elevation: 60,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  columnWrapper: {
    gap: 10,
  },
  cardPressable: {
    flex: 1,
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.85,
  },
  card: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  recommendedCard: {
    borderColor: "#fbbf24",
    backgroundColor: "#fefce8",
  },
  imageWrapper: {
    height: 150,
    backgroundColor: "#f3f4f6",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  recommendationBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ca8a04",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  recommendationText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    maxWidth: 100,
  },
  sheetListContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  sheetHeader: {
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  sheetHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetDragPill: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
    marginLeft: "auto",
    marginRight: "auto",
  },
  sheetHeroCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sheetImageWrap: {
    height: 200,
    backgroundColor: "#f3f4f6",
  },
  sheetImage: {
    width: "100%",
    height: "100%",
  },
  sheetImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  sheetInfoBlock: {
    padding: 12,
    gap: 8,
  },
  sheetCategory: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#9ca3af",
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: "#1f2937",
  },
  sheetDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
  },
  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  sheetAvailabilityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
  },
  sheetStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sheetStatusAvailable: {
    backgroundColor: "#10b981",
  },
  sheetStatusUnavailable: {
    backgroundColor: "#ef4444",
  },
  sheetAvailabilityText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  sheetAvailabilityTextSecondary: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  sheetRecommendationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sheetRecommendationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
    flex: 1,
  },
  sheetControlsRow: {
    gap: 10,
  },
  sheetSearchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1f2937",
  },
  sheetFilterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  sheetFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sheetFilterChipActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  sheetFilterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  sheetFilterChipTextActive: {
    color: "#ffffff",
  },
  sheetEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  sheetEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
  },
  sheetEmptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#9ca3af",
    textAlign: "center",
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  unitRowSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#4f46e5",
  },
  unitRowPressed: {
    opacity: 0.9,
  },
  unitTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  unitSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 3,
  },
  unitActionChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  unitActionChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  sheetFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  sheetFooterMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: "#dc2626",
  },
  borrowButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    paddingVertical: 13,
  },
  borrowButtonPressed: {
    opacity: 0.9,
  },
  borrowButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  borrowButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 4,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6b7280",
  },
  itemName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#111827",
    minHeight: 40,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: "#4b5563",
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  availabilityLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  available: {
    color: "#1d4ed8",
  },
  unavailable: {
    color: "#9ca3af",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 10,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#9ca3af",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#4f46e5",
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});