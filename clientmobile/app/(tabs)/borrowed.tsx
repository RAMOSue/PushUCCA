import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import BorrowCard from "../../src/components/borrowing/BorrowCard";
import EmptyBorrowState from "../../src/components/borrowing/EmptyBorrowState";
import ReturnedBottomSheet from "../../src/components/borrowing/ReturnedBottomSheet";
import { useAuth } from "../../src/hooks/useAuth";
import { fetchBorrowHistory } from "../../src/services/borrowHistory";
import type { BorrowHistoryRecord } from "../../src/types/borrowHistory";

const STATUS_ORDER = [
  "pending",
  "approved",
  "pending_return",
  "returned",
  "rejected",
  "declined",
  "cancelled",
  "canceled",
  "borrowed",
];

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "pending_return", label: "Returning" },
  { key: "returned", label: "Returned" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type FilterButtonLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function normalizeBorrowRecords(records: BorrowHistoryRecord[]) {
  const grouped = new Map<string | number, BorrowHistoryRecord>();

  records.forEach((record) => {
    const key = record.request_id;
    if (!grouped.has(key)) {
      grouped.set(key, { ...record, items: Array.isArray(record.items) ? record.items : [] });
      return;
    }

    const existing = grouped.get(key);
    if (existing) {
      existing.items = [...existing.items, ...(Array.isArray(record.items) ? record.items : [])];
    }
  });

  return Array.from(grouped.values());
}

function getStatusPriority(status: string) {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
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

export default function BorrowedScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ highlightRequestId?: string }>();
  const listRef = useRef<FlatList<BorrowHistoryRecord> | null>(null);
  const [pendingHighlightRequestId, setPendingHighlightRequestId] = useState<string | null>(null);
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);

  const [records, setRecords] = useState<BorrowHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"] | "all">("all");
  const [selectedRecord, setSelectedRecord] = useState<BorrowHistoryRecord | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [statusButtonLayout, setStatusButtonLayout] = useState<FilterButtonLayout | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const statusButtonRef = useRef<View | null>(null);
  const calendarHeight = useRef(new Animated.Value(0)).current;
  const calendarOpacity = useRef(new Animated.Value(0)).current;

  const fetchRecords = useCallback(async () => {
    if (!user?.id) {
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await fetchBorrowHistory(user.id);
      setRecords(normalizeBorrowRecords(data));
    } catch (error: any) {
      console.error("Error fetching borrow history:", error?.response?.data || error?.message || error);
      setErrorMessage("Unable to load your borrowed items right now.");
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        void fetchRecords();
      }
      return undefined;
    }, [authLoading, fetchRecords])
  );

  useEffect(() => {
    if (!authLoading) {
      void fetchRecords();
    }
  }, [authLoading, fetchRecords]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("mobile:refresh", (payload) => {
      if (payload?.screen && payload.screen !== "all" && payload.screen !== "borrowed") {
        return;
      }

      void fetchRecords();
    });

    return () => subscription.remove();
  }, [fetchRecords]);

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

  const dueDateKeys = useMemo(() => {
    const nextSet = new Set<string>();

    records.forEach((record) => {
      const dateKey = getDateKey(record.due_date);
      if (dateKey) {
        nextSet.add(dateKey);
      }
    });

    return nextSet;
  }, [records]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingDays = firstDay.getDay();
    const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
    const todayKey = getDateKey(new Date());
    const selectedKey = selectedDate;

    const cells = [] as Array<{
      dateKey: string;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasDueItems: boolean;
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
        hasDueItems: Boolean(dateKey && dueDateKeys.has(dateKey)),
      });
    }

    return cells;
  }, [calendarMonth, dueDateKeys, selectedDate]);

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const source = records.filter((record) => record.status !== "reserved");

    const filteredByStatus = statusFilter === "all"
      ? source
      : source.filter((record) => record.status === statusFilter);

    const filteredByDate = selectedDate
      ? filteredByStatus.filter((record) => getDateKey(record.due_date) === selectedDate)
      : filteredByStatus;

    if (!query) {
      return [...filteredByDate].sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));
    }

    return [...filteredByDate]
      .filter((record) => {
        const matchText = [
          String(record.request_id),
          record.items.map((item) => item.item_name || item.name).join(" "),
          record.items.map((item) => item.category || item.garment_type).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchText.includes(query);
      })
      .sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));
  }, [records, searchQuery, selectedDate, statusFilter]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    const requestedHighlight = typeof params.highlightRequestId === "string" && params.highlightRequestId.trim()
      ? params.highlightRequestId.trim()
      : null;

    if (requestedHighlight) {
      setPendingHighlightRequestId(requestedHighlight);
      setSearchQuery("");
      setStatusFilter("all");
      setSelectedDate(null);
    }
  }, [params.highlightRequestId]);

  useEffect(() => {
    if (!pendingHighlightRequestId || filteredRecords.length === 0) {
      return;
    }

    const index = filteredRecords.findIndex(
      (record) => String(record.request_id) === pendingHighlightRequestId
    );

    if (index === -1) {
      return;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.28 });
    });

    setHighlightedRequestId(pendingHighlightRequestId);
    const timer = setTimeout(() => setHighlightedRequestId(null), 2800);
    return () => clearTimeout(timer);
  }, [filteredRecords, pendingHighlightRequestId]);

  const handleOpenReturnSheet = useCallback((record: BorrowHistoryRecord) => {
    setSelectedRecord(record);
    setSheetVisible(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
    setSelectedRecord(null);
  }, []);

  const handleReturnComplete = useCallback(() => {
    void fetchRecords();
  }, [fetchRecords]);

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
    setSelectedDate((previous) => (previous === dateKey ? null : dateKey));
  }, []);

  const clearDateFilter = useCallback(() => {
    setSelectedDate(null);
  }, []);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.centerLabel}>Loading your items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
          <Text style={styles.centerTitle}>Unable to load borrowed items</Text>
          <Text style={styles.centerLabel}>{errorMessage}</Text>
          <Pressable onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>

      <View style={styles.listHeaderContainer}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search requests or items"
              style={styles.searchInput}
              placeholderTextColor="#d1d5db"
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
                ref={statusButtonRef}
                onLayout={(event) => {
                  const { x, y, width, height } = event.nativeEvent.layout;
                  setStatusButtonLayout({ x, y, width, height });
                }}
                onPress={() => {
                  if (showStatusMenu) {
                    setShowStatusMenu(false);
                    return;
                  }

                  setShowStatusMenu(true);
                }}
                style={[styles.filterButton, statusFilter !== "all" && styles.filterButtonActive]}
              >
                <Text style={[styles.filterButtonText, statusFilter !== "all" && styles.filterButtonTextActive]}>
                  {STATUS_FILTERS.find((filter) => filter.key === statusFilter)?.label || "Status"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={statusFilter !== "all" ? "#ffffff" : "#166534"} />
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

            {selectedDate ? (
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
                    {day.hasDueItems ? <View style={styles.dayDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {showStatusMenu && statusButtonLayout ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.dropdownPanel,
              {
                top: statusButtonLayout.y + statusButtonLayout.height + 56,
                left: statusButtonLayout.x - 24,
              },
            ]}
          >
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.key;

              return (
                <Pressable
                  key={filter.key}
                  onPress={() => {
                    setStatusFilter(filter.key);
                    setShowStatusMenu(false);
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

        {showStatusMenu ? (
          <Pressable
            style={styles.dropdownOverlay}
            onPress={() => setShowStatusMenu(false)}
          />
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={filteredRecords}
        keyExtractor={(record) => String(record.request_id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyBorrowState
            title={selectedDate ? "No borrowed items are due on this date." : searchQuery ? "No matching requests" : "No borrow records yet"}
            message={
              selectedDate
                ? "Try another day or clear the filter to see all your borrowed items."
                : searchQuery
                  ? "Try a different keyword to find the record you want."
                  : "Browse available items to create your first borrow request."
            }
            actionLabel={!searchQuery && !selectedDate ? "Browse items" : undefined}
            onAction={!searchQuery && !selectedDate ? () => router.push("/(tabs)/available-items") : undefined}
          />
        }
        renderItem={({ item }) => (
          <BorrowCard
            record={item}
            highlighted={String(item.request_id) === highlightedRequestId}
            onPress={handleOpenReturnSheet}
            onReturnPress={handleOpenReturnSheet}
            onViewPhotosPress={handleOpenReturnSheet}
          />
        )}
      />

      <ReturnedBottomSheet
        record={selectedRecord}
        visible={sheetVisible}
        onClose={handleCloseSheet}
        onReturnComplete={handleReturnComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  listHeaderContainer: {
    backgroundColor: "#f8fafc",
    position: "relative",
    paddingHorizontal: 16,
    paddingTop: 1,
    paddingBottom: 4,
  },
  header: {
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
    position: "relative",
    zIndex: 2,
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
    minWidth: 92,
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  calendarContainer: {
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  calendarCard: {
    width: "110%",
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
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563eb",
    marginTop: 3,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  centerLabel: {
    fontSize: 14,
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
    fontWeight: "900",
  },
});
