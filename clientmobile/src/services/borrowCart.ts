import { api } from "./api";
import type { BorrowCartResponse } from "../types/borrowCart";

export type RemoveBorrowCartPayload = {
  borrower_id: string;
  unit_id?: string | number;
  item_id?: string | number;
};

export type SubmitBorrowCartPayload = {
  borrower_id: string;
  request_id?: string | number | null;
  items: Array<{
    unit_id: string | number;
    item_id: string | number;
    quantity: number;
  }>;
  quantity?: number;
  finalQuantity?: number;
  item_count?: number;
};

export type ScanBorrowQrResponse = {
  type?: "unit" | "item";
  data?: {
    unit_id?: string | number | null;
    inventory_unit_id?: string | number | null;
    item_id?: string | number | null;
    item_uuid?: string | null;
    name?: string | null;
    item_name?: string | null;
    category?: string | null;
    garment_type?: string | null;
    description?: string | null;
    image_url?: string | null;
    qr_code_url?: string | null;
    status?: string | null;
    size?: string | null;
  } | null;
  inventory_unit_id?: string | number | null;
  item_id?: string | number | null;
  item_uuid?: string | null;
  item_name?: string | null;
  category?: string | null;
  garment_type?: string | null;
  description?: string | null;
  image_url?: string | null;
  qr_code_url?: string | null;
  status?: string | null;
  size?: string | null;
};

export type AddBorrowCartPayload = {
  borrower_id: string;
  request_id?: string | number | null;
  items: Array<{
    unit_id?: string | number;
    item_id?: string | number;
    quantity: number;
  }>;
};

export type StartBorrowingSessionResponse = {
  success?: boolean;
  borrowingId?: string | number | null;
  request_id?: string | number | null;
  error?: string;
};

export async function startBorrowingSession() {
  const response = await api.post<StartBorrowingSessionResponse>("/api/borrow/start");
  return response.data;
}

export async function fetchReservedBorrowCart(userId: string | number) {
  const response = await api.get<BorrowCartResponse>(`/api/borrow/reserved/${userId}`);
  return response.data;
}

export async function scanBorrowQrCode(qrCodeText: string) {
  const response = await api.get<ScanBorrowQrResponse>(`/api/inventory/scan/text/${encodeURIComponent(qrCodeText)}`);
  return response.data;
}

export async function scanBorrowQrCodeFlexible(qrCodeText: string) {
  const response = await api.get<ScanBorrowQrResponse>(`/api/inventory/scan/flexible/${encodeURIComponent(qrCodeText)}`);
  return response.data;
}

export async function addBorrowCartItems(payload: AddBorrowCartPayload) {
  const response = await api.post("/api/borrow/cart", payload);
  return response.data;
}

export async function removeBorrowCartItem(payload: RemoveBorrowCartPayload) {
  const response = await api.post("/api/borrow/cart/remove", payload);
  return response.data;
}

export async function submitBorrowCart(payload: SubmitBorrowCartPayload) {
  const response = await api.post("/api/borrow/submit-cart", payload);
  return response.data;
}