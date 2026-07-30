import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Linking,
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
import { useLocalSearchParams, useRouter } from "expo-router";
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

type SectionKey = "personal" | "documents";

type DocumentKey = "birth_certificate_url" | "class_schedule_url" | "id_front_url" | "id_back_url";
type UploadField = "profile_pic" | "birth_certificate" | "class_schedule" | "id_front" | "id_back";

type DocumentConfig = {
  key: DocumentKey;
  label: string;
  uploadField: UploadField;
  isIdCard: boolean;
};

type ProfileResponse = {
  profile?: ProfileData;
} | ProfileData;

type ProfileFieldConfig = {
  label: string;
  key: keyof ProfileData;
  compact?: boolean;
};

type ProfileSection = {
  title: string;
  fields: ProfileFieldConfig[];
};

const documentsConfig: DocumentConfig[] = [
  { key: "birth_certificate_url", label: "Birth Certificate", uploadField: "birth_certificate", isIdCard: false },
  { key: "class_schedule_url", label: "Class Schedule", uploadField: "class_schedule", isIdCard: false },
  { key: "id_front_url", label: "School ID (Front)", uploadField: "id_front", isIdCard: true },
  { key: "id_back_url", label: "School ID (Back)", uploadField: "id_back", isIdCard: true },
];

const documentRows = [
  {
    title: "Birth Certificate",
    subtitle: "Upload or replace your birth certificate",
    icon: "document-text-outline",
    route: "/(tabs)/documents/birth-certificate",
  },
  {
    title: "School ID",
    subtitle: "Front and back of your school ID",
    icon: "id-card-outline",
    route: "/(tabs)/documents/school-id",
  },
  {
    title: "Class Schedule",
    subtitle: "Upload your class schedule",
    icon: "calendar-outline",
    route: "/(tabs)/documents/class-schedule",
  },
] as const;

const personalSections: ProfileSection[] = [
  {
    title: "Student Information",
    fields: [
      { label: "College", key: "college" },
      { label: "Program", key: "program" },
      { label: "Email", key: "email" },
      { label: "Phone Number", key: "phone" },
      { label: "Current Address", key: "current_address" },
    ],
  },
  {
    title: "Personal Information",
    fields: [
      { label: "Date of Birth", key: "date_of_birth" },
      { label: "Citizenship", key: "citizenship" },
      { label: "Marital Status", key: "marital_status" },
      { label: "Religion", key: "religion" },
      { label: "Height", key: "height" },
      { label: "Weight", key: "weight" },
      { label: "Eye Color", key: "eye_color" },
    ],
  },
  {
    title: "Family Information",
    fields: [
      { label: "Mother's Name", key: "mother_full_name" },
      { label: "Mother's Birthday", key: "mother_birthday" },
      { label: "Father's Name", key: "father_full_name" },
      { label: "Father's Birthday", key: "father_birthday" },
    ],
  },
  {
    title: "Emergency Contact",
    fields: [
      { label: "Emergency Contact Name", key: "emergency_contact_name" },
      { label: "Emergency Contact Number", key: "emergency_contact_mobile" },
      { label: "Emergency Contact Relationship", key: "emergency_contact_relationship" },
      { label: "Emergency Contact Occupation", key: "emergency_contact_occupation" },
    ],
  },
];

function formatFieldValue(value: unknown, fieldKey?: keyof ProfileData) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (fieldKey && ["date_of_birth", "mother_birthday", "father_birthday"].includes(fieldKey as string)) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(date);
    }
  }

  return String(value);
}

function getDivisionAccentColor(departmentName?: string | null) {
  const normalized = departmentName?.toLowerCase() ?? "";

  if (normalized.includes("budjong")) {
    return "#f59e0b";
  }

  if (normalized.includes("kayam")) {
    return "#dc2626";
  }

  if (normalized.includes("dulimbay")) {
    return "#2563eb";
  }

  return "#2563eb";
}

