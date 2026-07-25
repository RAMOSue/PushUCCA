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
  startBorrowingSession,
} from "../../src/services/borrowCart";

const SUCCESS_DISPLAY_MS = 1400;
const STATUS_RESET_MS = 2200;

type ScanState = "idle" | "processing" | "success" | "error";

export default function ScanQrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();

  const [permission, requestCameraPermission] = useCameraPermissions();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusKind, setStatusKind] = useState<ScanState>("idle");
  const [statusMessage, setStatusMessage] = useState("Align the QR code inside the frame.");
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

  const animateStatus = useCallback((kind: ScanState, message: string) => {
    setStatusKind(kind);
    setStatusMessage(message);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
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
      setStatusMessage("Align the QR code inside the frame.");
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

      scanLockedRef.current = true;
      setIsProcessing(true);
      setStatusKind("processing");
      setStatusMessage("Processing scan...");

      try {
        const normalizedQr = decodeURIComponent(scannedText);
        const scanData = await scanBorrowQrCode(normalizedQr);

        if (scanData.status && scanData.status.toLowerCase() !== "available") {
          animateStatus("error", `"${scanData.item_name ?? "Item"}" is not available.`);
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

        if (scanData.inventory_unit_id) {
          itemPayload.unit_id = scanData.inventory_unit_id;
        } else if (scanData.item_id) {
          itemPayload.item_id = scanData.item_id;
        } else {
          animateStatus("error", "QR code is not linked to a borrowable item.");
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
          const name = String(scanData.item_name ?? scanData.inventory_unit_id ?? "Item");
          animateStatus("success", `Added “${name}”`);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          const failureMessage = response?.failed_items?.[0]?.error || response?.error || "Unable to add scanned item to cart.";
          animateStatus("error", failureMessage);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (error: any) {
        const status = error?.response?.status;
        const serverMessage = error?.response?.data?.error || error?.message || "Unable to scan QR code.";

        if (status === 404) {
          animateStatus("error", "QR code not found.");
        } else {
          animateStatus("error", serverMessage);
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
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            <Pressable style={styles.controlButton} onPress={handleCloseScanner}>
              <Ionicons name="close-outline" size={24} color="#ffffff" />
            </Pressable>
            <Text style={styles.topTitle}>Scan QR Code</Text>
            <Pressable style={styles.controlButton} onPress={handleOpenCart}>
              <Ionicons name="cart-outline" size={24} color="#ffffff" />
            </Pressable>
          </View>

          <View style={styles.overlayContainer}>
            <View style={styles.overlayTop} />
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
            <Text style={styles.instructionText}>Align the QR Code inside the frame</Text>
            <View style={styles.overlayBottom} />
          </View>

          <View style={styles.footerArea}>
            <View style={styles.footerPanel}>
              <Animated.Text
                style={[
                  styles.footerText,
                  statusKind === "error" ? styles.errorText : statusKind === "success" ? styles.successText : null,
                  { opacity: fadeAnim },
                ]}
              >
                {scanStatusLabel}
              </Animated.Text>
              <View style={styles.footerActions}>
                <Pressable style={styles.flashButton} onPress={handleToggleFlash}>
                  <Ionicons name={flashEnabled ? "flash" : "flash-outline"} size={20} color="#0f172a" />
                  <Text style={styles.flashButtonText}>{flashEnabled ? "Flash On" : "Flash Off"}</Text>
                </Pressable>
                {isProcessing ? <ActivityIndicator color="#ffffff" style={{ marginLeft: 12 }} /> : null}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </CameraView>

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
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  overlayTop: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  overlayBottom: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  scanFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#38bdf8",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    top: 0,
  },
  instructionText: {
    marginTop: 16,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  cornerTopLeft: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#38bdf8",
  },
  cornerTopRight: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#38bdf8",
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: 14,
    left: 14,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#38bdf8",
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#38bdf8",
  },
  footerArea: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footerPanel: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  footerText: {
    color: "#f8fafc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  errorText: {
    color: "#fecaca",
  },
  successText: {
    color: "#86efac",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  flashButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  flashButtonText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.65)",
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
