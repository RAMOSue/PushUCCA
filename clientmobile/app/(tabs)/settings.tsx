import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";

type SettingSection = {
  title: string;
  items: Array<{
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    value?: string;
    type?: "navigation" | "toggle" | "info";
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }>;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privateModeEnabled, setPrivateModeEnabled] = useState(false);

  const sections = useMemo<SettingSection[]>(() => [
    {
      title: "Account",
      items: [
        {
          key: "email",
          icon: "mail-outline",
          title: "Email address",
          subtitle: user?.email || "No email provided",
          type: "info",
        },
        {
          key: "phone",
          icon: "call-outline",
          title: "Phone number",
          subtitle: user?.phone || "No phone number provided",
          type: "info",
        },
        {
          key: "password",
          icon: "lock-closed-outline",
          title: "Change password",
          subtitle: "Update your account credentials",
          type: "navigation",
          onPress: () => router.push("/(tabs)/change-password"),
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          key: "notifications",
          icon: "notifications-outline",
          title: "Notifications",
          subtitle: "Receive alert updates for important activity",
          type: "toggle",
          rightElement: (
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#cbd5e1", true: "#2563eb" }}
              thumbColor="#ffffff"
            />
          ),
        },
        {
          key: "theme",
          icon: "color-palette-outline",
          title: "Theme",
          subtitle: "System follows your device settings",
          type: "navigation",
          onPress: () => Alert.alert("Coming soon", "Theme selection will be available soon."),
        },
        {
          key: "language",
          icon: "language-outline",
          title: "Language",
          subtitle: "English",
          type: "navigation",
          onPress: () => Alert.alert("Coming soon", "Language preferences will be available soon."),
        },
      ],
    },
    {
      title: "Privacy & Security",
      items: [
        {
          key: "privacy",
          icon: "shield-checkmark-outline",
          title: "Privacy settings",
          subtitle: "Manage how your account appears across the app",
          type: "toggle",
          rightElement: (
            <Switch
              value={privateModeEnabled}
              onValueChange={setPrivateModeEnabled}
              trackColor={{ false: "#cbd5e1", true: "#2563eb" }}
              thumbColor="#ffffff"
            />
          ),
        },
        {
          key: "session",
          icon: "information-circle-outline",
          title: "Session info",
          subtitle: `${user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User"} account` ,
          type: "info",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          key: "help",
          icon: "help-circle-outline",
          title: "Help",
          subtitle: "Get help with borrowing and account access",
          type: "navigation",
          onPress: () => Alert.alert("Support", "Please contact your administrator for assistance."),
        },
        {
          key: "about",
          icon: "information-outline",
          title: "About",
          subtitle: "Neon campus borrowing made simple",
          type: "navigation",
          onPress: () => Alert.alert("About Neon", "Version 1.0.0 • Built for campus borrowing workflows."),
        },
        {
          key: "version",
          icon: "code-outline",
          title: "Version",
          subtitle: "1.0.0",
          type: "info",
        },
      ],
    },
  ], [notificationsEnabled, privateModeEnabled, router, user?.email, user?.phone, user?.role]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={item.onPress}
                disabled={!item.onPress || item.type === "info"}
              >
                <View style={styles.rowIconWrap}>
                  <Ionicons name={item.icon} size={18} color="#2563eb" />
                </View>

                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                </View>

                {item.type === "toggle" ? (
                  item.rightElement
                ) : item.type === "navigation" ? (
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: {
    marginLeft: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  content: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  rowPressed: {
    opacity: 0.9,
    backgroundColor: "#f8fafc",
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12.5,
    color: "#64748b",
    lineHeight: 18,
  },
});
