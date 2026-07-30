import { Image, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";
import { instruments } from "../../src/components/info/mockData";

export default function InstrumentDetailScreen() {
  const params = useLocalSearchParams<{ instrumentId?: string }>();
  const item = instruments.find((entry) => entry.id === params.instrumentId);

  if (!item) {
    return (
      <InfoPageLayout title="Instrument" subtitle="Not found">
        <Text style={styles.empty}>Instrument information is not available.</Text>
      </InfoPageLayout>
    );
  }

  return (
    <InfoPageLayout title={item.name} subtitle="Instrument details">
      <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Indigenous Tribe</Text>
        <Text style={styles.body}>{item.tribe}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{item.description}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Origin</Text>
        <Text style={styles.body}>{item.origin}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How it is played</Text>
        <Text style={styles.body}>{item.extra}</Text>
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