export default function Profile() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SectionKey>("personal");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<ProfileData>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [idCameraOpen, setIdCameraOpen] = useState(false);
  const [idCameraTarget, setIdCameraTarget] = useState<DocumentConfig | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const profileData = profile ?? user;
  const departmentName = profile?.department_name ?? (user as ProfileData | undefined)?.department_name ?? null;
  const divisionAccentColor = useMemo(() => getDivisionAccentColor(departmentName), [departmentName]);

  const uploadedCount = useMemo(() => documentsConfig.filter((item) => Boolean(profile?.[item.key])).length, [profile]);

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

  useEffect(() => {
    if (params.tab === "documents") {
      setActiveTab("documents");
    }
  }, [params.tab]);

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

  const handleDownloadFile = useCallback(async (url: string | null) => {
    if (!url) {
      Alert.alert("No file", "There is no uploaded file to download yet.");
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Unable to download", "This file cannot be opened on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.error("Download failed", err);
      Alert.alert("Download failed", "Please try again.");
    }
  }, []);

  const updateProfileData = useCallback((newProfile: ProfileData) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProfile(newProfile);
    DeviceEventEmitter.emit("mobile:profile-updated", { profile: newProfile });
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

  const handleProfilePhotoSelection = useCallback(
    async (source: "gallery" | "camera") => {
      if (source === "camera") {
        const granted = await ensureCameraPermission();
        if (!granted) return;

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]?.uri) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setProfile((current) => (current ? { ...current, profile_pic_url: result.assets[0].uri } : current));
          await uploadFile("profile_pic", result.assets[0].uri);
        }
        return;
      }

      const granted = await ensureMediaLibraryPermission();
      if (!granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setProfile((current) => (current ? { ...current, profile_pic_url: result.assets[0].uri } : current));
        await uploadFile("profile_pic", result.assets[0].uri);
      }
    },
    [ensureCameraPermission, ensureMediaLibraryPermission, uploadFile]
  );

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

  const switchTab = useCallback((section: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(section);
  }, []);

  const toggleShowMore = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAllDetails((current) => !current);
  }, []);

  const toggleSectionEdit = useCallback((sectionTitle: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingSection((current) => (current === sectionTitle ? null : sectionTitle));
  }, []);

  const saveSectionChanges = useCallback(async () => {
    setProfileSaving(true);
    try {
      const response = await api.patch("/api/profiles/me", profileDraft);
      const returnedProfile = response.data.profile || response.data;
      updateProfileData(returnedProfile);
      setEditingSection(null);
      Alert.alert("Saved", "Your profile details were updated.");
    } catch (err) {
      console.error("Profile update failed", err);
      Alert.alert("Unable to save", "Please try again.");
    } finally {
      setProfileSaving(false);
    }
  }, [profileDraft, updateProfileData]);

  const renderFieldValue = (field: ProfileFieldConfig, isEditingThisSection: boolean, isCompact = false) => {
    const value = profile?.[field.key as keyof ProfileData];

    if (isEditingThisSection) {
      const draftValue = String(profileDraft[field.key as keyof typeof profileDraft] ?? "");
      return (
        <TextInput
          style={styles.input}
          value={draftValue}
          onChangeText={(text) => setProfileDraft((current) => ({ ...current, [field.key]: text }))}
          placeholder={field.label}
          placeholderTextColor="#94a3b8"
          multiline={isCompact}
        />
      );
    }

    return (
      <Text style={isCompact ? styles.compactValue : styles.detailValue}>
        {formatFieldValue(value, field.key as keyof ProfileData)}
      </Text>
    );
  };

  const renderTabContent = () => {
    if (activeTab === "documents") {
      return (
        <View style={styles.tabContent}>
          

          <View style={styles.sectionBody}>
            

            {documentRows.map((document) => (
              <Pressable
                key={document.title}
                style={styles.settingsRow}
                onPress={() => router.push({ pathname: document.route as any, params: { returnTab: "documents" } })}
              >
                <View style={styles.settingsRowLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name={document.icon as any} size={18} color="#2563eb" />
                  </View>
                  <View style={styles.settingsTextWrap}>
                    <Text style={styles.settingsRowTitle}>{document.title}</Text>
                    <Text style={styles.settingsRowSubtitle}>{document.subtitle}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.sectionBody}>
          {personalSections.slice(0, showAllDetails ? personalSections.length : 2).map((section) => {
            const isEditingThisSection = editingSection === section.title;

            return (
              <View key={section.title} style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWrap}>
                   
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                  
                    </View>
                  </View>
                  <Pressable style={styles.sectionEditButton} onPress={() => toggleSectionEdit(section.title)}>
                    <Ionicons name={isEditingThisSection ? "close-outline" : "create-outline"} size={18} color="#2563eb" />
                  </Pressable>
                </View>

                <View style={styles.sectionBody}>
                  {section.fields.map((field) => (
                    <View key={field.key} style={styles.profileFieldRow}>
                      <Text style={styles.detailLabel}>{field.label}</Text>
                      {renderFieldValue(field, isEditingThisSection, field.compact)}
                    </View>
                  ))}

                  {isEditingThisSection ? (
                    <View style={styles.sectionActions}>
                      <Pressable style={styles.sectionCancelButton} onPress={() => toggleSectionEdit(section.title)}>
                        <Text style={styles.sectionCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={styles.primaryButton} onPress={saveSectionChanges} disabled={profileSaving}>
                        {profileSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Save</Text>}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}

          {!showAllDetails && personalSections.length > 2 ? (
            <Pressable style={styles.showMoreButton} onPress={toggleShowMore}>
              <Text style={styles.showMoreButtonText}>See More</Text>
            </Pressable>
          ) : null}

          {showAllDetails ? (
            <Pressable style={styles.showMoreButton} onPress={toggleShowMore}>
              <Text style={styles.showMoreButtonText}>Show Less</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

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

            <View style={styles.headerSection}>
              <View style={styles.headerBorderFrame}>
                <View style={styles.headerAvatarWrap}>
                  <View style={[styles.avatarWrapOuter]}>
                    <Pressable
                      onPress={() => {
                        if (profileAvatarUri) setIsAvatarPreviewOpen(true);
                        else Alert.alert("No photo", "You haven't uploaded a profile photo yet.");
                      }}
                      accessibilityLabel="View profile photo"
                    >
                      <View style={[styles.avatarContainer, { borderColor: divisionAccentColor, shadowColor: divisionAccentColor }] }>
                        {profileAvatarUri ? (
                          <Image source={{ uri: profileAvatarUri }} style={styles.avatarImage} />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>{String(profileData?.name || "?").charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>

                    <Pressable
                      style={[styles.photoButton, { backgroundColor: divisionAccentColor }] }
                      onPress={() => handleProfilePhotoSelection("camera") }
                      accessibilityLabel="Change profile photo"
                    >
                      <Ionicons name="camera" size={12} color="#ffffff" />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.headerInfo}>
                  <View style={styles.headerNameRow}>
                    <Text style={styles.headerName}>{profileData?.name || "Borrower"}</Text>
                    <Pressable onPress={openNameEditor} style={[styles.headerActionButton, { backgroundColor: `${divisionAccentColor}12` }] }>
                      <Ionicons name="create-outline" size={16} color={divisionAccentColor} />
                    </Pressable>
                  </View>
                  <Text style={styles.headerDivision}>{profile?.department_name || "No division assigned"}</Text>
                </View>

                <View style={styles.tabRow}>
                  {[
                    { key: "personal", label: "Personal" },
                    { key: "documents", label: "Documents" },
                  ].map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        style={[styles.tabButton, isActive && styles.tabButtonActive]}
                        onPress={() => switchTab(tab.key as SectionKey)}
                      >
                        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{tab.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {renderTabContent()}

            
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
            {documentPreviewUrl ? <Image source={{ uri: documentPreviewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={isAvatarPreviewOpen} animationType="fade" transparent>
        <View style={styles.previewOverlay}>
          <View style={styles.previewHeader}>
            <Pressable onPress={() => setIsAvatarPreviewOpen(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {profileAvatarUri ? <Image source={{ uri: profileAvatarUri }} style={styles.previewImage} resizeMode="contain" /> : null}
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
    paddingTop: 2,
    paddingBottom: 24,
    gap: 8,
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
  headerSection: {
    width: "100%",
    paddingVertical: 0,
  },
  headerBorderFrame: {
    position: "relative",
    borderRadius: 20,
    paddingTop: 2,
    paddingBottom: 4,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
  },
  headerAvatarWrap: {
    alignItems: "center",
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatarWrapOuter: {
    position: "relative",
    alignItems: "center",
    overflow: "visible",
    paddingBottom: 0,
  },
  avatarImage: {
    width: 72,
    height: 72,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  photoButton: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  headerInfo: {
    width: "100%",
    alignItems: "center",
    gap: 2,
    paddingTop: 2,
  },
  headerNameRow: {
    position: "relative",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  headerDivision: {
    fontSize: 12.5,
    color: "#475569",
    textAlign: "center",
  },
  headerActionButton: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: [{ translateY: -10 }],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: 4,
    backgroundColor: "transparent",
  },
  headerActionText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
  },
  tabContent: {
    width: "100%",
    paddingVertical: 0,
    gap: 6,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
    paddingTop: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 0,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  tabButtonText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: "#2563eb",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingBottom: 4,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 6,
    gap: 6,
  },
  sectionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: "#64748b",
    marginTop: 1,
  },
  sectionBody: {
    gap: 6,
    paddingTop: 0,
  },
  sectionGroup: {
    gap: 4,
    paddingBottom: 6,
  },
  sectionEditButton: {
    padding: 4,
    marginLeft: 8,
  },
  sectionActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  sectionCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  sectionCancelText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionGroupTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  showMoreButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  showMoreButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionMetaText: {
    color: "#64748b",
    fontSize: 12,
    flexShrink: 1,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  settingsRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  settingsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsTextWrap: {
    flex: 1,
    gap: 2,
  },
  settingsRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  settingsRowSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
  },
  profileFieldRow: {
    gap: 2,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailLabel: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 14,
    color: "#0f172a",
  },
  compactValue: {
    fontSize: 13.5,
    color: "#0f172a",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
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
  documentRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
    gap: 10,
  },
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  documentHeaderText: {
    flex: 1,
    minWidth: 0,
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
    backgroundColor: "#f8fafc",
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
    gap: 8,
    alignItems: "center",
    flexShrink: 0,
  },
  actionButton: {
    minWidth: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  uploadButton: {
    backgroundColor: "#2563eb",
  },
  cameraButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  downloadButton: {
    backgroundColor: "#0f766e",
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
