import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useFocusEffect, useRouter } from "expo-router";
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

export default function BorrowedScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [records, setRecords] = useState<BorrowHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"] | "all">("all");
  const [selectedRecord, setSelectedRecord] = useState<BorrowHistoryRecord | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

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

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const source = records.filter((record) => record.status !== "reserved");

    const filteredByStatus = statusFilter === "all"
      ? source
      : source.filter((record) => record.status === statusFilter);

    if (!query) {
      return [...filteredByStatus].sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));
    }

    return [...filteredByStatus]
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
  }, [records, searchQuery, statusFilter]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchRecords();
  }, [fetchRecords]);

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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>My Borrowed Items</Text>
          <Text style={styles.subtitle}>Track and manage your borrow requests</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#64748b" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by item name or request"
          style={styles.searchInput}
          placeholderTextColor="#94a3b8"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#64748b" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((option) => {
          const active = statusFilter === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setStatusFilter(option.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filteredRecords}
        keyExtractor={(record) => String(record.request_id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyBorrowState
            title={searchQuery ? "No matching requests" : "No borrow records yet"}
            message={
              searchQuery
                ? "Try a different keyword to find the record you want."
                : "Browse available items to create your first borrow request."
            }
            actionLabel={!searchQuery ? "Browse items" : undefined}
            onAction={!searchQuery ? () => router.push("/(tabs)/available-items") : undefined}
          />
        }
        renderItem={({ item }) => (
          <BorrowCard
            record={item}
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
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
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
