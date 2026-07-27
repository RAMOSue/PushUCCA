export type BorrowCartItem = {
  request_id?: string | number | null;
  unit_id: string | number;
  unitId?: string | number;
  item_id: string | number;
  itemId?: string | number;
  name: string;
  category?: string | null;
  garment_type?: string | null;
  image_url?: string | null;
  size?: string | null;
  unit_number?: string | null;
  status?: string | null;
};

export type BorrowCartResponse = {
  success?: boolean;
  request_id: string | number | null;
  items: BorrowCartItem[];
  quantity?: number;
  error?: string;
  failed_items?: Array<{
    unit_id?: string | number | null;
    item_id?: string | number | null;
    error?: string;
  }>;
};