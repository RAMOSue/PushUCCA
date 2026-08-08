import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { API_BASE_URL } from "../../constants/api";

type GoogleAuthResult =
  | { type: "login"; token: string; user: Record<string, unknown> }
  | { type: "prefill"; name: string; email: string }
  | { type: "error"; message: string };

type GoogleAuthModalProps = {
  visible: boolean;
  mode: "login" | "register";
  onClose: () => void;
  onResult: (result: GoogleAuthResult) => void;
};

const parseParams = (url: string) => {
  const queryIndex = url.indexOf("?");
  if (queryIndex < 0) {
    return new URLSearchParams();
  }

  return new URLSearchParams(url.slice(queryIndex + 1));
};

export default function GoogleAuthModal({ visible, mode, onClose, onResult }: GoogleAuthModalProps) {
  const authUrl = `${API_BASE_URL}/api/auth/google?mode=${mode}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{mode === "login" ? "Continue with Google" : "Sign up with Google"}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <WebView
          source={{ uri: authUrl }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#004d1a" />
            </View>
          )}
          onNavigationStateChange={(navState: { url?: string }) => {
            const nextUrl = navState.url;
            if (!nextUrl) {
              return;
            }

            const params = parseParams(nextUrl);
            const token = params.get("token");
            const userParam = params.get("user");
            const googleName = params.get("google_name");
            const googleEmail = params.get("google_email");
            const googleError = params.get("google_error");

            if (googleError) {
              onResult({ type: "error", message: googleError });
              return;
            }

            if (token && userParam) {
              onResult({
                type: "login",
                token,
                user: JSON.parse(decodeURIComponent(userParam)),
              });
              return;
            }

            if (googleName || googleEmail) {
              onResult({ type: "prefill", name: googleName ?? "", email: googleEmail ?? "" });
            }
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingTop: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: {
    color: "#004d1a",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
