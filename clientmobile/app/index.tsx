import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (showSplash || isLoading) {
      return;
    }

    if (isAuthenticated && user?.role === "borrower") {
      router.replace("/(tabs)/available-items");
      return;
    }

    router.replace("/(auth)/login");
  }, [isAuthenticated, isLoading, router, showSplash, user?.role]);

  if (showSplash) {
    return (
      <View style={styles.splashScreen}>
        <Text style={styles.logoText}>
          <Text style={styles.logoBlue}>Du</Text>
          <Text style={styles.logoYellow}>Bud</Text>
          <Text style={styles.logoRed}>Ka</Text>
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  splashScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  logoText: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  logoBlue: {
    color: "#0f2f6b",
  },
  logoYellow: {
    color: "#fbbf24",
  },
  logoRed: {
    color: "#dc2626",
  },
});
