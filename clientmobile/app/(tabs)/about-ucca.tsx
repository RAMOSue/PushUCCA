import { StyleSheet, Text, View } from "react-native";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";

const sections = [
  { title: "History", body: "UCCA was established to preserve, promote, and celebrate local traditions and cultural identity through organized activities and community engagement." },
  { title: "Mission", body: "To strengthen cultural awareness, nurture talent, and build a sense of belonging through artistic and heritage-centered programs." },
  { title: "Vision", body: "To become a recognized home for cultural preservation, education, and community pride." },
  { title: "Objectives", body: "To support performance practice, organize cultural events, preserve traditional knowledge, and inspire the next generation of artists and leaders." },
  { title: "Organizational Structure", body: "The organization is guided by its officers, advisers, and active members who collaborate to plan programs and preserve cultural identity." },
  { title: "Adviser", body: "Adviser: Ms. Lorna De Leon" },
  { title: "Contact Information", body: "For inquiries, please reach out to the UCCA office through the campus administration or designated student officers." },
];

export default function AboutUCCAScreen() {
  return (
    <InfoPageLayout title="About UCCA" subtitle="Cultural organization overview">
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
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
});
