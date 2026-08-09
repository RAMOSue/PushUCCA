import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import {
  addBorrowCartItems,
  fetchReservedBorrowCart,
  scanBorrowQrCode,
  scanBorrowQrCodeFlexible,
  startBorrowingSession,
} from "../../src/services/borrowCart";

const STATUS_RESET_MS = 1200;

type ScanState = "idle" | "processing" | "success" | "error";

const DEFAULT_STATUS_MESSAGE = "Align the QR code inside the frame.";

function getFriendlyScanMessage(error: unknown, fallback = "Unable to connect. Please try again.") {
  const rawMessage =
    typeof error === "string"
      ? error
      : (error as { response?: { data?: { error?: string } }; message?: string } | undefined)?.response?.data?.error ||
        (error as { response?: { data?: { error?: string } }; message?: string } | undefined)?.message ||
        "";
  const normalized = String(rawMessage).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (
    normalized.includes("already in the cart") ||
    normalized.includes("already added") ||
    normalized.includes("already reserved") ||
    normalized.includes("already exists")
  ) {
    return "Already in your borrow cart.";
  }

  if (
    normalized.includes("currently borrowed") ||
    normalized.includes("not available") ||
    normalized.includes("borrowed") ||
    normalized.includes("reserved")
  ) {
    return "This item is currently borrowed.";
  }

  if (
    normalized.includes("invalid qr") ||
    normalized.includes("qr code not found") ||
    normalized.includes("not recognized") ||
    normalized.includes("not found")
  ) {
    return "Invalid QR Code.";
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("camera") && normalized.includes("denied")
  ) {
    return "Camera permission is required.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("fetch") ||
    normalized.includes("request failed") ||
    normalized.includes("connection")
  ) {
    return "Unable to connect. Please try again.";
  }

  return fallback;
}

