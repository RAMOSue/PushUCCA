import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { api } from "../../src/services/api";

type AnnouncementAuthor = {
  id?: number;
  name?: string;
  profile_pic_url?: string | null;
};

type Announcement = {
  id: number;
  title: string;
  content?: string | null;
  image_url?: string | null;
  priority?: string | null;
  pinned?: boolean;
  is_published?: boolean;
  published_at?: string | null;
  created_at?: string;
  division_name?: string | null;
  author?: AnnouncementAuthor | null;
};

const formatAnnouncementDate = (value?: string | null) => {
  if (!value) return "Recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get("/api/announcements", {
        params: {
          published: true,
          limit: 200,
        },
      });

      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load announcements:", err);
      setError(err?.response?.data?.error || "Unable to load announcements right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  const renderItem = ({ item }: { item: Announcement }) => (
    <View key={item.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{item.title || "Untitled announcement"}</Text>
          {item.priority ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.priority}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.meta}>{formatAnnouncementDate(item.published_at || item.created_at)}</Text>
        {item.division_name ? <Text style={styles.division}>{item.division_name}</Text> : null}
      </View>

      {item.content ? <Text style={styles.description}>{item.content}</Text> : null}

      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={item.title || "Announcement image"}
        />
      ) : null}

      {item.author?.name ? <Text style={styles.author}>Posted by {item.author.name}</Text> : null}
    </View>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.emptyText}>Loading announcements...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#ef4444" />
          <Text style={styles.emptyTitle}>Couldn’t load announcements</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void fetchAnnouncements()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="megaphone-outline" size={28} color="#64748b" />
        <Text style={styles.emptyTitle}>No announcements yet</Text>
        <Text style={styles.emptyText}>New updates will appear here.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Announcements</Text>
        <Text style={styles.headerSubtitle}>Community updates and reminders</Text>
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchAnnouncements()} tintColor="#2563eb" />}
        ListEmptyComponent={renderEmptyState}
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
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    color: "#64748b",
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  titleBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  badge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
  meta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  division: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
    marginTop: 4,
  },
  description: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#e2e8f0",
  },
  author: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "600",
  },
  emptyState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
