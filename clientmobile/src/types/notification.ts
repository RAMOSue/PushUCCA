export type NotificationItem = {
  id: string | number;
  type?: string | null;
  message: string;
  data?: Record<string, unknown> | null;
  is_delivered?: boolean;
  is_read?: boolean;
  created_at?: string | null;
};