export default function ScanQrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();

  const [permission, requestCameraPermission] = useCameraPermissions();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusKind, setStatusKind] = useState<ScanState>("idle");
  const [statusMessage, setStatusMessage] = useState(DEFAULT_STATUS_MESSAGE);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const scanLockedRef = useRef(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const refreshReservedRequest = useCallback(async () => {
    if (!user?.id) {
      setRequestId(null);
      return;
    }

    try {
      const data = await fetchReservedBorrowCart(user.id);
      const nextRequestId = data?.request_id ?? null;
      setRequestId(nextRequestId);

      if (!nextRequestId) {
        const startedSession = await startBorrowingSession();
        const startedRequestId = startedSession?.borrowingId ?? startedSession?.request_id ?? null;
        setRequestId(startedRequestId);
      }
    } catch {
      try {
        const startedSession = await startBorrowingSession();
        const startedRequestId = startedSession?.borrowingId ?? startedSession?.request_id ?? null;
        setRequestId(startedRequestId);
      } catch {
        setRequestId(null);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!permission) {
      void requestCameraPermission();
      return;
    }

    if (!permission.granted) {
      setPermissionError("Camera access is required to scan QR codes.");
    } else {
      setPermissionError(null);
    }
  }, [permission, requestCameraPermission]);

  useEffect(() => {
    if (user?.id) {
      void refreshReservedRequest();
    }
  }, [refreshReservedRequest, user?.id]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const animateStatus = useCallback((kind: ScanState, message: string, detail?: string | null) => {
    setStatusKind(kind);
    setStatusMessage(message);
    setStatusDetail(detail ?? null);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const resetStatus = useCallback(() => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    statusTimeoutRef.current = setTimeout(() => {
      setStatusKind("idle");
      setStatusMessage(DEFAULT_STATUS_MESSAGE);
      setStatusDetail(null);
      fadeAnim.setValue(0);
    }, STATUS_RESET_MS);
  }, [fadeAnim]);

  const handleBarcodeScanned = useCallback(
    async (scanningResult: { data?: string } | null | undefined) => {
      if (scanLockedRef.current || isProcessing || authLoading || !user?.id) {
        return;
      }

      const scannedText = scanningResult?.data?.trim();
      if (!scannedText) {
        return;
      }

      const rawQr = scannedText;
      const normalizedQr = (() => {
        try {
          return decodeURIComponent(rawQr).trim().replace(/\r?\n/g, "");
        } catch {
          return rawQr.trim().replace(/\r?\n/g, "");
        }
      })();
      if (!normalizedQr) {
        return;
      }

      scanLockedRef.current = true;
      setIsProcessing(true);
      setStatusKind("processing");
      setStatusMessage("Processing scan...");
      setStatusDetail(null);

      try {
        let scanData: any = null;

        try {
          scanData = await scanBorrowQrCode(normalizedQr);
        } catch (error: any) {
          if (error?.response?.status !== 404) {
            throw error;
          }
        }

        if (!scanData) {
          try {
            scanData = await scanBorrowQrCodeFlexible(normalizedQr);
          } catch (error: any) {
            const status = error?.response?.status;
            const serverMessage = error?.response?.data?.error || error?.message || "QR code not found.";
            if (status === 404) {
              animateStatus("error", "QR code not found.");
            } else {
              animateStatus("error", serverMessage);
            }
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
          }
        }

        const payload = scanData?.data ?? scanData;
        const itemName = String(payload?.item_name ?? payload?.name ?? "Item");
        const unitId = payload?.unit_id ?? payload?.inventory_unit_id ?? payload?.id ?? null;
        const itemId = payload?.item_id ?? payload?.id ?? null;
        const statusValue = payload?.status ?? scanData?.status ?? null;

        if (statusValue && String(statusValue).toLowerCase() !== "available") {
          animateStatus("error", "This item is currently borrowed.", itemName);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        let activeRequestId = requestId;
        if (!activeRequestId) {
          const startedSession = await startBorrowingSession();
          activeRequestId = startedSession?.borrowingId ?? startedSession?.request_id ?? null;
          if (activeRequestId) {
            setRequestId(activeRequestId);
          }
        }

        const itemPayload: { unit_id?: string | number; item_id?: string | number; quantity: number } = { quantity: 1 };

        if (unitId) {
          itemPayload.unit_id = unitId;
        } else if (itemId) {
          itemPayload.item_id = itemId;
        } else {
          animateStatus("error", "Invalid QR Code.", "This code is not linked to a borrowable item.");
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        const response = await addBorrowCartItems({
          borrower_id: String(user.id),
          request_id: activeRequestId ?? undefined,
          items: [itemPayload],
        });

        if (response?.request_id) {
          setRequestId(response.request_id);
        }

        const addedCount = Array.isArray(response.items) ? response.items.length : 0;
        if (addedCount > 0) {
          animateStatus("success", "Added to Borrow Cart", itemName);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          const failureMessage = response?.failed_items?.[0]?.error || response?.error || "Unable to add scanned item to cart.";
          animateStatus("error", getFriendlyScanMessage(failureMessage), itemName);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (error: any) {
        const status = error?.response?.status;
        const serverMessage = error?.response?.data?.error || error?.message || "Unable to scan QR code.";

        if (status === 404) {
          animateStatus("error", "Invalid QR Code.", "This code was not recognized.");
        } else {
          animateStatus("error", getFriendlyScanMessage(serverMessage), null);
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsProcessing(false);
        scanLockedRef.current = false;
        resetStatus();
      }
    },
    [animateStatus, authLoading, isProcessing, requestId, resetStatus, user?.id]
  );

  const handleBarcodeScannedEvent = useCallback(
    (event: { data?: string }) => {
      void handleBarcodeScanned(event);
    },
    [handleBarcodeScanned]
  );

  const handleToggleFlash = useCallback(() => {
    setFlashEnabled((prev) => !prev);
  }, []);

  const handleCloseScanner = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenCart = useCallback(() => {
    router.push("/(tabs)/borrow-cart");
  }, [router]);

  const permissionGranted = Boolean(permission && permission.granted);

  const scanStatusLabel = useMemo(() => {
    if (statusKind === "error") return statusMessage;
    if (statusKind === "success") return statusMessage;
    if (isProcessing) return "Processing scan...";
    return statusMessage;
  }, [isProcessing, statusKind, statusMessage]);

  const statusIconName = statusKind === "success" ? "checkmark-circle-outline" : statusKind === "error" ? "alert-circle-outline" : isProcessing ? "sparkles-outline" : "qr-code-outline";
  const statusAccentStyle = statusKind === "success" ? styles.successAccent : statusKind === "error" ? styles.errorAccent : styles.infoAccent;

  if (!permission) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Requesting camera access…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={[styles.centeredContent, { paddingHorizontal: 24 }]}> 
          <Ionicons name="camera-outline" size={48} color="#ffffff" />
          <Text style={styles.title}>Camera Permission Needed</Text>
          <Text style={styles.messageText}>
            {permissionError || "Please enable camera access to scan QR codes."}
          </Text>
          <Pressable style={styles.actionButton} onPress={() => void requestCameraPermission()}>
            <Text style={styles.actionButtonText}>Grant Access</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashEnabled}
        flash={flashEnabled ? "on" : "off"}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarcodeScannedEvent}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.topTitle}>Scan QR Code</Text>

          <View style={styles.scanStatusPanel}>
            <View style={[styles.statusBadge, statusAccentStyle]}>
              <Ionicons name={statusIconName} size={18} color="#ffffff" />
              <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <Text style={styles.footerText}>{scanStatusLabel}</Text>
                {statusDetail ? <Text style={styles.footerDetail}>{statusDetail}</Text> : null}
              </Animated.View>
            </View>
            {isProcessing ? <ActivityIndicator color="#ffffff" style={{ marginTop: 12 }} /> : null}
          </View>
        </View>

        <View style={styles.overlayContainer}>
          <View style={styles.frameShell}>
            <View style={styles.scanFrame}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] }) }],
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.flashDock}>
          <Pressable style={styles.flashButton} onPress={handleToggleFlash}>
            <Ionicons
              name={flashEnabled ? "flashlight" : "flashlight-outline"}
              size={24}
              color="#ffffff"
              style={styles.flashIcon}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      {statusKind === "processing" ? (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.processingText}>Adding item to cart…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  topTitle: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  scanStatusPanel: {
    width: "100%",
    marginTop: 16,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 34,
    paddingTop: 80,
    paddingBottom: 160,
    backgroundColor: "rgba(2, 6, 23, 0.58)",
  },
  flashDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: "center",
    zIndex: 25,
  },
  flashButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  flashIcon: {
    transform: [{ rotate: "180deg" }],
  },
  frameShell: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 28,
    borderWidth: 1.6,
    borderColor: "rgba(255, 255, 255, 0.84)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2.2,
    backgroundColor: "#38bdf8",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    top: 0,
  },
  instructionText: {
    marginTop: 18,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cornerTopLeft: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 28,
    height: 28,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#38bdf8",
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#38bdf8",
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 16,
    left: 16,
    width: 28,
    height: 28,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#38bdf8",
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 28,
    height: 28,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#38bdf8",
    borderBottomRightRadius: 8,
  },
  footerArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  footerPanel: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  },
  infoAccent: {
    backgroundColor: "rgba(37, 99, 235, 0.24)",
  },
  successAccent: {
    backgroundColor: "rgba(22, 163, 74, 0.24)",
  },
  errorAccent: {
    backgroundColor: "rgba(239, 68, 68, 0.24)",
  },
  footerText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "left",
  },
  footerDetail: {
    color: "rgba(248, 250, 252, 0.84)",
    fontSize: 12,
    marginTop: 2,
  },
  footerActions: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  processingText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  loadingText: {
    marginTop: 12,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  title: {
    marginTop: 20,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  messageText: {
    marginTop: 10,
    color: "#cbd5e1",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
});
