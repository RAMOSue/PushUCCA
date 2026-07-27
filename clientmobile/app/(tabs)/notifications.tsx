import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../src/services/notifications";
import type { NotificationItem } from "../../src/types/notification";

export default function Notifications() {
  const { user, isLoading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);

    try {
      const [notifs] = await Promise.all([
        fetchNotifications(),
      ]);

      setNotifications(Array.isArray(notifs) ? notifs : []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        void fetchData();
      }
      return undefined;
    }, [authLoading, fetchData])
  );

  useEffect(() => {
    if (!authLoading) {
      void fetchData();
    }
  }, [authLoading, fetchData]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("mobile:refresh", (payload) => {
      if (payload?.screen && payload.screen !== "all" && payload.screen !== "notifications") {
        return;
      }

      void fetchData();
    });

    return () => subscription.remove();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      await fetchData();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [fetchData]);

  const handleOpenNotification = useCallback(
    async (notification: NotificationItem) => {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id);
      }

      await fetchData();
    },
    [fetchData]
  );

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.stateText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
        contentContainerStyle={[styles.content, notifications.length === 0 && styles.emptyContent]}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {notifications.length > 0 ? (
              <Pressable onPress={() => void handleMarkAllRead()} style={styles.markAllButton}>
                <Text style={styles.markAllButtonText}>Mark all as read</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={42} color="#94a3b8" />
            <Text style={styles.stateTitle}>No notifications</Text>
            <Text style={styles.stateText}>Updates from your borrow requests will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = !item.is_read;

          return (
            <Pressable onPress={() => void handleOpenNotification(item)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed, isUnread && styles.cardUnread]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.iconWrap, isUnread ? styles.iconUnread : styles.iconRead]}>
                  <Ionicons name="notifications" size={18} color={isUnread ? "#1d4ed8" : "#475569"} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.message} numberOfLines={3}>
                    {item.message}
                  </Text>
                  <Text style={styles.metaText}>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : "Recent update"}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
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
    paddingBottom: 24,
    gap: 12,
  },
  headerWrap: {
    gap: 10,
  },
  markAllButton: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  markAllButtonText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "800",
  },
  card: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  cardUnread: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  cardPressed: {
    opacity: 0.94,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconUnread: {
    backgroundColor: "#dbeafe",
  },
  iconRead: {
    backgroundColor: "#f1f5f9",
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  metaText: {
    fontSize: 12,
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
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
});
