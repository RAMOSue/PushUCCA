import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Image,
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

type FilterButtonLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
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

function getDateKey(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonthLabel(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
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
  const [activeFilterMenu, setActiveFilterMenu] = useState<"division" | "category" | null>(null);
  const [divisionButtonLayout, setDivisionButtonLayout] = useState<FilterButtonLayout | null>(null);
  const [categoryButtonLayout, setCategoryButtonLayout] = useState<FilterButtonLayout | null>(null);
  const [cartOrigin, setCartOrigin] = useState<{ x: number; y: number } | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [selectedPerformanceDate, setSelectedPerformanceDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const cardRefs = useRef<Record<string, View | null>>({});
  const divisionButtonRef = useRef<View | null>(null);
  const categoryButtonRef = useRef<View | null>(null);
  const [optimisticBorrowedUnitIds, setOptimisticBorrowedUnitIds] = useState<Set<string | number>>(new Set());
  const calendarHeight = useRef(new Animated.Value(0)).current;
  const calendarOpacity = useRef(new Animated.Value(0)).current;

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

  const fetchItems = useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true;

    if (showLoader) {
      setLoadingItems(true);
    }

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
      if (showLoader) {
        setLoadingItems(false);
      }
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
        void fetchItems({ showLoader: false });
        void fetchDivisions();
        void fetchReservedRequest();
      }
      return undefined;
    }, [authLoading, fetchDivisions, fetchItems, fetchReservedRequest])
  );

  useEffect(() => {
    if (!authLoading) {
      void fetchItems({ showLoader: true });
      void fetchDivisions();
      void fetchReservedRequest();
    }
  }, [authLoading, fetchDivisions, fetchItems, fetchReservedRequest, user?.id, user?.role]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("mobile:refresh", (payload) => {
      if (payload?.screen && payload.screen !== "all" && payload.screen !== "available-items") {
        return;
      }

      void fetchItems({ showLoader: false });
      void fetchDivisions();
      void fetchReservedRequest();
    });

    return () => subscription.remove();
  }, [fetchDivisions, fetchItems, fetchReservedRequest]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(calendarHeight, {
        toValue: calendarExpanded ? 320 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(calendarOpacity, {
        toValue: calendarExpanded ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [calendarExpanded, calendarHeight, calendarOpacity]);

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

  const applyOptimisticBorrowState = useCallback((itemId: string | number, unitIds: Array<string | number>, isOptimistic: boolean) => {
    const nextStatus = isOptimistic ? "borrowed" : "available";

    setItems((previous) =>
      previous.map((entry) => {
        if (entry.id !== itemId) {
          return entry;
        }

        return {
          ...entry,
          units: (entry.units ?? []).map((unit) => (unitIds.includes(unit.id) ? { ...unit, status: nextStatus } : unit)),
        };
      })
    );

    setSelectedItem((previous) => {
      if (!previous || previous.id !== itemId) {
        return previous;
      }

      return {
        ...previous,
        units: (previous.units ?? []).map((unit) => (unitIds.includes(unit.id) ? { ...unit, status: nextStatus } : unit)),
      };
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

    const optimisticUnitIds = unitsToBorrow.map((unit) => unit.id);
    const preview = selectedItem.image_url
      ? { uri: normalizeImageUrl(selectedItem.image_url) ?? undefined }
      : {
          icon: selectedItem.category?.toLowerCase() === "instrument" ? "musical-notes" : "shirt",
        };

    applyOptimisticBorrowState(selectedItem.id, optimisticUnitIds, true);
    setOptimisticBorrowedUnitIds((previous) => {
      const next = new Set(previous);
      optimisticUnitIds.forEach((unitId) => next.add(unitId));
      return next;
    });
    DeviceEventEmitter.emit("cart:updated", { countDelta: unitsToBorrow.length });
    const startPoint = cartOrigin ?? { x: 24, y: 140 };
    DeviceEventEmitter.emit("cart:animate", {
      fromX: startPoint.x,
      fromY: startPoint.y,
      imageUri: preview.uri ?? null,
      previewIcon: preview.icon ?? null,
      countDelta: unitsToBorrow.length,
    });
    setSelectedUnits([]);

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
        void fetchItems({ showLoader: false });
        void fetchReservedRequest();

        const successLabel = responseItems.length === 1 ? "1 unit added to cart." : `${responseItems.length} units added to cart.`;
        const failureLabel = failedItems.length > 0 ? ` ${failedItems.length} unit(s) could not be reserved.` : "";

        setBorrowMessage(`${successLabel}${failureLabel}`);
        DeviceEventEmitter.emit("mobile:refresh", { screen: "all" });
        sheetRef.current?.dismiss();
        return;
      }

      const failureText = failedItems.length > 0
        ? failedItems.map((entry: { error?: string }) => entry.error || "Unavailable").join("\n")
        : response.data?.error || "Unable to reserve selected units.";

      applyOptimisticBorrowState(selectedItem.id, optimisticUnitIds, false);
      setOptimisticBorrowedUnitIds((previous) => {
        const next = new Set(previous);
        optimisticUnitIds.forEach((unitId) => next.delete(unitId));
        return next;
      });
      DeviceEventEmitter.emit("cart:updated", { countDelta: -unitsToBorrow.length });
      setBorrowMessage(failureText);
    } catch (error: any) {
      const failedItems = error?.response?.data?.failed_items;
      const failureText = Array.isArray(failedItems) && failedItems.length > 0
        ? failedItems.map((entry: { error?: string }) => entry.error || "Unavailable").join("\n")
        : error?.response?.data?.error || error?.message || "Unable to reserve selected units.";

      applyOptimisticBorrowState(selectedItem.id, optimisticUnitIds, false);
      setOptimisticBorrowedUnitIds((previous) => {
        const next = new Set(previous);
        optimisticUnitIds.forEach((unitId) => next.delete(unitId));
        return next;
      });
      DeviceEventEmitter.emit("cart:updated", { countDelta: -unitsToBorrow.length });
      setBorrowMessage(failureText);
    } finally {
      setBorrowing(false);
    }
  }, [applyOptimisticBorrowState, availableSheetUnits, borrowRequestId, cartOrigin, fetchItems, fetchReservedRequest, selectedItem, selectedUnits, user?.id]);

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

  const performanceDateKeys = useMemo(() => {
    const nextSet = new Set<string>();

    recommendations.forEach((recommendation) => {
      const dateKey = getDateKey(recommendation.start_time);
      if (dateKey) {
        nextSet.add(dateKey);
      }
    });

    return nextSet;
  }, [recommendations]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingDays = firstDay.getDay();
    const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
    const todayKey = getDateKey(new Date());
    const selectedKey = selectedPerformanceDate;

    const cells = [] as Array<{
      dateKey: string;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasPerformance: boolean;
    }>;

    for (let index = 0; index < totalCells; index += 1) {
      const dayOffset = index - leadingDays + 1;
      const date = new Date(year, month, dayOffset);
      const isCurrentMonth = date.getMonth() === month;
      const dateKey = getDateKey(date);

      cells.push({
        dateKey: dateKey ?? "",
        day: date.getDate(),
        isCurrentMonth,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedKey,
        hasPerformance: Boolean(dateKey && performanceDateKeys.has(dateKey)),
      });
    }

    return cells;
  }, [calendarMonth, performanceDateKeys, selectedPerformanceDate]);

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

    if (selectedPerformanceDate) {
      const matchingItemIds = new Set<string | number>();

      recommendations.forEach((recommendation) => {
        if (getDateKey(recommendation.start_time) === selectedPerformanceDate) {
          matchingItemIds.add(recommendation.inventory_item_id);
        }
      });

      nextItems = nextItems.filter((item) => matchingItemIds.has(item.id));
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
  }, [items, recommendations, searchQuery, selectedCategory, selectedDivision, selectedPerformanceDate, user?.role]);

  const recommendedItemIds = useMemo(() => {
    return new Set(recommendations.map((recommendation) => recommendation.inventory_item_id));
  }, [recommendations]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchItems({ showLoader: false });
    void fetchDivisions();
    void fetchReservedRequest();
  }, [fetchDivisions, fetchItems, fetchReservedRequest]);

  const toggleCalendar = useCallback(() => {
    setCalendarExpanded((previous) => !previous);
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setCalendarMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCalendarMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
  }, []);

  const handleDatePress = useCallback((dateKey: string) => {
    setSelectedPerformanceDate((previous) => (previous === dateKey ? null : dateKey));
  }, []);

  const clearDateFilter = useCallback(() => {
    setSelectedPerformanceDate(null);
  }, []);

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
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
          <View style={styles.filterButtonShell}>
            <Pressable
              ref={divisionButtonRef}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setDivisionButtonLayout({ x, y, width, height });
              }}
              onPress={() => {
                if (activeFilterMenu === "division") {
                  setActiveFilterMenu(null);
                  setShowDivisionMenu(false);
                  return;
                }

                setActiveFilterMenu("division");
                setShowDivisionMenu(true);
                setShowCategoryMenu(false);
              }}
              style={[styles.filterButton, selectedDivision && styles.filterButtonActive]}
            >
              <Text style={[styles.filterButtonText, selectedDivision && styles.filterButtonTextActive]}>
                {selectedDivision || "Division"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={selectedDivision ? "#ffffff" : "#166534"} />
            </Pressable>
          </View>

          <View style={styles.filterButtonShell}>
            <Pressable
              ref={categoryButtonRef}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setCategoryButtonLayout({ x, y, width, height });
              }}
              onPress={() => {
                if (activeFilterMenu === "category") {
                  setActiveFilterMenu(null);
                  setShowCategoryMenu(false);
                  return;
                }

                setActiveFilterMenu("category");
                setShowCategoryMenu(true);
                setShowDivisionMenu(false);
              }}
              style={[styles.filterButton, selectedCategory !== "all" && styles.filterButtonActive]}
            >
              <Text style={[styles.filterButtonText, selectedCategory !== "all" && styles.filterButtonTextActive]}>
                {selectedCategory === "all" ? "Category" : CATEGORY_FILTERS.find((filter) => filter.key === selectedCategory)?.label || "Category"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={selectedCategory !== "all" ? "#ffffff" : "#166534"} />
            </Pressable>
          </View>

          <View style={styles.filterButtonShell}>
            <Pressable
              onPress={toggleCalendar}
              style={[styles.filterButton, calendarExpanded && styles.filterButtonActive]}
            >
              <Ionicons name="calendar-outline" size={16} color={calendarExpanded ? "#ffffff" : "#166534"} />
              <Text style={[styles.filterButtonText, calendarExpanded && styles.filterButtonTextActive]}>Calendar</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.calendarContainer,
          {
            height: calendarHeight,
            opacity: calendarOpacity,
          },
        ]}
      >
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeaderRow}>
            <Pressable onPress={goToPreviousMonth} style={styles.calendarNavButton}>
              <Ionicons name="chevron-back" size={16} color="#166534" />
            </Pressable>

            <Text style={styles.calendarMonthLabel}>{formatMonthLabel(calendarMonth)}</Text>

            <Pressable onPress={goToNextMonth} style={styles.calendarNavButton}>
              <Ionicons name="chevron-forward" size={16} color="#166534" />
            </Pressable>
          </View>

          {selectedPerformanceDate ? (
            <Pressable onPress={clearDateFilter} style={styles.clearFilterButton}>
              <Text style={styles.clearFilterText}>Show all</Text>
            </Pressable>
          ) : null}

          <View style={styles.weekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={styles.weekdayText}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((day) => {
              const dayStyle = [styles.dayCell];
              if (!day.isCurrentMonth) {
                dayStyle.push(styles.dayCellMuted);
              }
              if (day.isToday) {
                dayStyle.push(styles.dayCellToday);
              }
              if (day.isSelected) {
                dayStyle.push(styles.dayCellSelected);
              }

              return (
                <Pressable
                  key={`${day.dateKey}-${day.day}`}
                  onPress={() => day.dateKey && handleDatePress(day.dateKey)}
                  style={dayStyle}
                  disabled={!day.dateKey}
                >
                  <Text style={[styles.dayText, !day.isCurrentMonth && styles.dayTextMuted, day.isSelected && styles.dayTextSelected]}>
                    {day.day}
                  </Text>
                  {day.hasPerformance ? <Ionicons name="star" size={8} color={day.isSelected ? "#ffffff" : "#f59e0b"} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {showDivisionMenu && divisionButtonLayout ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.dropdownPanel,
            {
              top: divisionButtonLayout.y + divisionButtonLayout.height + 55,
              left: divisionButtonLayout.x + 135,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              setSelectedDivision(null);
              setShowDivisionMenu(false);
              setActiveFilterMenu(null);
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
                  setActiveFilterMenu(null);
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
      ) : null}

      {showCategoryMenu && categoryButtonLayout ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.dropdownPanel,
            {
              top: categoryButtonLayout.y + categoryButtonLayout.height + 55,
              left: categoryButtonLayout.x + 235 ,
            },
          ]}
        >
          {CATEGORY_FILTERS.map((filter) => {
            const active = selectedCategory === filter.key;

            return (
              <Pressable
                key={filter.key}
                onPress={() => {
                  setSelectedCategory(filter.key);
                  setShowCategoryMenu(false);
                  setActiveFilterMenu(null);
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
      ) : null}

      {(showCategoryMenu || showDivisionMenu) ? (
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => {
            setShowCategoryMenu(false);
            setShowDivisionMenu(false);
            setActiveFilterMenu(null);
          }}
        />
      ) : null}
    </View>
  );

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
      <View style={styles.headerSurface}>
        {renderListHeader()}
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={44} color="#d1d5db" />
            <Text style={styles.stateTitle}>{selectedPerformanceDate ? "No performances scheduled on this date." : "No items found"}</Text>
            <Text style={styles.stateText}>
              {selectedPerformanceDate
                ? "Try another day or clear the filter to see the full list."
                : searchQuery.trim()
                  ? "Try a different search term or category filter."
                  : "There are no available items to show right now."}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

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
  headerSurface: {
    zIndex: 20,
    backgroundColor: "#f9fafb",
    paddingTop: -2,
    paddingBottom: 4,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  listHeaderContainer: {
    backgroundColor: "#f9fafb",
    position: "relative",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  calendarContainer: {
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  calendarCard: {
    width: "108%",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 0,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  calendarMonthLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  clearFilterButton: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginVertical: 2,
  },
  dayCellMuted: {
    opacity: 0.45,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  dayCellSelected: {
    backgroundColor: "#166534",
  },
  dayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  dayTextMuted: {
    color: "#64748b",
  },
  dayTextSelected: {
    color: "#ffffff",
  },
  header: {
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
    position: "relative",
    zIndex: 2,
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
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
    paddingVertical: 0,
  },
  filterWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    alignSelf: "flex-end", 
  },
  filterButtonShell: {
    alignSelf: "flex-start",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d1d5db",
    minWidth: 50,
  },
  filterButtonActive: {
    backgroundColor: "#166534",
    borderColor: "#166534",
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.16)",
    zIndex: 10,
  },
  dropdownPanel: {
    position: "absolute",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 6,
    minWidth: 80,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    zIndex: 30,
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
    overflow: "hidden",
  },
  flyingPreviewImage: {
    width: "100%",
    height: "100%",
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