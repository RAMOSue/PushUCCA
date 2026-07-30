import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";
import { announcements } from "../../src/components/info/mockData";

export default function AnnouncementsScreen() {
  return (
    <InfoPageLayout title="Announcements" subtitle="Community updates and reminders">
      {announcements.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{item.title}</Text>
              {item.priority ? <View style={styles.badge}><Text style={styles.badgeText}>{item.priority}</Text></View> : null}
            </View>
            <Text style={styles.meta}>{item.postedAt}</Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
          {item.image ? <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" /> : null}
          <Text style={styles.author}>Posted by {item.postedBy}</Text>
        </View>
      ))}
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
  description: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    marginBottom: 10,
  },
  author: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "600",
  },
});
