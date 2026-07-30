import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { InfoPageLayout } from "../../src/components/info/InfoPageLayout";

const faqs = [
  { question: "How do I borrow items?", answer: "Open the Items tab, select an item, and place it into your cart before submitting a borrow request." },
  { question: "How do I return items?", answer: "Use the Borrowed tab to view your current requests and follow the return instructions provided there." },
  { question: "How does QR code borrowing work?", answer: "Use the scanner from the floating button to scan an item or event code and continue the borrowing flow." },
  { question: "Who should I contact for assistance?", answer: "Please contact your organization adviser or the UCCA office for help with account or borrowing concerns." },
];

export default function HelpScreen() {
  const [expanded, setExpanded] = useState<string | null>(faqs[0].question);

  return (
    <InfoPageLayout title="Help / FAQ" subtitle="Quick answers for common questions">
      {faqs.map((faq) => {
        const isExpanded = expanded === faq.question;
        return (
          <View key={faq.question} style={styles.card}>
            <Pressable style={styles.header} onPress={() => setExpanded(isExpanded ? null : faq.question)}>
              <Text style={styles.question}>{faq.question}</Text>
              <Text style={styles.chevron}>{isExpanded ? "−" : "+"}</Text>
            </Pressable>
            {isExpanded ? <Text style={styles.answer}>{faq.answer}</Text> : null}
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
  question: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    paddingRight: 12,
  },
  chevron: {
    fontSize: 18,
    color: "#2563eb",
    fontWeight: "700",
  },
  answer: {
    fontSize: 13.5,
    color: "#334155",
    lineHeight: 20,
    marginTop: 10,
  },
});
