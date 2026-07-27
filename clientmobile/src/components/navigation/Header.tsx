import { memo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CartBadge from "./CartBadge";

type HeaderProps = {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onClearSearch?: () => void;
  cartCount?: number;
  notificationCount?: number;
  showBackButton?: boolean;
  onBackPress?: () => void;
  onCartPress?: () => void;
  onNotificationsPress?: () => void;
  onProfilePress?: () => void;
  searchInputProps?: Pick<TextInputProps, "returnKeyType" | "autoCorrect" | "autoCapitalize">;
};

function Header({
  title,
  subtitle,
  showSearch = false,
  searchValue,
  searchPlaceholder = "Search...",
  onSearchChange,
  onClearSearch,
  cartCount = 0,
  notificationCount = 0,
  showBackButton = false,
  onBackPress,
  onCartPress,
  onNotificationsPress,
  onProfilePress,
  searchInputProps,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            {showBackButton ? (
              <Pressable onPress={onBackPress} style={styles.backButton} hitSlop={10}>
                <Ionicons name="arrow-back" size={18} color="#0f172a" />
              </Pressable>
            ) : null}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.actionsRow}>
          {onCartPress ? (
            <Pressable onPress={onCartPress} style={styles.actionButton} hitSlop={10}>
              <Ionicons name="cart-outline" size={20} color="#0f172a" />
              <CartBadge count={cartCount} />
            </Pressable>
          ) : null}

          {onNotificationsPress ? (
            <Pressable onPress={onNotificationsPress} style={styles.actionButton} hitSlop={10}>
              <Ionicons name="notifications-outline" size={20} color="#0f172a" />
              <CartBadge count={notificationCount} />
            </Pressable>
          ) : null}

          {onProfilePress ? (
            <Pressable onPress={onProfilePress} style={styles.profileButton} hitSlop={10}>
              <Ionicons name="person-circle-outline" size={24} color="#0f172a" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {showSearch ? (
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#64748b" />
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            {...searchInputProps}
          />
          {searchValue && onClearSearch ? (
            <Pressable onPress={onClearSearch} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#64748b" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default memo(Header);

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
  },
});