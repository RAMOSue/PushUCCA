import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, DeviceEventEmitter, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useFocusEffect, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CartBadge from "../../src/components/navigation/CartBadge";
import { fetchReservedBorrowCart } from "../../src/services/borrowCart";
import { fetchUnreadNotificationCount } from "../../src/services/notifications";
import { useAuth } from "../../src/hooks/useAuth";

const MOBILE_APP_LOGO = require("../../assets/images/icon.png");

const TabsHeader = memo(function TabsHeader() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [cartCount, setCartCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isFlyingToCart, setIsFlyingToCart] = useState(false);
  const cartPulse = useRef(new Animated.Value(1)).current;
  const cartFlyAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cartButtonRef = useRef<View | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!user?.id) {
      setCartCount(0);
      setNotificationCount(0);
      return;
    }

    try {
      const [cart, unread] = await Promise.all([
        fetchReservedBorrowCart(user.id),
        fetchUnreadNotificationCount(),
      ]);

      setCartCount(Array.isArray(cart.items) ? cart.items.length : 0);
      setNotificationCount(unread || 0);
    } catch (error) {
      console.error("Error fetching tab header counts:", error);
      setCartCount(0);
      setNotificationCount(0);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void fetchCounts();
    }, [fetchCounts])
  );

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("cart:animate", (payload) => {
      const fromX = payload?.fromX ?? 0;
      const fromY = payload?.fromY ?? 0;

      cartButtonRef.current?.measureInWindow((x, y, width, height) => {
        const destX = x + width / 2 - 18;
        const destY = y + height / 2 - 18;

        setIsFlyingToCart(true);
        cartFlyAnim.setValue({ x: fromX - destX, y: fromY - destY });

        Animated.parallel([
          Animated.timing(cartFlyAnim, {
            toValue: { x: 0, y: 0 },
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(cartPulse, { toValue: 1.18, duration: 140, useNativeDriver: true }),
            Animated.timing(cartPulse, { toValue: 1, duration: 180, useNativeDriver: true }),
          ]),
        ]).start(() => {
          setIsFlyingToCart(false);
          cartFlyAnim.setValue({ x: 0, y: 0 });
        });
      });
    });

    return () => subscription.remove();
  }, [cartFlyAnim, cartPulse]);

  const handleCartPress = useCallback(() => {
    router.push("/(tabs)/borrow-cart");
  }, [router]);

  const handleNotificationsPress = useCallback(() => {
    router.push("/(tabs)/notifications");
  }, [router]);

  return (
    <View style={[styles.headerShell, { paddingTop: insets.top }]}>
      {isFlyingToCart ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingCart,
            {
              transform: [
                { translateX: cartFlyAnim.x },
                { translateY: cartFlyAnim.y },
              ],
            },
          ]}
        >
          <Ionicons name="cart-outline" size={20} color="#ffffff" />
        </Animated.View>
      ) : null}

      <View style={styles.headerContent}>
        <View style={styles.brandBlock}>
          <Image source={MOBILE_APP_LOGO} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.title}>UCCA</Text>
            <Text style={styles.subtitle}>Caraga State University</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable ref={cartButtonRef} onPress={handleCartPress} style={styles.actionButton} hitSlop={10}>
            <Animated.View style={{ transform: [{ scale: cartPulse }] }}>
              <Ionicons name="cart-outline" size={22} color="#0f172a" />
            </Animated.View>
            <CartBadge count={cartCount} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const isScannerOpen = segments[segments.length - 1] === "scan-qr";

  const handleToggleScanner = useCallback(() => {
    if (isScannerOpen) {
      router.back();
      return;
    }

    router.push("/(tabs)/scan-qr");
  }, [isScannerOpen, router]);

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: "#ffffff",
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      height: 82,
      paddingTop: 4,
      paddingBottom: insets.bottom + 8,
      paddingHorizontal: 16,
      elevation: 10,
      shadowColor: "#020617",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -4 },
    }),
    [insets.bottom]
  );

  return (
    <View style={styles.shell}>
      <TabsHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#2563eb",
          tabBarInactiveTintColor: "#64748b",
          tabBarStyle,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700",
            marginTop: 2,
            textAlign: "center",
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
          tabBarItemStyle: {
            flex: 1,
            minWidth: 0,
            paddingTop: 6,
            paddingBottom: 2,
            justifyContent: "center",
            alignItems: "center",
            minHeight: 56,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="borrow-cart"
          options={{ href: null }}
        />
        
        <Tabs.Screen
          name="scan-qr"
          options={{ href: null }}
        />
        

        <Tabs.Screen
          name="available-items"
          options={{
            title: "Items",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="borrowed"
          options={{
            title: "Borrowed",
            tabBarItemStyle: {
            marginRight: 40,
            marginTop: 6, // adjust this value
          },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cube-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="notifications"
          options={{
            title: "Alerts",
            tabBarItemStyle: {
            marginLeft: 40,
            marginTop: 6 // adjust this value
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={24} color={color} />
            ),
          }}
        />
      </Tabs>

      <View style={[styles.fabContainer, { paddingBottom: insets.bottom + 18 }]} pointerEvents="box-none">
        <Pressable
          onPress={handleToggleScanner}
          android_ripple={{ color: "rgba(255,255,255,0.18)", radius: 36 }}
          accessibilityRole="button"
          accessibilityLabel="Open scanner"
          style={({ pressed }) => [
            styles.fab,
            { transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={26} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerShell: {
    zIndex: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  flyingCart: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    elevation: 60,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "box-none",
    zIndex: 30,
    elevation: 30,
  },
  fab: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 12,
    borderWidth: 2,
    borderColor: "#ffffff",
    overflow: "hidden",
  },
});