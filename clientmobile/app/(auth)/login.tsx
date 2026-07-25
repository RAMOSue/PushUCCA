import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "../../src/context/AuthContext";

type FieldErrors = {
  email?: string;
  password?: string;
  submit?: string;
};

const EMPTY_ERRORS: FieldErrors = {};

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

export default function Login() {
  const router = useRouter();
  const { login, logout, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS);

  const handleLogin = async () => {
    const nextErrors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
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
        Alert.alert(
          "Access denied",
          "Only borrowers can use the mobile application."
        );
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

  const isSubmitting = loading || isLoading;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>UCCA</Text>
            </View>

            <Text style={styles.title}>Costume &amp; Instrument Borrowing System</Text>
            <Text style={styles.subtitle}>Borrower Mobile Client</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputShell, errors.email ? styles.inputShellError : null]}>
                <Ionicons name="mail-outline" size={20} color="#8A93A7" />
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (errors.email || errors.submit) {
                      setErrors((current) => ({
                        ...current,
                        email: undefined,
                        submit: undefined,
                      }));
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="borrower@carsu.edu.ph"
                  placeholderTextColor="#7F8798"
                  style={styles.input}
                  textContentType="emailAddress"
                  editable={!isSubmitting}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputShell,
                  errors.password ? styles.inputShellError : null,
                ]}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#8A93A7" />
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (errors.password || errors.submit) {
                      setErrors((current) => ({
                        ...current,
                        password: undefined,
                        submit: undefined,
                      }));
                    }
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#7F8798"
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  editable={!isSubmitting}
                />
                <Pressable
                  hitSlop={10}
                  onPress={() => setShowPassword((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#8A93A7"
                  />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {errors.submit ? <Text style={styles.submitError}>{errors.submit}</Text> : null}

            <Pressable
              onPress={handleLogin}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.button,
                isSubmitting ? styles.buttonDisabled : null,
                pressed && !isSubmitting ? styles.buttonPressed : null,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#0B1220" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07111F",
  },
  keyboardWrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(254, 200, 88, 0.14)",
  },
  backgroundGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(72, 187, 255, 0.12)",
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 28,
    backgroundColor: "rgba(9, 18, 34, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  logoMark: {
    alignSelf: "center",
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    backgroundColor: "#F3B23B",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  logoText: {
    color: "#0B1220",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: "#F7FAFC",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    color: "#94A3B8",
    fontSize: 15,
    textAlign: "center",
  },
  field: {
    marginBottom: 18,
  },
  label: {
    color: "#CBD5E1",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  inputShell: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#121C2F",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
  },
  inputShellError: {
    borderColor: "#F87171",
  },
  input: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 16,
    paddingVertical: 0,
  },
  passwordInput: {
    paddingRight: 4,
  },
  errorText: {
    marginTop: 8,
    color: "#FCA5A5",
    fontSize: 13,
  },
  submitError: {
    marginBottom: 16,
    color: "#FCA5A5",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    backgroundColor: "#F3B23B",
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: "#0B1220",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
