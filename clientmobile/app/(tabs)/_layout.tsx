import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, DeviceEventEmitter, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useFocusEffect, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CartBadge from "../../src/components/navigation/CartBadge";
import { markAllNotificationsAsRead } from "../../src/services/notifications";
import { useMobileRealtime } from "../../src/context/MobileRealtimeContext";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/services/api";

type TabsHeaderProps = {
  cartCount: number;
  onCartCountChange?: (count: number) => void;
  onAnimationStateChange?: (state: { isFlying: boolean; preview: { uri?: string; icon?: string } | null; fromX: number; fromY: number; destX: number; destY: number } | null) => void;
};

const TabsHeader = memo(function TabsHeader({ cartCount, onCartCountChange, onAnimationStateChange, onMenuPress }: TabsHeaderProps & { onMenuPress: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartPulse = useRef(new Animated.Value(1)).current;
  const cartButtonRef = useRef<View | null>(null);
  const { cartCount: realtimeCartCount, divisionFilter, setDivisionFilter, refreshCartCount } = useMobileRealtime();
  const [badgePulseKey, setBadgePulseKey] = useState(0);
  const [badgePulseDirection, setBadgePulseDirection] = useState<"in" | "out">("in");
  const [divisionMenuVisible, setDivisionMenuVisible] = useState(false);
  const divisionMenuOpacity = useRef(new Animated.Value(0)).current;
  const divisionMenuTranslateY = useRef(new Animated.Value(-6)).current;

  const fetchCounts = useCallback(async () => {
    const nextCount = await refreshCartCount();
    onCartCountChange?.(nextCount);
  }, [onCartCountChange, refreshCartCount]);

  useFocusEffect(
    useCallback(() => {
      void fetchCounts();
    }, [fetchCounts])
  );

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const animateSubscription = DeviceEventEmitter.addListener("cart:animate", (payload) => {
      const kind = payload?.kind === "remove" ? "remove" : "add";
      const fromX = payload?.fromX ?? 0;
      const fromY = payload?.fromY ?? 0;

      setBadgePulseDirection(kind === "remove" ? "out" : "in");
      setBadgePulseKey((previous) => previous + 1);

      if (kind === "remove") {
        return;
      }

      cartButtonRef.current?.measureInWindow((x, y, width, height) => {
        const destX = x + width / 2 - 18;
        const destY = y + height / 2 - 18;

        onAnimationStateChange?.({
          isFlying: true,
          preview: payload?.imageUri ? { uri: payload.imageUri } : payload?.previewIcon ? { icon: payload.previewIcon } : null,
          fromX,
          fromY,
          destX,
          destY,
        });

        Animated.sequence([
          Animated.timing(cartPulse, { toValue: 1.12, duration: 120, useNativeDriver: true }),
          Animated.timing(cartPulse, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]).start();
      });
    });

    return () => {
      animateSubscription.remove();
    };
  }, [cartPulse, onAnimationStateChange]);

  useEffect(() => {
    onCartCountChange?.(realtimeCartCount);
  }, [onCartCountChange, realtimeCartCount]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(divisionMenuOpacity, {
        toValue: divisionMenuVisible ? 1 : 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(divisionMenuTranslateY, {
        toValue: divisionMenuVisible ? 0 : -6,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [divisionMenuOpacity, divisionMenuTranslateY, divisionMenuVisible]);

  const handleCartPress = useCallback(() => {
    router.push("/(tabs)/borrow-cart");
  }, [router]);

  const subtitleText = divisionFilter && divisionFilter.trim() ? divisionFilter : "ᜇᜓᜊᜓᜇ᜔ᜃ";

  return (
    <View style={[styles.headerShell, { paddingTop: Math.max(0, insets.top - 4) }]}> 
      <View style={styles.headerContent}>
        <View style={styles.brandBlock}>
          <Pressable onPress={onMenuPress} style={styles.menuButton} hitSlop={10}>
            <MaterialCommunityIcons name="menu" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.brandTextBlock}>
            <Text style={styles.title}>
              <Text style={{ color: "#004aad" }}>Du</Text>
              <Text style={{ color: "#ffbd59" }}>Bud</Text>
              <Text style={{ color: "#ff3131" }}>Ka</Text>
            </Text>
            <View style={styles.subtitleWrap}>
              <Pressable onPress={() => setDivisionMenuVisible((previous) => !previous)} style={styles.subtitleButton} hitSlop={8}>
                <Text style={styles.subtitle}>{subtitleText}</Text>
              </Pressable>
              {divisionMenuVisible ? (
                <Animated.View style={[styles.divisionMenu, { opacity: divisionMenuOpacity, transform: [{ translateY: divisionMenuTranslateY }] }]}>
                  <Pressable
                    onPress={() => {
                      setDivisionFilter(null);
                      setDivisionMenuVisible(false);
                    }}
                    style={styles.divisionOption}
                  >
                    <Text style={[styles.divisionOptionText, !divisionFilter && styles.divisionOptionTextActive]}>All Divisions</Text>
                  </Pressable>
                  {[
                    { label: "Budjong", value: "Budjong" },
                    { label: "Dulimbay", value: "Dulimbay" },
                    { label: "Kayam", value: "Kayam" },
                  ].map((option) => {
                    const active = divisionFilter === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => {
                          setDivisionFilter(option.value);
                          setDivisionMenuVisible(false);
                        }}
                        style={styles.divisionOption}
                      >
                        <Text style={[styles.divisionOptionText, active && styles.divisionOptionTextActive]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </Animated.View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable ref={cartButtonRef} onPress={handleCartPress} style={styles.actionButton} hitSlop={10}>
            <Animated.View style={{ transform: [{ scale: cartPulse }] }}>
              <Ionicons name="cart-outline" size={22} color="#0f172a" />
            </Animated.View>
            <CartBadge count={cartCount} pulseKey={badgePulseKey} direction={badgePulseDirection} />
          </Pressable>
        </View>
      </View>

      {divisionMenuVisible ? <Pressable style={styles.headerOverlay} onPress={() => setDivisionMenuVisible(false)} /> : null}
    </View>
  );
});

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();
  const { cartCount, setCartCount, notificationCount, setNotificationCount, refreshNotificationCount } = useMobileRealtime();
  const [flightAnimation, setFlightAnimation] = useState<{
    isFlying: boolean;
    preview: { uri?: string; icon?: string } | null;
    fromX: number;
    fromY: number;
    destX: number;
    destY: number;
  } | null>(null);
  const cartFlyAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cartFlyScale = useRef(new Animated.Value(1.6)).current;
  const cartFlyOpacity = useRef(new Animated.Value(1)).current;
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const drawerOverlayAnim = useRef(new Animated.Value(0)).current;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerProfile, setDrawerProfile] = useState<{ name?: string | null; department_name?: string | null; profile_pic_url?: string | null } | null>(null);
  const drawerOpenOffset = Math.min(width * 0.75, 320);

  const isScannerOpen = segments[segments.length - 1] === "scan-qr";

  const handleToggleScanner = useCallback(() => {
    if (isScannerOpen) {
      router.back();
      return;
    }

    router.push("/(tabs)/scan-qr");
  }, [isScannerOpen, router]);

  const fetchNotificationCount = useCallback(async () => {
    await refreshNotificationCount();
  }, [refreshNotificationCount]);

  const fetchDrawerProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/api/profiles/me");
      const profile = data?.profile || data;
      setDrawerProfile({
        name: profile?.name || user?.name || "Guest User",
        department_name: profile?.department_name || null,
        profile_pic_url: profile?.profile_pic_url || null,
      });
    } catch (error) {
      console.error("Unable to load drawer profile", error);
      setDrawerProfile({
        name: user?.name || "Guest User",
        department_name: null,
        profile_pic_url: null,
      });
    }
  }, [user?.name]);

  const toggleDrawer = useCallback(() => {
    if (isDrawerOpen) {
      setIsDrawerOpen(false);
      return;
    }

    void fetchDrawerProfile();
    setIsDrawerOpen(true);
  }, [fetchDrawerProfile, isDrawerOpen]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/(auth)/login");
  }, [logout, router]);

  const drawerItems = [
    {
      label: "About UCCA",
      icon: "business-outline" as const,
      onPress: () => {
        closeDrawer();
        router.push("/(tabs)/about-ucca");
      },
    },
    {
      label: "Indigenous Library",
      icon: "library-outline" as const,
      onPress: () => {
        closeDrawer();
        router.push("/(tabs)/cultural-library");
      },
    },
    {
      label: "Policies & Guidelines",
      icon: "document-text-outline" as const,
      onPress: () => {
        closeDrawer();
        router.push("/(tabs)/policies");
      },
    },
    {
      label: "Help / FAQ",
      icon: "help-circle-outline" as const,
      onPress: () => {
        closeDrawer();
        router.push("/(tabs)/help");
      },
    },
    {
      label: "Announcements",
      icon: "megaphone-outline" as const,
      onPress: () => {
        closeDrawer();
        router.push("/(tabs)/announcements");
      },
    },
    {
      label: "Settings",
      icon: "settings-outline" as const,
      onPress: () => {
        closeDrawer();
        router.push("/(tabs)/settings");
      },
    },
  ];

  useEffect(() => {
    void fetchNotificationCount();
  }, [fetchNotificationCount]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: isDrawerOpen ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(drawerOverlayAnim, {
        toValue: isDrawerOpen ? 0.4 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerAnim, drawerOverlayAnim, isDrawerOpen]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("mobile:profile-updated", (payload) => {
      const nextProfile = payload?.profile;
      if (!nextProfile) {
        return;
      }

      setDrawerProfile({
        name: nextProfile.name || user?.name || "Guest User",
        department_name: nextProfile.department_name || null,
        profile_pic_url: nextProfile.profile_pic_url || null,
      });
    });

    return () => subscription.remove();
  }, [user?.name]);

  useEffect(() => {
    void fetchDrawerProfile();
  }, [fetchDrawerProfile]);

  useFocusEffect(
    useCallback(() => {
      void fetchNotificationCount();
    }, [fetchNotificationCount])
  );

  useEffect(() => {
    if (!flightAnimation?.isFlying) {
      return;
    }

    cartFlyAnim.setValue({ x: 0, y: 0 });
    cartFlyScale.setValue(1.8);
    cartFlyOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(cartFlyAnim, {
        toValue: {
          x: flightAnimation.destX - flightAnimation.fromX,
          y: flightAnimation.destY - flightAnimation.fromY,
        },
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(cartFlyScale, {
        toValue: 0.35,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(cartFlyOpacity, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFlightAnimation(null);
      cartFlyAnim.setValue({ x: 0, y: 0 });
      cartFlyScale.setValue(0.95);
      cartFlyOpacity.setValue(1);
    });
  }, [cartFlyAnim, cartFlyOpacity, cartFlyScale, flightAnimation]);

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
      {flightAnimation?.isFlying ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingOverlay,
            {
              left: flightAnimation.fromX,
              top: flightAnimation.fromY,
              transform: [
                { translateX: cartFlyAnim.x },
                { translateY: cartFlyAnim.y },
                { scale: cartFlyScale },
              ],
              opacity: cartFlyOpacity,
            },
          ]}
        >
          {flightAnimation.preview?.uri ? (
            <Image source={{ uri: flightAnimation.preview.uri }} style={styles.flyingPreviewImage} resizeMode="cover" />
          ) : (
            <Ionicons name={flightAnimation.preview?.icon === "musical-notes" ? "musical-notes" : "shirt"} size={20} color="#ffffff" />
          )}
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.mainContent,
          {
            transform: [{ translateX: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, drawerOpenOffset] }) }],
          },
        ]}
      >
        <TabsHeader cartCount={cartCount} onCartCountChange={setCartCount} onAnimationStateChange={setFlightAnimation} onMenuPress={toggleDrawer} />

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
          name="borrow-cart"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="scan-qr"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="documents/birth-certificate"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="documents/school-id"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="documents/class-schedule"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="settings"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="change-password"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="announcements"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="about-ucca"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="divisions"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="division-detail"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="cultural-library"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="instruments"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="instrument-detail"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="costumes"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="costume-detail"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="policies"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="help"
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
            tabBarBadge: notificationCount > 0 ? String(notificationCount > 99 ? "99+" : notificationCount) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: "#ef4444",
              color: "#ffffff",
            },
            tabBarItemStyle: {
              marginLeft: 40,
              marginTop: 6, // adjust this value
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications-outline" size={24} color={color} />
            ),
          }}
          listeners={() => ({
            tabPress: async () => {
              setNotificationCount(0);
              DeviceEventEmitter.emit("notifications:updated", { count: 0 });

              try {
                await markAllNotificationsAsRead();
                DeviceEventEmitter.emit("mobile:refresh", { screen: "notifications" });
              } catch (error) {
                console.error("Error marking notifications as read on tab press:", error);
              }
            },
          })}
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
      </Animated.View>

      <Animated.View
        pointerEvents={isDrawerOpen ? "auto" : "none"}
        style={styles.drawerShell}
      >
        <Animated.View
          pointerEvents={isDrawerOpen ? "auto" : "none"}
          style={[styles.drawerOverlay, { opacity: drawerOverlayAnim }]}
        >
          <Pressable style={styles.drawerOverlayPressable} onPress={closeDrawer} />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [-drawerOpenOffset, 0] }) }],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <View style={styles.drawerProfileRow}>
              <View style={styles.drawerAvatar}>
                {drawerProfile?.profile_pic_url ? (
                  <Image source={{ uri: drawerProfile.profile_pic_url }} style={styles.drawerAvatarImage} />
                ) : (
                  <Ionicons name="person-circle" size={48} color="#ffffff" />
                )}
              </View>
              <View style={styles.drawerUserInfo}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.drawerName}>{drawerProfile?.name || user?.name || "Guest User"}</Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.drawerSubtitle}>{drawerProfile?.department_name || "No division assigned"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.drawerBody}>
            <View style={styles.drawerMainMenu}>
              <Pressable
                key="Announcements"
                style={({ pressed }) => [styles.drawerItem, pressed && styles.drawerItemPressed]}
                onPress={drawerItems.find((item) => item.label === "Announcements")?.onPress}
              >
                <Ionicons name="megaphone-outline" size={20} color="#334155" />
                <Text style={styles.drawerItemText}>Announcements</Text>
              </Pressable>

              {drawerItems
                .filter((item) => item.label !== "Announcements" && item.label !== "Settings")
                .map((item) => (
                  <Pressable
                    key={item.label}
                    style={({ pressed }) => [styles.drawerItem, pressed && styles.drawerItemPressed]}
                    onPress={item.onPress}
                  >
                    <Ionicons name={item.icon} size={20} color="#334155" />
                    <Text style={styles.drawerItemText}>{item.label}</Text>
                  </Pressable>
                ))}

              <Pressable
                style={({ pressed }) => [styles.drawerItem, pressed && styles.drawerItemPressed]}
                onPress={drawerItems.find((item) => item.label === "Settings")?.onPress}
              >
                <Ionicons name="settings-outline" size={20} color="#334155" />
                <Text style={styles.drawerItemText}>Settings</Text>
              </Pressable>

              <View style={styles.divisionButtonRow}>
                <Pressable style={styles.divisionButton} onPress={() => {
                  closeDrawer();
                  router.push("/(tabs)/divisions");
                }}>
                  <View style={styles.divisionIconCircle}>
                    <Text style={styles.divisionGlyph}>🎭</Text>
                  </View>
                  <Text style={styles.divisionButtonText}>Dulimbay</Text>
                </Pressable>

                <Pressable style={styles.divisionButton} onPress={() => {
                  closeDrawer();
                  router.push("/(tabs)/divisions");
                }}>
                  <View style={styles.divisionIconCircle}>
                    <Text style={styles.divisionGlyph}>🐚</Text>
                  </View>
                  <Text style={styles.divisionButtonText}>Budjong</Text>
                </Pressable>

                <Pressable style={styles.divisionButton} onPress={() => {
                  closeDrawer();
                  router.push("/(tabs)/divisions");
                }}>
                  <View style={styles.divisionIconCircle}>
                    <Text style={styles.divisionGlyph}>🎸</Text>
                  </View>
                  <Text style={styles.divisionButtonText}>Kayam</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.logoutWrap}>
              <Pressable
                style={({ pressed }) => [styles.drawerLogoutButton, pressed && styles.drawerLogoutButtonPressed]}
                onPress={() => {
                  closeDrawer();
                  void handleLogout();
                }}
              >
                <Text style={styles.drawerLogoutText}>Log out</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
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
    paddingTop: 4,
    paddingBottom: 6,
    gap: 12,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1,
  },
  brandTextBlock: {
    minWidth: 0,
    flexShrink: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  subtitleWrap: {
    position: "relative",
    alignSelf: "flex-start",
  },
  subtitleButton: {
    paddingVertical: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  divisionMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 6,
    minWidth: 140,
    zIndex: 30,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  divisionOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  divisionOptionText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  divisionOptionTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 20,
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
  flyingOverlay: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 120,
    elevation: 120,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: "hidden",
  },
  flyingPreviewImage: {
    width: "100%",
    height: "100%",
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
  mainContent: {
    flex: 1,
  },
  drawerShell: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 40,
    elevation: 40,
    pointerEvents: "box-none",
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  drawerOverlayPressable: {
    flex: 1,
  },
  drawer: {
    width: "75%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    shadowColor: "#020617",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
    elevation: 8,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    minHeight: 56,
  },
  drawerProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    marginTop: 8,
  },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  drawerAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  drawerUserInfo: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minWidth: 0,
  },
  drawerName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    maxWidth: 180,
  },
  drawerSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    maxWidth: 180,
  },
  drawerBody: {
    flex: 1,
    paddingVertical: 8,
  },
  drawerMainMenu: {
    flex: 1,
  },
  logoutWrap: {
    justifyContent: "flex-end",
    paddingTop: 6,
    marginTop: -10,
    paddingHorizontal: 16,
  },
  drawerLogoutButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  drawerLogoutButtonPressed: {
    backgroundColor: "#cbd5e1",
  },
  drawerLogoutText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
  },
  divisionButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 10,
  },
  divisionButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 78,
  },
  divisionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  divisionGlyph: {
    fontSize: 20,
    color: "#334155",
    textAlign: "center",
  },
  divisionButtonText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  drawerItemPressed: {
    backgroundColor: "#f8fafc",
  },
  drawerItemText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  drawerItemTextDanger: {
    color: "#dc2626",
  },
});