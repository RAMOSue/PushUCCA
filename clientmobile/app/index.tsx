import { useEffect, useState } from "react";
import { StyleSheet, Image, View } from "react-native";
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
        <Image
          source={require("../assets/images/Logo/DuBudKa.png")}
          style={styles.logo}
          resizeMode="contain"
        />
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
  logo: {
    width: 280,
    height: 120,
  },
});
