import { useCallback } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();


  const handleLogout = useCallback(async () => {
    Alert.alert("Log out", "Do you want to sign out of the app?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, [logout, router]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={28} color="#2563eb" />
          </View>
          <Text style={styles.name}>{user?.name || "Borrower"}</Text>
          <Text style={styles.meta}>{user?.email || "No email available"}</Text>
          <Text style={styles.meta}>Role: {user?.role || "borrower"}</Text>
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color="#ffffff" />
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  card: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    gap: 8,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  meta: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#dc2626",
    paddingVertical: 14,
  },
  logoutButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
});
