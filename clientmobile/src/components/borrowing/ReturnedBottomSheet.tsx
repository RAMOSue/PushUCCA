import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import { API_BASE_URL } from "../../constants/api";
import {
  fetchReturnPhotos,
  initiateReturnRequest,
  submitReturnRequest,
  uploadReturnPhoto,
} from "../../services/borrowHistory";
import type { BorrowHistoryRecord } from "../../types/borrowHistory";

function normalizeImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  return imageUrl.startsWith("http") ? imageUrl : `${API_BASE_URL}${imageUrl}`;
}

const ReturnedBottomSheet = memo(function ReturnedBottomSheet({
  record,
  visible,
  onClose,
  onReturnComplete,
}: {
  record: BorrowHistoryRecord | null;
  visible: boolean;
  onClose: () => void;
  onReturnComplete?: () => void;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [notes, setNotes] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<(string | number)[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returnRequestId, setReturnRequestId] = useState<string | number | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string | number; photo_url?: string }[]>([]);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const loadReturnPhotos = useCallback(async (requestId: string | number) => {
    try {
      const response = await fetchReturnPhotos(requestId);
      setExistingPhotos((Array.isArray(response.photos) ? response.photos : []) as { id: string | number; photo_url?: string }[]);
    } catch (error) {
      console.error("Error loading return photos:", error);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    sheetRef.current?.present();
    setNotes("");
    setSelectedUnitIds(
      (record?.items ?? [])
        .map((item) => item.id ?? item.unit_id ?? item.inventory_unit_id)
        .filter(Boolean) as (string | number)[]
    );
    setReturnRequestId(null);
    setCapturedPhotoUri(null);
    setExistingPhotos([]);

    if (record?.request_id) {
      void loadReturnPhotos(record.request_id);
    }
  }, [loadReturnPhotos, record, visible]);

  const photoCount = useMemo(() => existingPhotos.length + (capturedPhotoUri ? 1 : 0), [capturedPhotoUri, existingPhotos.length]);

  const toggleUnit = useCallback((unitId: string | number) => {
    setSelectedUnitIds((current) =>
      current.includes(unitId) ? current.filter((value) => value !== unitId) : [...current, unitId]
    );
  }, []);

  const handleInitiateReturn = useCallback(async () => {
    if (!record?.request_id || selectedUnitIds.length === 0) {
      Alert.alert("Select an item", "Please choose at least one item to return.");
      return;
    }

    setLoading(true);

    try {
      const response = await initiateReturnRequest({
        borrowing_request_id: record.request_id,
        returned_unit_ids: selectedUnitIds,
        notes,
      });

      if (!response.success) {
        Alert.alert("Unable to start return", response.error || "Please try again.");
        return;
      }

      setReturnRequestId(response.return_request_id ?? null);
      Alert.alert("Return started", response.message || "Capture a photo to continue.");
    } catch (error: any) {
      console.error("Initiate return error:", error?.response?.data || error?.message || error);
      Alert.alert("Unable to start return", error?.response?.data?.error || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [notes, record?.request_id, selectedUnitIds]);

  const handleCapturePhoto = useCallback(async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();

    if (!cameraPermission.granted) {
      Alert.alert("Camera permission needed", "Please allow camera access to capture a return photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
      mediaTypes: ["images"],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setCapturedPhotoUri(result.assets[0].uri);
    }
  }, []);

  const handleUploadPhoto = useCallback(async () => {
    if (!record?.request_id || !capturedPhotoUri) {
      return;
    }

    setPhotoUploading(true);

    try {
      const formData = new FormData();
      formData.append("photo", {
        uri: capturedPhotoUri,
        name: `return-photo-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);

      const uploadResponse = await uploadReturnPhoto(record.request_id, formData);

      if (!uploadResponse.success) {
        Alert.alert("Upload failed", uploadResponse.error || "Please try again.");
        return;
      }

      await loadReturnPhotos(record.request_id);
      setCapturedPhotoUri(null);
      Alert.alert("Photo uploaded", uploadResponse.message || "Your photo has been uploaded.");
    } catch (error: any) {
      console.error("Upload photo error:", error?.response?.data || error?.message || error);
      Alert.alert("Upload failed", error?.response?.data?.error || "Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  }, [capturedPhotoUri, loadReturnPhotos, record?.request_id]);

  const handleSubmitReturn = useCallback(async () => {
    if (!record?.request_id || !returnRequestId) {
      Alert.alert("Finish the return step", "Start the return first and capture at least one photo.");
      return;
    }

    if (photoCount === 0) {
      Alert.alert("Add a photo", "Please capture at least one photo before submitting the return.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await submitReturnRequest({
        return_request_id: returnRequestId,
        borrowing_request_id: record.request_id,
        photos_count: photoCount,
      });

      if (!response.success) {
        Alert.alert("Return not submitted", response.error || "Please try again.");
        return;
      }

      Alert.alert("Return submitted", response.message || "Your return has been submitted for review.");
      onReturnComplete?.();
      onClose();
    } catch (error: any) {
      console.error("Submit return error:", error?.response?.data || error?.message || error);
      Alert.alert("Return not submitted", error?.response?.data?.error || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [onClose, onReturnComplete, photoCount, record?.request_id, returnRequestId]);

  const renderBottomSheet = () => (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["74%", "92%"]}
      enablePanDownToClose
      backdropComponent={(backdropProps) => (
        <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} />
      )}
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.sheetContainer}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Return items</Text>
            <Text style={styles.sheetSubtitle}>{record?.request_id ? `Request #${String(record.request_id)}` : "Borrow record"}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.iconButton} hitSlop={10}>
            <Ionicons name="close" size={20} color="#0f172a" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <Text style={styles.sectionLabel}>Select returned units</Text>
          {record?.items?.map((item) => {
            const unitId = item.id ?? item.unit_id ?? item.inventory_unit_id;
            const selected = unitId ? selectedUnitIds.includes(unitId) : false;

            return (
              <Pressable
                key={String(unitId ?? `${item.item_name}-${item.unit_number}`)}
                onPress={() => unitId !== undefined && unitId !== null && toggleUnit(unitId)}
                style={[styles.unitRow, selected && styles.unitRowSelected]}
              >
                <View style={styles.unitInfo}>
                  <Text style={styles.unitName}>{item.item_name || item.name || "Item"}</Text>
                  <Text style={styles.unitMeta}>{item.size || item.condition || "Unit details"}</Text>
                </View>
                <View style={[styles.checkBubble, selected && styles.checkBubbleSelected]}>
                  {selected ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
                </View>
              </Pressable>
            );
          })}

          <Text style={styles.sectionLabel}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add return notes or issues"
            multiline
            style={styles.notesInput}
          />

          <Text style={styles.sectionLabel}>Photos</Text>
          <View style={styles.photoActionRow}>
            <Pressable onPress={handleCapturePhoto} style={styles.secondaryButton}>
              <Ionicons name="camera-outline" size={18} color="#0f172a" />
              <Text style={styles.secondaryButtonText}>Capture</Text>
            </Pressable>

            {capturedPhotoUri ? (
              <Pressable onPress={handleUploadPhoto} style={styles.primaryButton}>
                {photoUploading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Upload photo</Text>
                )}
              </Pressable>
            ) : null}
          </View>

          {capturedPhotoUri ? (
            <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} resizeMode="cover" />
          ) : null}

          {existingPhotos.length > 0 ? (
            <View style={styles.photoGrid}>
              {existingPhotos.map((photo, index) => {
                const photoUrl = normalizeImageUrl(String(photo.photo_url || ""));
                return photoUrl ? (
                  <Image
                    key={String(photo.id ?? index)}
                    source={{ uri: photoUrl }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                ) : null;
              })}
            </View>
          ) : null}

          <View style={styles.footerActions}>
            <Pressable onPress={handleInitiateReturn} style={styles.secondaryButton}>
              {loading ? (
                <ActivityIndicator color="#0f172a" size="small" />
              ) : (
                <Text style={styles.secondaryButtonText}>Start return</Text>
              )}
            </Pressable>

            <Pressable onPress={handleSubmitReturn} style={styles.primaryButton}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Submit return</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );

  return visible ? renderBottomSheet() : null;
});

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  sheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#475569",
    textTransform: "uppercase",
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  unitRowSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#60a5fa",
  },
  unitInfo: {
    flex: 1,
    gap: 2,
  },
  unitName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  unitMeta: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  checkBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBubbleSelected: {
    backgroundColor: "#2563eb",
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
    fontSize: 14,
    color: "#0f172a",
  },
  photoActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2563eb",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoThumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  footerActions: {
    flexDirection: "row",
    gap: 10,
  },
});

export default ReturnedBottomSheet;
