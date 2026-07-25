import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    router.replace(isAuthenticated && user?.role === "borrower" ? "/(tabs)/available-items" : "/(auth)/login");
  }, [isAuthenticated, isLoading, router, user?.role]);

  return null;
}
