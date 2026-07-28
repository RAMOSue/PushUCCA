import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { PermissionStatus } from "expo-modules-core";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { api } from "../../src/services/api";

type ProfileData = {
  id: string | number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  division_id?: number | null;
  department_name?: string | null;
  profile_pic_url?: string | null;
  birth_certificate_url?: string | null;
  class_schedule_url?: string | null;
  id_front_url?: string | null;
  id_back_url?: string | null;
  date_of_birth?: string | null;
  citizenship?: string | null;
  religion?: string | null;
  marital_status?: string | null;
  college?: string | null;
  program?: string | null;
  current_address?: string | null;
  height?: string | number | null;
  weight?: string | number | null;
  eye_color?: string | null;
  mother_full_name?: string | null;
  mother_birthday?: string | null;
  father_full_name?: string | null;
  father_birthday?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_mobile?: string | null;
  emergency_contact_relationship?: string | null;
  emergency_contact_occupation?: string | null;
  updated_at?: string | null;
};

type DocumentKey =
  | "birth_certificate_url"
  | "class_schedule_url"
  | "id_front_url"
  | "id_back_url";

type UploadField =
  | "profile_pic"
  | "birth_certificate"
  | "class_schedule"
  | "id_front"
  | "id_back";

type DocumentConfig = {
  key: DocumentKey;
  label: string;
  uploadField: UploadField;
  isIdCard: boolean;
};

type ProfileResponse = {
  profile?: ProfileData;
} | ProfileData;

