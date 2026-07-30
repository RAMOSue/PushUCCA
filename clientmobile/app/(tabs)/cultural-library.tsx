import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";

export default function CulturalLibraryScreen() {
  const router = useRouter();

  const categories = [
    { title: "Indigenous Instruments", route: "/(tabs)/instruments", icon: "musical-notes-outline" },
    { title: "Indigenous Costumes", route: "/(tabs)/costumes", icon: "shirt-outline" },
  ];

  return (
    <InfoPageLayout title="Indigenous Library" subtitle="A cultural encyclopedia for the community">
      {categories.map((category) => (
        <Pressable key={category.title} style={styles.card} onPress={() => router.push(category.route as any)}>
          <Text style={styles.title}>{category.title}</Text>
          <Text style={styles.description}>Tap to explore stories, meanings, and traditions.</Text>
        </Pressable>
      ))}
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  description: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
  },
});
