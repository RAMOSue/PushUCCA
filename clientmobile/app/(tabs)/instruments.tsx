import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";
import { instruments } from "../../src/components/info/mockData";

export default function InstrumentsScreen() {
  const router = useRouter();

  return (
    <InfoPageLayout title="Indigenous Instruments" subtitle="Highlights of traditional music">
      {instruments.map((item) => (
        <Pressable key={item.id} style={styles.card} onPress={() => router.push({ pathname: "/(tabs)/instrument-detail", params: { instrumentId: item.id } })}>
          <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
          <View style={styles.content}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.tribe}>{item.tribe}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        </Pressable>
      ))}
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  image: {
    width: "100%",
    height: 150,
  },
  content: {
    padding: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  tribe: {
    fontSize: 12.5,
    color: "#2563eb",
    fontWeight: "600",
    marginBottom: 4,
  },
  description: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
  },
});