const documentsConfig: DocumentConfig[] = [
  { key: "birth_certificate_url", label: "Birth Certificate", uploadField: "birth_certificate", isIdCard: false },
  { key: "class_schedule_url", label: "Class Schedule", uploadField: "class_schedule", isIdCard: false },
  { key: "id_front_url", label: "School ID (Front)", uploadField: "id_front", isIdCard: true },
  { key: "id_back_url", label: "School ID (Back)", uploadField: "id_back", isIdCard: true },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<ProfileData>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [idCameraOpen, setIdCameraOpen] = useState(false);
  const [idCameraTarget, setIdCameraTarget] = useState<DocumentConfig | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const profileData = profile ?? user;

  const uploadedCount = useMemo(
    () => documentsConfig.filter((item) => Boolean(profile?.[item.key])).length,
    [profile]
  );

  const loadProfile = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { data } = await api.get<ProfileResponse>("/api/profiles/me");
      const returnedProfile = (data as { profile?: ProfileData }).profile || (data as ProfileData);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setProfile(returnedProfile);
      setProfileDraft({
        date_of_birth: returnedProfile?.date_of_birth ?? "",
        citizenship: returnedProfile?.citizenship ?? "",
        religion: returnedProfile?.religion ?? "",
        marital_status: returnedProfile?.marital_status ?? "",
        college: returnedProfile?.college ?? "",
        program: returnedProfile?.program ?? "",
        current_address: returnedProfile?.current_address ?? "",
        height: returnedProfile?.height ?? "",
        weight: returnedProfile?.weight ?? "",
        eye_color: returnedProfile?.eye_color ?? "",
        mother_full_name: returnedProfile?.mother_full_name ?? "",
        mother_birthday: returnedProfile?.mother_birthday ?? "",
        father_full_name: returnedProfile?.father_full_name ?? "",
        father_birthday: returnedProfile?.father_birthday ?? "",
        emergency_contact_name: returnedProfile?.emergency_contact_name ?? "",
        emergency_contact_mobile: returnedProfile?.emergency_contact_mobile ?? "",
        emergency_contact_relationship: returnedProfile?.emergency_contact_relationship ?? "",
        emergency_contact_occupation: returnedProfile?.emergency_contact_occupation ?? "",
      });
    } catch (err) {
      console.error("Failed to load profile", err);
      setError("Unable to load profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadProfile();
    setIsRefreshing(false);
  }, [loadProfile]);

  const confirmLogout = useCallback(() => {
    Alert.alert("Log out", "Do you want to sign out of the app?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, [logout, router]);

  const openDocumentPreview = useCallback((url: string | null) => {
    if (!url) {
      Alert.alert("No document", "This document is not uploaded yet.");
      return;
    }

    setDocumentPreviewUrl(url);
    setIsDocumentPreviewOpen(true);
  }, []);


  const updateProfileData = useCallback((newProfile: ProfileData) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProfile(newProfile);
  }, []);

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
        updateProfileData(returnedProfile);
        Alert.alert("Uploaded", "Your file was uploaded successfully.");
      } catch (err) {
        console.error("Upload failed", err);
        Alert.alert("Upload failed", "Please try again.");
      } finally {
        setUploadingField(null);
      }
    },
    [updateProfileData]
  );

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

  const handleProfilePhotoSelection = useCallback(async () => {
    Alert.alert("Update profile photo", undefined, [
      {
        text: "Take Photo",
        onPress: async () => {
          const granted = await ensureCameraPermission();
          if (!granted) return;

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          });

          if (!result.canceled && result.assets[0]?.uri) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setProfile((current) =>
              current
                ? { ...current, profile_pic_url: result.assets[0].uri }
                : current
            );
            await uploadFile("profile_pic", result.assets[0].uri);
          }
        },
      },
      {
        text: "Upload from Gallery",
        onPress: async () => {
          const granted = await ensureMediaLibraryPermission();
          if (!granted) return;

          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          });

          if (!result.canceled && result.assets[0]?.uri) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setProfile((current) =>
              current
                ? { ...current, profile_pic_url: result.assets[0].uri }
                : current
            );
            await uploadFile("profile_pic", result.assets[0].uri);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [ensureCameraPermission, ensureMediaLibraryPermission, uploadFile]);

  const openNameEditor = useCallback(() => {
    setNameDraft(profileData?.name || "");
    setNameEditorOpen(true);
  }, [profileData?.name]);

  const saveName = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert("Invalid name", "Please enter a valid name.");
      return;
    }

    if (trimmed === profileData?.name) {
      setNameEditorOpen(false);
      return;
    }

    setNameSaving(true);
    try {
      const response = await api.patch("/api/profiles/me", { name: trimmed });
      const returnedProfile = response.data.profile || response.data;
      updateProfileData(returnedProfile);
      setNameEditorOpen(false);
      Alert.alert("Saved", "Your display name has been updated.");
    } catch (err) {
      console.error("Name update failed", err);
      Alert.alert("Unable to save", "Please try again.");
    } finally {
      setNameSaving(false);
    }
  }, [nameDraft, profileData?.name, updateProfileData]);

  const handleDocumentUpload = useCallback(
    async (config: DocumentConfig, sourceUri: string) => {
      if (!config) return;
      await uploadFile(config.uploadField, sourceUri);
    },
    [uploadFile]
  );

  const openGalleryForDocument = useCallback(
    async (config: DocumentConfig) => {
      const granted = await ensureMediaLibraryPermission();
      if (!granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await handleDocumentUpload(config, result.assets[0].uri);
      }
    },
    [ensureMediaLibraryPermission, handleDocumentUpload]
  );

  const openCameraForDocument = useCallback(
    async (config: DocumentConfig) => {
      if (config.isIdCard) {
        const granted = await ensureCameraPermission();
        if (!granted) return;
        setIdCameraTarget(config);
        setCapturedUri(null);
        setIdCameraOpen(true);
        return;
      }

      const granted = await ensureCameraPermission();
      if (!granted) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await handleDocumentUpload(config, result.assets[0].uri);
      }
    },
    [ensureCameraPermission, handleDocumentUpload]
  );

  const captureIdPhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePicture({ quality: 0.8, skipProcessing: true });
      setCapturedUri(photo.uri);
    } catch (err) {
      console.error("Camera capture failed", err);
      Alert.alert("Capture failed", "Unable to capture the photo. Please try again.");
    }
  }, []);

  const confirmIdPhoto = useCallback(async () => {
    if (!idCameraTarget || !capturedUri) return;
    await handleDocumentUpload(idCameraTarget, capturedUri);
    setIdCameraOpen(false);
    setCapturedUri(null);
    setIdCameraTarget(null);
  }, [capturedUri, handleDocumentUpload, idCameraTarget]);

  const closeIdCamera = useCallback(() => {
    setIdCameraOpen(false);
    setCapturedUri(null);
    setIdCameraTarget(null);
  }, []);

  const profileAvatarUri = profile?.profile_pic_url || undefined;

  const profileFieldGroups = [
    {
      title: "Personal",
      items: [
        { label: "Date of Birth", key: "date_of_birth" as const },
        { label: "Citizenship", key: "citizenship" as const },
        { label: "Religion", key: "religion" as const },
        { label: "Marital Status", key: "marital_status" as const },
      ],
    },
    {
      title: "Academic",
      items: [
        { label: "College", key: "college" as const },
        { label: "Program / Course", key: "program" as const },
      ],
    },
    {
      title: "Physical",
      items: [
        { label: "Height", key: "height" as const },
        { label: "Weight", key: "weight" as const },
        { label: "Eye Color", key: "eye_color" as const },
      ],
    },
    {
      title: "Parents",
      items: [
        { label: "Mother's Full Name", key: "mother_full_name" as const },
        { label: "Mother's Birthday", key: "mother_birthday" as const },
        { label: "Father's Full Name", key: "father_full_name" as const },
        { label: "Father's Birthday", key: "father_birthday" as const },
      ],
    },
    {
      title: "Emergency Contact",
      items: [
        { label: "Emergency Contact Name", key: "emergency_contact_name" as const },
        { label: "Emergency Contact Mobile", key: "emergency_contact_mobile" as const },
        { label: "Relationship", key: "emergency_contact_relationship" as const },
        { label: "Occupation", key: "emergency_contact_occupation" as const },
      ],
    },
  ];

  const saveExtendedProfile = useCallback(async () => {
    setProfileSaving(true);
    try {
      const response = await api.patch("/api/profiles/me", profileDraft);
      const returnedProfile = response.data.profile || response.data;
      updateProfileData(returnedProfile);
      setIsEditingProfile(false);
      Alert.alert("Saved", "Your profile details were updated.");
    } catch (err) {
      console.error("Profile update failed", err);
      Alert.alert("Unable to save", "Please try again.");
    } finally {
      setProfileSaving(false);
    }
  }, [profileDraft, updateProfileData]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loaderText}>Loading profile...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.headerCard}>
              <View style={styles.headerLeft}>
                <View style={styles.avatarContainer}>
                  {profileAvatarUri ? (
                    <Image source={{ uri: profileAvatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {String(profileData?.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <Pressable style={styles.photoButton} onPress={handleProfilePhotoSelection}>
                    <Ionicons name="camera-outline" size={18} color="#ffffff" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.headerRight}>
                <View style={styles.nameRow}>
                  <Text style={styles.headerName}>{profileData?.name || "Borrower"}</Text>
                  <Pressable onPress={openNameEditor} style={styles.editIcon} hitSlop={10}>
                    <Ionicons name="pencil" size={18} color="#475569" />
                  </Pressable>
                </View>
                <Text style={styles.headerDivision}>{profile?.department_name || "No division assigned"}</Text>
                <Text style={styles.headerRole}>{profileData?.role ? profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1) : "Student"}</Text>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Profile Details</Text>
                <Pressable onPress={() => {
                  if (isEditingProfile) {
                    setIsEditingProfile(false);
                    setProfileDraft({
                      date_of_birth: profile?.date_of_birth ?? "",
                      citizenship: profile?.citizenship ?? "",
                      religion: profile?.religion ?? "",
                      marital_status: profile?.marital_status ?? "",
                      college: profile?.college ?? "",
                      program: profile?.program ?? "",
                      current_address: profile?.current_address ?? "",
                      height: profile?.height ?? "",
                      weight: profile?.weight ?? "",
                      eye_color: profile?.eye_color ?? "",
                      mother_full_name: profile?.mother_full_name ?? "",
                      mother_birthday: profile?.mother_birthday ?? "",
                      father_full_name: profile?.father_full_name ?? "",
                      father_birthday: profile?.father_birthday ?? "",
                      emergency_contact_name: profile?.emergency_contact_name ?? "",
                      emergency_contact_mobile: profile?.emergency_contact_mobile ?? "",
                      emergency_contact_relationship: profile?.emergency_contact_relationship ?? "",
                      emergency_contact_occupation: profile?.emergency_contact_occupation ?? "",
                    });
                  } else {
                    setProfileDraft({
                      date_of_birth: profile?.date_of_birth ?? "",
                      citizenship: profile?.citizenship ?? "",
                      religion: profile?.religion ?? "",
                      marital_status: profile?.marital_status ?? "",
                      college: profile?.college ?? "",
                      program: profile?.program ?? "",
                      current_address: profile?.current_address ?? "",
                      height: profile?.height ?? "",
                      weight: profile?.weight ?? "",
                      eye_color: profile?.eye_color ?? "",
                      mother_full_name: profile?.mother_full_name ?? "",
                      mother_birthday: profile?.mother_birthday ?? "",
                      father_full_name: profile?.father_full_name ?? "",
                      father_birthday: profile?.father_birthday ?? "",
                      emergency_contact_name: profile?.emergency_contact_name ?? "",
                      emergency_contact_mobile: profile?.emergency_contact_mobile ?? "",
                      emergency_contact_relationship: profile?.emergency_contact_relationship ?? "",
                      emergency_contact_occupation: profile?.emergency_contact_occupation ?? "",
                    });
                    setIsEditingProfile(true);
                  }
                }} style={styles.ghostButton}>
                  <Text style={styles.ghostButtonText}>{isEditingProfile ? "Cancel" : "Edit"}</Text>
                </Pressable>
              </View>

              <View style={styles.detailRow}>
                <View>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{profileData?.email || "Not available"}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{profileData?.phone || "Not available"}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View>
                  <Text style={styles.detailLabel}>Current Address</Text>
                  <Text style={styles.detailValue}>{profile?.current_address || "Not provided"}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View>
                  <Text style={styles.detailLabel}>Student ID</Text>
                  <Text style={styles.detailValue}>{profileData?.id ?? "Unknown"}</Text>
                </View>
              </View>

              {profileFieldGroups.map((group) => (
                <View key={group.title} style={styles.profileGroupCard}>
                  <Text style={styles.profileGroupTitle}>{group.title}</Text>
                  {group.items.map((item) => (
                    <View key={item.key} style={styles.profileFieldRow}>
                      <Text style={styles.detailLabel}>{item.label}</Text>
                      {isEditingProfile ? (
                        <TextInput
                          style={styles.modalInput}
                          value={String(profileDraft[item.key as keyof typeof profileDraft] ?? "")}
                          onChangeText={(value) => setProfileDraft((current) => ({ ...current, [item.key]: value }))}
                          placeholder="Not provided"
                        />
                      ) : (
                        <Text style={styles.detailValue}>{String(profile?.[item.key as keyof ProfileData] ?? "Not provided")}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}

              {isEditingProfile ? (
                <Pressable style={styles.primaryButton} onPress={saveExtendedProfile} disabled={profileSaving}>
                  {profileSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Save Profile</Text>}
                </Pressable>
              ) : null}
            </View>

            <View style={styles.documentsCard}>
              <View style={styles.documentsHeader}>
                <Text style={styles.sectionTitle}>Documents</Text>
                <Text style={styles.documentsCount}>{uploadedCount}/4 uploaded</Text>
              </View>

              {documentsConfig.map((document) => {
                const url = profile?.[document.key] ?? null;
                const isUploaded = Boolean(url);
                const thumbnailSupported = url && !url.toLowerCase().includes(".pdf");

                return (
                  <View key={document.key} style={styles.documentCard}>
                    <View style={styles.documentHeader}>
                      <View>
                        <Text style={styles.documentTitle}>{document.label}</Text>
                        <Text style={styles.documentStatusText}>
                          {isUploaded ? "Uploaded" : "Not uploaded"}
                        </Text>
                      </View>
                      {isUploaded ? (
                        <Pressable onPress={() => openDocumentPreview(url)} style={styles.previewChip}>
                          <Text style={styles.previewChipText}>Preview</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {isUploaded ? (
                      <Pressable
                        onPress={() => openDocumentPreview(url)}
                        style={styles.documentPreview}
                      >
                        {thumbnailSupported ? (
                          <Image source={{ uri: url! }} style={styles.documentThumbnail} />
                        ) : (
                          <View style={styles.documentPlaceholder}>
                            <Ionicons name="document-text-outline" size={24} color="#475569" />
                          </View>
                        )}
                        <View style={styles.documentMeta}>
                          <Text style={styles.documentMetaText}>Tap to view full screen</Text>
                        </View>
                      </Pressable>
                    ) : null}

                    <View style={styles.documentActions}>
                      <Pressable
                        style={[styles.actionButton, styles.uploadButton]}
                        onPress={() => openGalleryForDocument(document)}
                        disabled={uploadingField === document.uploadField}
                      >
                        {uploadingField === document.uploadField ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.actionButtonText}>Upload</Text>
                        )}
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.cameraButton]}
                        onPress={() => openCameraForDocument(document)}
                        disabled={uploadingField === document.uploadField}
                      >
                        <Ionicons name="camera" size={16} color="#0f172a" />
                        <Text style={styles.cameraButtonText}>Camera</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            <Pressable onPress={confirmLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={18} color="#ffffff" />
              <Text style={styles.logoutButtonText}>Log out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal visible={nameEditorOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit display name</Text>
            <TextInput
              style={styles.modalInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Full name"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={() => setNameEditorOpen(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalPrimaryButton, nameSaving && styles.disabledButton]} onPress={saveName} disabled={nameSaving}>
                {nameSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalPrimaryText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isDocumentPreviewOpen} animationType="fade" transparent>
        <View style={styles.previewOverlay}>
          <View style={styles.previewHeader}>
            <Pressable onPress={() => setIsDocumentPreviewOpen(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {documentPreviewUrl ? (
              <Image source={{ uri: documentPreviewUrl }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={idCameraOpen} animationType="slide">
        <View style={styles.cameraModalScreen}>
          <View style={styles.cameraHeader}>
            <Pressable onPress={closeIdCamera} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </Pressable>
            <Text style={styles.cameraTitle}>{idCameraTarget?.label || "Capture document"}</Text>
            <View style={styles.cameraHeaderSpacer} />
          </View>

          <View style={styles.cameraPreviewWrapper}>
            <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" ratio="16:9" />
            <View style={styles.cameraOverlayContainer} pointerEvents="none">
              <View style={styles.cameraOverlay} />
              <View style={styles.cameraFrame}>
                <View style={styles.cameraFrameCornerTopLeft} />
                <View style={styles.cameraFrameCornerTopRight} />
                <View style={styles.cameraFrameCornerBottomLeft} />
                <View style={styles.cameraFrameCornerBottomRight} />
              </View>
            </View>
          </View>

          <Text style={styles.cameraHint}>Align the ID card inside the frame and keep the shot straight.</Text>

          <View style={styles.cameraActions}>
            <Pressable style={styles.captureButton} onPress={captureIdPhoto}>
              <Ionicons name="ellipse" size={64} color="#ffffff" />
            </Pressable>
          </View>

          {capturedUri ? (
            <View style={styles.cameraReviewCard}>
              <Image source={{ uri: capturedUri }} style={styles.cameraReviewImage} />
              <View style={styles.cameraReviewActions}>
                <Pressable style={styles.modalSecondaryButton} onPress={() => setCapturedUri(null)}>
                  <Text style={styles.modalSecondaryText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.modalPrimaryButton} onPress={confirmIdPhoto}>
                  <Text style={styles.modalPrimaryText}>Upload</Text>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  loaderText: {
    color: "#334155",
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 14,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    gap: 18,
  },
  headerLeft: {
    alignItems: "center",
  },
  avatarContainer: {
    width: 108,
    height: 108,
    borderRadius: 54,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 108,
    height: 108,
  },
  avatarPlaceholder: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
  },
  photoButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  headerRight: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  headerName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    flexShrink: 1,
  },
  editIcon: {
    padding: 6,
    borderRadius: 999,
  },
  headerDivision: {
    marginTop: 6,
    fontSize: 14,
    color: "#475569",
  },
  headerRole: {
    marginTop: 2,
    fontSize: 14,
    color: "#475569",
    fontWeight: "700",
  },
  detailsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  ghostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ghostButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
  profileGroupCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    backgroundColor: "#f8fafc",
  },
  profileGroupTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  profileFieldRow: {
    gap: 4,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: "#0f172a",
  },
  documentsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    gap: 16,
  },
  documentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  documentsCount: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  documentCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 12,
  },
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  documentStatusText: {
    marginTop: 4,
    fontSize: 12,
    color: "#475569",
  },
  previewChip: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewChipText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "700",
  },
  documentPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  documentThumbnail: {
    width: 84,
    height: 84,
  },
  documentPlaceholder: {
    width: 84,
    height: 84,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  documentMeta: {
    flex: 1,
    paddingVertical: 12,
  },
  documentMetaText: {
    color: "#475569",
    fontSize: 13,
  },
  documentActions: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  uploadButton: {
    backgroundColor: "#2563eb",
  },
  cameraButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  cameraButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#dc2626",
    paddingVertical: 14,
  },
  logoutButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 14,
  },
  modalSecondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
  },
  modalSecondaryText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#2563eb",
  },
  modalPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "#000000",
  },
  previewHeader: {
    height: 72,
    paddingTop: Platform.OS === "ios" ? 36 : 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    padding: 10,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewImage: {
    width: "100%",
    height: 520,
  },
  cameraModalScreen: {
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
  cameraTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  cameraHeaderSpacer: {
    width: 34,
  },
  cameraPreviewWrapper: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraPreview: {
    flex: 1,
  },
  cameraOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  cameraFrame: {
    width: "88%",
    aspectRatio: 1.5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    overflow: "hidden",
  },
  cameraFrameCornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#ffffff",
  },
  cameraFrameCornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#ffffff",
  },
  cameraFrameCornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#ffffff",
  },
  cameraFrameCornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#ffffff",
  },
  cameraHint: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#475569",
    textAlign: "center",
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
  cameraReviewCard: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  cameraReviewImage: {
    width: "100%",
    height: 240,
    borderRadius: 18,
  },
  cameraReviewActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});
