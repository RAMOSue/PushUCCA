import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import GoogleAuthModal from "./GoogleAuthModal";

type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  submit?: string;
};

const EMPTY_ERRORS: FieldErrors = {};
const ALLOWED_EMAIL_DOMAINS = ["@carsu.edu.ph", "@gmail.com"];
const isValidEmail = (email: string) => ALLOWED_EMAIL_DOMAINS.some((domain) => email.toLowerCase().endsWith(domain));

const GoogleGLogo = () => (
  <Image
    source={{ uri: "https://developers.google.com/static/identity/images/g-logo.png" }}
    style={styles.googleLogo}
    resizeMode="contain"
  />
);

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "Registration failed. Please try again.";
  }

  const response = error as {
    response?: {
      data?: {
        error?: string | string[];
        message?: string | string[];
        details?: string | string[];
      };
    };
  };

  const data = response.response?.data;
  if (!data) {
    return "Registration failed. Please try again.";
  }

  const normalize = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(" ");
    }

    return value;
  };

  return normalize(data.error) || normalize(data.message) || normalize(data.details) || "Registration failed. Please try again.";
};

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ googleName?: string; googleEmail?: string }>();
  const { register, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS);
  const [googleVisible, setGoogleVisible] = useState(false);

  useEffect(() => {
    if (params.googleName || params.googleEmail) {
      setName(params.googleName ?? "");
      setEmail(params.googleEmail ?? "");
    }
  }, [params.googleEmail, params.googleName]);

  const handleRegister = async () => {
    const nextErrors: FieldErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Full name is required.";
    }

    if (!email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Only @carsu.edu.ph or @gmail.com emails are allowed.";
    }

    if (!phone.trim()) {
      nextErrors.phone = "Phone number is required.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors(EMPTY_ERRORS);
    setLoading(true);

    try {
      const response = await register({ name: name.trim(), email: email.trim().toLowerCase(), password, phone: phone.trim() });
      if (!response?.token) {
        throw new Error("No token received");
      }
      router.replace("/(tabs)/available-items");
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleResult = (result: { type: string; name?: string; email?: string; message?: string }) => {
    setGoogleVisible(false);

    if (result.type === "prefill") {
      setName(result.name ?? "");
      setEmail(result.email ?? "");
      return;
    }

    if (result.type === "error") {
      Alert.alert("Google sign-up", result.message ?? "Google sign-up failed.");
    }
  };

  const isSubmitting = loading || isLoading;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.form, styles.registerForm]}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../../../../../assets/images/Logo/DuBudKa.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={[styles.field, styles.firstField]}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputShell, errors.name ? styles.inputShellError : null]}>
                <Ionicons name="person-outline" size={17} color="#9ca3af" />
                <TextInput value={name} onChangeText={(value) => { setName(value); if (errors.name) setErrors((current) => ({ ...current, name: undefined })); }} placeholder="Enter your full name" placeholderTextColor="#9ca3af" style={styles.input} editable={!isSubmitting} />
              </View>
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputShell, errors.email ? styles.inputShellError : null]}>
                <Ionicons name="mail-outline" size={17} color="#9ca3af" />
                <TextInput value={email} onChangeText={(value) => { setEmail(value); if (errors.email) setErrors((current) => ({ ...current, email: undefined })); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Enter your email" placeholderTextColor="#9ca3af" style={styles.input} editable={!isSubmitting} />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputShell, errors.phone ? styles.inputShellError : null]}>
                <Ionicons name="call-outline" size={17} color="#9ca3af" />
                <TextInput value={phone} onChangeText={(value) => { setPhone(value); if (errors.phone) setErrors((current) => ({ ...current, phone: undefined })); }} keyboardType="phone-pad" placeholder="Enter your phone number" placeholderTextColor="#9ca3af" style={styles.input} editable={!isSubmitting} />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputShell, errors.password ? styles.inputShellError : null]}>
                <Ionicons name="lock-closed-outline" size={17} color="#9ca3af" />
                <TextInput value={password} onChangeText={(value) => { setPassword(value); if (errors.password) setErrors((current) => ({ ...current, password: undefined })); }} placeholder="Create a password" placeholderTextColor="#9ca3af" style={[styles.input, styles.passwordInput]} secureTextEntry={!showPassword} editable={!isSubmitting} />
                <Pressable hitSlop={10} onPress={() => setShowPassword((current) => !current)} disabled={isSubmitting}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={17} color="#9ca3af" />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {errors.submit ? <Text style={styles.submitError}>{errors.submit}</Text> : null}

            <Pressable onPress={handleRegister} disabled={isSubmitting} style={({ pressed }) => [styles.button, isSubmitting ? styles.buttonDisabled : null, pressed && !isSubmitting ? styles.buttonPressed : null]}>
              {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Create Account</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom + 8) }]}>
        <Pressable onPress={() => setGoogleVisible(true)} style={({ pressed }) => [styles.googleButton, isSubmitting ? styles.buttonDisabled : null, pressed && !isSubmitting ? styles.buttonPressed : null]} disabled={isSubmitting}>
          <GoogleGLogo />
          <Text style={styles.googleButtonText}>Sign Up with Google</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} disabled={isSubmitting} style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>

      <GoogleAuthModal visible={googleVisible} mode="register" onClose={() => setGoogleVisible(false)} onResult={handleGoogleResult} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboardWrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  form: {
    width: "100%",
  },
  registerForm: {
    marginTop: 12,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 4,
  },
  logo: {
    width: 180,
    height: 70,
  },
  logoText: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  logoBlue: {
    color: "#0f2f6b",
  },
  logoYellow: {
    color: "#fbbf24",
  },
  logoRed: {
    color: "#dc2626",
  },
  field: {
    marginBottom: 12,
  },
  firstField: {
    marginTop: 2,
  },
  label: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  inputShell: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  inputShellError: {
    borderColor: "#ef4444",
  },
  input: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    paddingVertical: 0,
  },
  passwordInput: {
    paddingRight: 4,
  },
  errorText: {
    marginTop: 4,
    color: "#ef4444",
    fontSize: 12,
  },
  submitError: {
    marginBottom: 10,
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    backgroundColor: "#004d1a",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  googleButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d1d5db",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  googleButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  footer: {
    marginTop: 12,
    alignItems: "stretch",
    width: "100%",
    paddingHorizontal: 20,
  },
  backButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d1d5db",
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
});
