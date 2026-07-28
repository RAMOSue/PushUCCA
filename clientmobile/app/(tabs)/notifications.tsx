import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import {
  fetchNotifications,
  markNotificationAsRead,
  deleteNotification,
} from "../../src/services/notifications";
import type { NotificationItem } from "../../src/types/notification";

function getAvatarSource(notification: NotificationItem) {
  const data = notification.data as Record<string, unknown> | undefined;
  const candidate =
    typeof data?.senderProfileUrl === "string" && data.senderProfileUrl.trim()
      ? String(data.senderProfileUrl)
      : typeof data?.staffProfileUrl === "string" && data.staffProfileUrl.trim()
      ? String(data.staffProfileUrl)
      : typeof data?.avatarUrl === "string" && data.avatarUrl.trim()
      ? String(data.avatarUrl)
      : typeof data?.avatar_url === "string" && data.avatar_url.trim()
      ? String(data.avatar_url)
      : typeof data?.image_url === "string" && data.image_url.trim()
      ? String(data.image_url)
      : null;

  return candidate ? { uri: candidate } : null;
}

function getNotificationSenderName(notification: NotificationItem) {
  const data = notification.data as Record<string, unknown> | undefined;
  const name =
    (typeof data?.staffName === "string" && data.staffName.trim()) ||
    (typeof data?.senderName === "string" && data.senderName.trim()) ||
    (typeof data?.name === "string" && data.name.trim());

  if (name) {
    return name;
  }

  return "Staff";
}

