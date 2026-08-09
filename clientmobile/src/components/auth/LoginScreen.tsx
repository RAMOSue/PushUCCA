import { useState } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import GoogleAuthModal from "./GoogleAuthModal";

type FieldErrors = {
  email?: string;
  password?: string;
  submit?: string;
};

const EMPTY_ERRORS: FieldErrors = {};

const GoogleGLogo = () => (
  <Image
    source={{ uri: "https://developers.google.com/static/identity/images/g-logo.png" }}
    style={styles.googleLogo}
    resizeMode="contain"
  />
);

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "Login failed. Please try again.";
  }

  const response = error as {
    response?: {
      data?: {
        error?: string | string[];
        message?: string | string[];
        details?: string | string[];
        errors?: Record<string, string | string[]>;
      };
    };
  };

  const data = response.response?.data;
  if (!data) {
    return "Login failed. Please try again.";
  }

  const normalize = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(" ");
    }

    return value;
  };

  const fieldErrors = data.errors;
  if (fieldErrors) {
    const firstFieldError = Object.values(fieldErrors).find(Boolean);
    const normalizedFieldError = normalize(firstFieldError);
    if (normalizedFieldError) {
      return normalizedFieldError;
    }
  }

  return (
    normalize(data.error) ||
    normalize(data.message) ||
    normalize(data.details) ||
    "Login failed. Please try again."
  );
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, logout, isLoading, completeOAuthSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS);
  const [googleVisible, setGoogleVisible] = useState(false);

  const handleLogin = async () => {
    const nextErrors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email address is required.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors(EMPTY_ERRORS);
    setLoading(true);

    try {
      const response = await login(trimmedEmail.toLowerCase(), password);

      if (response.user.role !== "borrower") {
        Alert.alert("Access denied", "Only borrowers can use the mobile application.");
        await logout();
        return;
      }

      router.replace("/(tabs)/available-items");
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleResult = async (result: { type: string; token?: string; user?: Record<string, unknown>; message?: string }) => {
    setGoogleVisible(false);

    if (result.type === "login") {
      if (result.token && result.user) {
        const role = String((result.user as { role?: string } | undefined)?.role ?? "").trim().toLowerCase();

        if (role && role !== "borrower") {
          const readableRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
          Alert.alert(
            "Account Not Available",
            `This account is registered as a ${readableRole} account and cannot be used to sign in to the Borrower mobile app. Please use a Borrower account.`
          );
          return;
        }

        if (role !== "borrower") {
          Alert.alert(
            "Account Not Available",
            "This account is registered as an unsupported account and cannot be used to sign in to the Borrower mobile app. Please use a Borrower account."
          );
          return;
        }

        await completeOAuthSession(result.token, result.user as any);
        router.replace("/(tabs)/available-items");
      }
      return;
    }

    if (result.type === "error") {
      Alert.alert("Google sign-in", result.message ?? "Google sign-in failed.");
      return;
    }

    Alert.alert("Google sign-in", "No Google account was found. Please create an account first.");
  };

  const isSubmitting = loading || isLoading;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <View style={styles.logoWrap}>
              <Text style={styles.logoText}>
                <Text style={styles.logoBlue}>Du</Text>
                <Text style={styles.logoYellow}>Bud</Text>
                <Text style={styles.logoRed}>Ka</Text>
              </Text>
            </View>

            <View style={[styles.field, styles.firstField]}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputShell, errors.email ? styles.inputShellError : null]}>
                <Ionicons name="mail-outline" size={17} color="#9ca3af" />
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (errors.email || errors.submit) {
                      setErrors((current) => ({ ...current, email: undefined, submit: undefined }));
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="Enter your email"
                  placeholderTextColor="#9ca3af"
                  style={styles.input}
                  textContentType="emailAddress"
                  editable={!isSubmitting}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputShell, errors.password ? styles.inputShellError : null]}>
                <Ionicons name="lock-closed-outline" size={17} color="#9ca3af" />
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (errors.password || errors.submit) {
                      setErrors((current) => ({ ...current, password: undefined, submit: undefined }));
                    }
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  editable={!isSubmitting}
                />
                <Pressable hitSlop={10} onPress={() => setShowPassword((current) => !current)} disabled={isSubmitting}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={17} color="#9ca3af" />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {errors.submit ? <Text style={styles.submitError}>{errors.submit}</Text> : null}

            <Pressable
              onPress={handleLogin}
              disabled={isSubmitting}
              style={({ pressed }) => [styles.button, isSubmitting ? styles.buttonDisabled : null, pressed && !isSubmitting ? styles.buttonPressed : null]}
            >
              {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Login</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom + 8) }] }>
        <Pressable onPress={() => setGoogleVisible(true)} style={({ pressed }) => [styles.googleButton, isSubmitting ? styles.buttonDisabled : null, pressed && !isSubmitting ? styles.buttonPressed : null]} disabled={isSubmitting}>
          <GoogleGLogo />
          <Text style={styles.googleButtonText}>Login with Google</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/(auth)/register")} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.secondaryButtonText}>Create Account</Text>
        </Pressable>
      </View>

      <GoogleAuthModal visible={googleVisible} mode="login" onClose={() => setGoogleVisible(false)} onResult={handleGoogleResult} />
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
    paddingBottom: 120,
  },
  form: {
    width: "100%",
    marginTop: 6,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 34,
    marginTop: -28,
  },
  logoText: {
    fontSize: 32,
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
    marginBottom: 14,
  },
  firstField: {
    marginTop: 4,
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
  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  googleButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 12,
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
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 0,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
  },
});
