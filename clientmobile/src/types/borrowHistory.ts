export type BorrowStatus =
  | "pending"
  | "approved"
  | "pending_return"
  | "returned"
  | "rejected"
  | "declined"
  | "cancelled"
  | "canceled"
  | "borrowed"
  | string;

export type BorrowHistoryItem = {
  id?: string | number | null;
  unit_id?: string | number | null;
  unit_number?: string | null;
  item_name?: string | null;
  name?: string | null;
  garment_type?: string | null;
  category?: string | null;
  size?: string | null;
  condition?: string | null;
  image_url?: string | null;
  inventory_unit_id?: string | number | null;
};

export type BorrowHistoryRecord = {
  request_id: string | number;
  status: BorrowStatus;
  created_at?: string | null;
  request_date?: string | null;
  approved_at?: string | null;
  due_date?: string | null;
  returned_at?: string | null;
  return_decline_reason?: string | null;
  declined_at?: string | null;
  is_overdue?: boolean;
  days_until_due?: number | null;
  borrower_name?: string | null;
  items: BorrowHistoryItem[];
};