function getAvatarInitials(notification: NotificationItem) {
  const sender = getNotificationSenderName(notification);
  const parts = sender
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getRelativeTime(timestamp?: string | null) {
  if (!timestamp) {
    return "Just now";
  }

  const created = new Date(timestamp).getTime();
  if (Number.isNaN(created)) {
    return "Just now";
  }

  const now = Date.now();
  const diff = Math.max(0, now - created);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function getNotificationRequestId(notification: NotificationItem) {
  const data = notification.data as Record<string, unknown> | undefined;
  return (
    data?.requestId ??
    data?.request_id ??
    data?.relatedRequest ??
    data?.related_request ??
    null
  );
}

function extractNotificationItemNames(message: string) {
  if (!message) return "";

  const normalized = message.trim();
  const borrowMatch = normalized.match(/Your request to borrow (.+?)(?: has been approved!?| was declined\.?)(?: Reason:.*)?$/i);
  if (borrowMatch?.[1]) {
    return borrowMatch[1].trim().replace(/\.$/, "");
  }

  const returnMatch = normalized.match(/(?:Your return of |)(.+?)(?: has been returned.*| have been returned.*| was declined.*| were declined.*| has been received.*| have been received.*| is overdue.*| are overdue.*| is due.*| are due.*)$/i);
  if (returnMatch?.[1]) {
    return returnMatch[1].trim().replace(/\.$/, "");
  }

  const colonMatch = normalized.match(/^(?:A borrower wants to return: |)(.+?)(?:\.|$)/i);
  if (colonMatch?.[1]) {
    return colonMatch[1].trim().replace(/\.$/, "");
  }

  return normalized.replace(/\.$/, "");
}

function formatNotificationSummary(notification: NotificationItem) {
  const sender = getNotificationSenderName(notification);
  const message = String(notification.message || "").trim();
  const itemNames = extractNotificationItemNames(message);
  const type = String(notification.type || "").toLowerCase();

  if (type === "request_approved") {
    return itemNames
      ? `${sender} approved your request to borrow ${itemNames}.`
      : `${sender} approved your borrow request.`;
  }

  if (type === "request_declined") {
    return itemNames
      ? `${sender} declined your request to borrow ${itemNames}.`
      : `${sender} declined your borrow request.`;
  }

  if (type === "return_approved") {
    return itemNames
      ? `${sender} confirmed your return of ${itemNames}.`
      : `${sender} confirmed your return.`;
  }

  if (type === "return_declined") {
    return itemNames
      ? `${sender} declined your return of ${itemNames}.`
      : `${sender} declined your return.`;
  }

  if (type === "due_soon") {
    return itemNames
      ? `${sender} reminded you ${itemNames} is due soon.`
      : `${sender} reminded you about an upcoming due date.`;
  }

  if (type === "overdue") {
    return itemNames
      ? `${sender} alerted you ${itemNames} is overdue.`
      : `${sender} alerted you about an overdue item.`;
  }

  const normalizedMessage = message.charAt(0).toLowerCase() === message[0]
    ? message
    : `${message.charAt(0).toLowerCase()}${message.slice(1)}`;

  return `${sender} ${normalizedMessage}`;
}

export default function Notifications() {
  const { user, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const pageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [notifications]);

  useEffect(() => {
    Animated.timing(pageOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [pageOpacity]);

  const router = useRouter();

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);

    try {
      const notifs = await fetchNotifications();
      setNotifications(Array.isArray(notifs) ? notifs : []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, user?.id]);

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

  const isToday = useCallback((timestamp?: string | null) => {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }, []);

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    }),
    [notifications]
  );

  const todayNotifications = useMemo(
    () => sortedNotifications.filter((notification) => isToday(notification.created_at)),
    [sortedNotifications, isToday]
  );

  const earlierNotifications = useMemo(
    () => sortedNotifications.filter((notification) => !isToday(notification.created_at)),
    [sortedNotifications, isToday]
  );

  const sections = useMemo(() => {
    const sectionData: { title: string; data: NotificationItem[] }[] = [];

    if (todayNotifications.length > 0) {
      sectionData.push({ title: "Today", data: todayNotifications });
    }

    if (earlierNotifications.length > 0) {
      sectionData.push({ title: "Earlier", data: earlierNotifications });
    }

    return sectionData;
  }, [todayNotifications, earlierNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const handleOpenNotification = useCallback(
    async (notification: NotificationItem) => {
      const targetRequestId = getNotificationRequestId(notification);

      if (!notification.is_read) {
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item
          )
        );

        void markNotificationAsRead(notification.id).catch((error) => {
          console.error("Error marking notification as read:", error);
        });
      }

      if (targetRequestId !== null && targetRequestId !== undefined) {
        router.push(`/(tabs)/borrowed?highlightRequestId=${encodeURIComponent(String(targetRequestId))}`);
      } else {
        router.push("/(tabs)/borrowed");
      }
    },
    [router]
  );

  const handleOverflowOpen = useCallback((notification: NotificationItem) => {
    setSelectedNotification(notification);
    sheetRef.current?.present();
  }, []);

  const handleOverflowClose = useCallback(() => {
    sheetRef.current?.dismiss();
    setSelectedNotification(null);
  }, []);

  const handleDeleteNotification = useCallback(async () => {
    if (!selectedNotification) {
      return;
    }

    try {
      await deleteNotification(selectedNotification.id);
      setNotifications((prev) => prev.filter((item) => item.id !== selectedNotification.id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    } finally {
      handleOverflowClose();
    }
  }, [handleOverflowClose, selectedNotification]);

  const renderNotificationItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const avatarSource = getAvatarSource(item);
      const initials = getAvatarInitials(item);
      const relativeTime = getRelativeTime(item.created_at);
      const isUnread = !item.is_read;
      const summary = formatNotificationSummary(item);

      return (
        <Pressable
          onPress={() => void handleOpenNotification(item)}
          style={({ pressed }) => [
            styles.notificationItem,
            isUnread && styles.notificationItemUnread,
            pressed && styles.notificationItemPressed,
          ]}
        >
          <View style={styles.notificationRow}>
            <View style={styles.avatarCircle}>
              {avatarSource ? (
                <Animated.Image
                  source={avatarSource}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.notificationBody}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationMessage} numberOfLines={2}>
                  {summary}
                </Text>
                <Pressable
                  onPress={() => handleOverflowOpen(item)}
                  style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#6b7280" />
                </Pressable>
              </View>

              <View style={styles.notificationFooter}>
                <Text style={styles.timeText}>{relativeTime}</Text>
                {isUnread ? <View style={styles.unreadDot} /> : null}
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [handleOpenNotification, handleOverflowOpen]
  );

  const renderSectionHeader = useCallback(
    ({ section: { title } }: { section: { title: string } }) => (
      <Text style={styles.sectionHeader}>{title}</Text>
    ),
    []
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
      <Animated.View style={[styles.screen, { opacity: pageOpacity }]}> 
        

        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotificationItem}
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
          contentContainerStyle={[styles.content, notifications.length === 0 && styles.emptyContent]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="notifications-off-outline" size={46} color="#2563eb" />
              </View>
              <Text style={styles.stateTitle}>You&apos;re all caught up!</Text>
              <Text style={styles.stateText}>New notifications will appear here.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      </Animated.View>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["20%"]}
        onDismiss={handleOverflowClose}
        backdropComponent={(backdropProps) => (
          <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.34} />
        )}
      >
        <BottomSheetView style={styles.menuSheet}>
          <Text style={styles.menuTitle}>Notification options</Text>
          <Pressable
            onPress={handleDeleteNotification}
            style={({ pressed }) => [styles.menuOption, pressed && styles.menuOptionPressed]}
          >
            <Text style={styles.menuOptionText}>Delete notification</Text>
          </Pressable>
          <Pressable
            onPress={handleOverflowClose}
            style={({ pressed }) => [styles.menuOption, pressed && styles.menuOptionPressed]}
          >
            <Text style={styles.menuOptionTextSecondary}>Cancel</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
    marginTop: 10,
  },
  notificationItem: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notificationItemUnread: {
    backgroundColor: "#eef2ff",
  },
  notificationItemPressed: {
    opacity: 0.92,
  },
  notificationRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  avatarFallbackText: {
    color: "#3730a3",
    fontSize: 16,
    fontWeight: "800",
  },
  notificationBody: {
    flex: 1,
    gap: 8,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginLeft: 76,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
    flex: 1,
  },
  menuButton: {
    padding: 6,
    borderRadius: 10,
  },
  menuButtonPressed: {
    backgroundColor: "#f3f4f6",
  },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  timeText: {
    fontSize: 12,
    color: "#64748b",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 72,
    gap: 14,
  },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
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
  menuSheet: {
    padding: 20,
    gap: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  menuOption: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
  },
  menuOptionPressed: {
    backgroundColor: "#e2e8f0",
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#dc2626",
  },
  menuOptionTextSecondary: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
});
