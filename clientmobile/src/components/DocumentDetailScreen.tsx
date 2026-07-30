import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { PermissionStatus } from "expo-modules-core";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../services/api";

type UploadField = "birth_certificate" | "class_schedule" | "id_front" | "id_back";

type DocumentField = {
  key: string;
  label: string;
  uploadField: UploadField;
};

type DocumentDetailScreenProps = {
  title: string;
  subtitle: string;
  items: DocumentField[];
};

type ProfileData = {
  [key: string]: any;
};

export default function DocumentDetailScreen({ title, subtitle, items }: DocumentDetailScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTab?: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<DocumentField | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const handleReturnToProfile = useCallback(() => {
    const targetTab = params.returnTab === "documents" ? "documents" : undefined;
    const profileRoute = {
      pathname: "/(tabs)/profile" as const,
      params: targetTab ? { tab: targetTab } : {},
    };

    router.replace(profileRoute as any);
  }, [params.returnTab, router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleReturnToProfile();
      return true;
    });

    return () => subscription.remove();
  }, [handleReturnToProfile]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ profile?: ProfileData } | ProfileData>("/api/profiles/me");
      const returnedProfile = (data as { profile?: ProfileData }).profile || (data as ProfileData);
      setProfile(returnedProfile);
    } catch (err) {
      console.error("Failed to load profile for document screen", err);
      Alert.alert("Unable to load", "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const ensureMediaLibraryPermission = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow gallery access to choose a photo.");
      return false;
    }
    return true;
  }, []);

  const ensureCameraPermission = useCallback(async () => {
    if (cameraPermission?.status === PermissionStatus.GRANTED) {
      return true;
    }

    const result = await requestCameraPermission();
    if (!result.granted) {
      Alert.alert("Camera permission required", "Please allow camera access to take a photo.");
      return false;
    }
    return true;
  }, [cameraPermission?.status, requestCameraPermission]);

  const uploadFile = useCallback(
    async (field: UploadField, uri: string) => {
      setUploadingField(field);
      try {
        const formData = new FormData();
        formData.append(field, {
          uri,
          name: `${field}-${Date.now()}.jpg`,
          type: "image/jpeg",
        } as any);

        const response = await api.post("/api/profiles/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const returnedProfile = response.data.profile || response.data;
        setProfile(returnedProfile);
        Alert.alert("Uploaded", "Your document was updated successfully.");
      } catch (err) {
        console.error("Upload failed", err);
        Alert.alert("Upload failed", "Please try again.");
      } finally {
        setUploadingField(null);
      }
    },
    []
  );

  const handlePickFromGallery = useCallback(
    async (item: DocumentField) => {
      const granted = await ensureMediaLibraryPermission();
      if (!granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await uploadFile(item.uploadField, result.assets[0].uri);
      }
    },
    [ensureMediaLibraryPermission, uploadFile]
  );

  const openCameraPicker = useCallback(
    async (item: DocumentField) => {
      const granted = await ensureCameraPermission();
      if (!granted) return;
      setCameraTarget(item);
      setCapturedUri(null);
      setCameraOpen(true);
    },
    [ensureCameraPermission]
  );

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePicture({ quality: 0.8, skipProcessing: true });
      setCapturedUri(photo.uri);
    } catch (err) {
      console.error("Camera capture failed", err);
      Alert.alert("Capture failed", "Unable to capture the photo. Please try again.");
    }
  }, []);

  const confirmCapture = useCallback(async () => {
    if (!cameraTarget || !capturedUri) return;
    await uploadFile(cameraTarget.uploadField, capturedUri);
    setCameraOpen(false);
    setCapturedUri(null);
    setCameraTarget(null);
  }, [cameraTarget, capturedUri, uploadFile]);

  const closeCamera = useCallback(() => {
    setCameraOpen(false);
    setCapturedUri(null);
    setCameraTarget(null);
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={handleReturnToProfile} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          items.map((item) => {
            const previewUrl = profile?.[item.key] ?? null;
            const isUploaded = Boolean(previewUrl);

            return (
              <View key={item.key} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{item.label}</Text>
                    <Text style={styles.cardStatus}>{isUploaded ? "Uploaded" : "Not uploaded"}</Text>
                  </View>
                </View>

                {previewUrl ? (
                  <Pressable onPress={() => Alert.alert("Preview", "Tap the preview to keep using the current image.") } style={styles.previewBox}>
                    <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={36} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No document uploaded yet</Text>
                    <Text style={styles.emptySubtitle}>Use upload or camera to add this document.</Text>
                  </View>
                )}

                <View style={styles.actionsRow}>
                  <Pressable style={styles.primaryButton} onPress={() => handlePickFromGallery(item)}>
                    {uploadingField === item.uploadField ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{isUploaded ? "Replace" : "Upload"}</Text>
                    )}
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => openCameraPicker(item)}>
                    <Ionicons name="camera-outline" size={16} color="#2563eb" />
                    <Text style={styles.secondaryButtonText}>Camera</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide">
        <View style={styles.cameraScreen}>
          <View style={styles.cameraHeader}>
            <Pressable onPress={closeCamera} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </Pressable>
            <Text style={styles.cameraTitle}>{cameraTarget?.label || "Capture photo"}</Text>
            <View style={styles.cameraSpacer} />
          </View>

          <View style={styles.cameraPreviewWrapper}>
            <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" ratio="16:9" />
          </View>

          <View style={styles.cameraActions}>
            <Pressable style={styles.captureButton} onPress={capturePhoto}>
              <Ionicons name="ellipse" size={64} color="#ffffff" />
            </Pressable>
          </View>

          {capturedUri ? (
            <View style={styles.reviewCard}>
              <Image source={{ uri: capturedUri }} style={styles.reviewImage} />
              <View style={styles.reviewActions}>
                <Pressable style={styles.secondaryButton} onPress={() => setCapturedUri(null)}>
                  <Text style={styles.secondaryButtonText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={confirmCapture}>
                  <Text style={styles.primaryButtonText}>Upload</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
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
    paddingTop: Platform.OS === "ios" ? 12 : 8,
    paddingBottom: 12,
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  loader: {
    paddingVertical: 24,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  cardStatus: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  previewBox: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  previewImage: {
    width: "100%",
    height: 220,
  },
  emptyState: {
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  cameraHeader: {
    height: 72,
    paddingTop: Platform.OS === "ios" ? 36 : 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    padding: 8,
  },
  cameraTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  cameraSpacer: {
    width: 34,
  },
  cameraPreviewWrapper: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraPreview: {
    flex: 1,
  },
  cameraActions: {
    padding: 16,
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCard: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  reviewImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
  },
});
