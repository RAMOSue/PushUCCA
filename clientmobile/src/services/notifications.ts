import { api } from "./api";
import type { NotificationItem } from "../types/notification";

export async function fetchNotifications() {
  const response = await api.get<NotificationItem[]>("/api/notifications");
  return response.data;
}

export async function fetchUnreadNotificationCount() {
  const response = await api.get<{ count: number }>("/api/notifications/unread-count");
  return response.data.count || 0;
}

export async function markNotificationAsRead(notificationId: string | number) {
  const response = await api.post("/api/notifications/mark-read", { id: notificationId });
  return response.data;
}

export async function markAllNotificationsAsRead() {
  const response = await api.post("/api/notifications/mark-all-read");
  return response.data;
}

export async function deleteNotification(notificationId: string | number) {
  const response = await api.post("/api/notifications/delete", { id: notificationId });
  return response.data;
}