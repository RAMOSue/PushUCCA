import { Image, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";
import { costumes } from "../../src/components/info/mockData";

export default function CostumeDetailScreen() {
  const params = useLocalSearchParams<{ costumeId?: string }>();
  const item = costumes.find((entry) => entry.id === params.costumeId);

  if (!item) {
    return (
      <InfoPageLayout title="Costume" subtitle="Not found">
        <Text style={styles.empty}>Costume information is not available.</Text>
      </InfoPageLayout>
    );
  }

  return (
    <InfoPageLayout title={item.name} subtitle="Costume details">
      <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tribe</Text>
        <Text style={styles.body}>{item.tribe}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meaning</Text>
        <Text style={styles.body}>{item.meaning}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>When it is used</Text>
        <Text style={styles.body}>{item.usage}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cultural significance</Text>
        <Text style={styles.body}>{item.significance}</Text>
      </View>
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    marginBottom: 12,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  body: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
  },
  empty: {
    fontSize: 14,
    color: "#64748b",
  },
});
