import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";

const policySections = [
  { title: "Borrowing Policy", body: "Borrowers must request items in advance and ensure they are returned on or before the agreed due date." },
  { title: "Return Policy", body: "Returned items should be checked in complete and in good condition to support fair access for everyone." },
  { title: "Late Return Policy", body: "Late returns may result in temporary borrowing restrictions until the item is properly returned." },
  { title: "Costume Care", body: "Costumes should be handled carefully, kept clean, and returned without damage or excessive wear." },
  { title: "Instrument Handling", body: "Instruments must be transported safely and used respectfully to preserve their condition and cultural value." },
  { title: "Member Responsibilities", body: "Members are expected to follow schedules, respect shared resources, and uphold the organization’s standards." },
];

export default function PoliciesScreen() {
  const [expanded, setExpanded] = useState<string | null>(policySections[0].title);

  return (
    <InfoPageLayout title="Policies & Guidelines" subtitle="Community standards and expectations">
      {policySections.map((section) => {
        const isExpanded = expanded === section.title;
        return (
          <View key={section.title} style={styles.card}>
            <Pressable style={styles.header} onPress={() => setExpanded(isExpanded ? null : section.title)}>
              <Text style={styles.headerTitle}>{section.title}</Text>
              <Text style={styles.chevron}>{isExpanded ? "−" : "+"}</Text>
            </Pressable>
            {isExpanded ? <Text style={styles.body}>{section.body}</Text> : null}
          </View>
        );
      })}
    </InfoPageLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  chevron: {
    fontSize: 18,
    color: "#2563eb",
    fontWeight: "700",
  },
  body: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
    marginTop: 10,
  },
});
