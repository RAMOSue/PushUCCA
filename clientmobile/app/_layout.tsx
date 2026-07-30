import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { MobileRealtimeProvider } from "../src/context/MobileRealtimeContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <MobileRealtimeProvider>
              <AuthGate />
              <Stack screenOptions={{ headerShown: false }} />
            </MobileRealtimeProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated, user, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isBorrower = user?.role === "borrower";

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const group = segments[0];
    const inAuthGroup = group === "(auth)";
    const inTabsGroup = group === "(tabs)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (isAuthenticated && !isBorrower) {
      void logout();

      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }

      return;
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)/available-items");
      return;
    }

    if (isAuthenticated && isBorrower && !inAuthGroup && !inTabsGroup) {
      router.replace("/(tabs)/available-items");
    }
  }, [isAuthenticated, isBorrower, isLoading, logout, router, segments]);

  return null;
}
