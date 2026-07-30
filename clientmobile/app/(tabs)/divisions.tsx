import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";
import { divisions } from "../../src/components/info/mockData";

export default function DivisionsScreen() {
  const router = useRouter();

  return (
    <InfoPageLayout title="Divisions" subtitle="Explore the organization’s groups">
      {divisions.map((division) => (
        <Pressable
          key={division.id}
          style={styles.card}
          onPress={() => router.push({ pathname: "/(tabs)/division-detail", params: { divisionId: division.id } })}
        >
          <Text style={styles.name}>{division.name}</Text>
          <Text style={styles.description}>{division.description}</Text>
          <Text style={styles.link}>View profile</Text>
        </Pressable>
      ))}
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: {
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
  link: {
    marginTop: 8,
    fontSize: 12.5,
    color: "#2563eb",
    fontWeight: "700",
  },
});
