import { Image, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";
import { divisions } from "../../src/components/info/mockData";

export default function DivisionDetailScreen() {
  const params = useLocalSearchParams<{ divisionId?: string }>();
  const division = divisions.find((item) => item.id === params.divisionId);

  if (!division) {
    return (
      <InfoPageLayout title="Division" subtitle="Not found">
        <Text style={styles.empty}>Division information is not available.</Text>
      </InfoPageLayout>
    );
  }

  return (
    <InfoPageLayout title={division.name} subtitle="Division profile">
      <View style={styles.hero}>
        <Text style={styles.description}>{division.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vision</Text>
        <Text style={styles.body}>{division.vision}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mission</Text>
        <Text style={styles.body}>{division.mission}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Adviser</Text>
        <Text style={styles.body}>{division.adviser}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Officers</Text>
        {division.officers.map((officer) => (
          <Text key={officer} style={styles.listItem}>• {officer}</Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        {division.members.map((member) => (
          <Text key={member} style={styles.listItem}>• {member}</Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gallery</Text>
        <View style={styles.galleryRow}>
          {division.gallery.map((image) => (
            <Image key={image} source={{ uri: image }} style={styles.galleryImage} resizeMode="cover" />
          ))}
        </View>
      </View>
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  description: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
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
    marginBottom: 8,
  },
  body: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
  },
  listItem: {
    fontSize: 13.5,
    color: "#334155",
    marginBottom: 4,
  },
  galleryRow: {
    gap: 8,
  },
  galleryImage: {
    width: "100%",
    height: 140,
    borderRadius: 12,
  },
  empty: {
    fontSize: 14,
    color: "#64748b",
  },
});
