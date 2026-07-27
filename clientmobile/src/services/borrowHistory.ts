import { api } from "./api";
import type { BorrowHistoryRecord } from "../types/borrowHistory";

export async function fetchBorrowHistory(userId: string | number) {
  const response = await api.get<BorrowHistoryRecord[]>(`/api/borrow/history/${userId}`);
  return response.data;
}

export async function initiateReturnRequest(payload: {
  borrowing_request_id: string | number;
  returned_unit_ids: (string | number)[];
  notes?: string;
}) {
  const response = await api.post<{ success: boolean; return_request_id?: string | number; error?: string; message?: string }>(
    "/api/borrow/return/initiate",
    payload
  );
  return response.data;
}

export async function uploadReturnPhoto(requestId: string | number, formData: FormData) {
  const response = await api.post<{ success: boolean; photo?: unknown; error?: string; message?: string }>(
    `/api/borrow/return/photos/${requestId}/upload`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}

export async function fetchReturnPhotos(requestId: string | number) {
  const response = await api.get<{ success: boolean; photos?: Record<string, unknown>[]; error?: string }>(
    `/api/borrow/return/photos/${requestId}`
  );
  return response.data;
}

export async function submitReturnRequest(payload: {
  return_request_id: string | number;
  borrowing_request_id: string | number;
  photos_count: number;
}) {
  const response = await api.post<{ success: boolean; error?: string; message?: string }>(
    "/api/borrow/return/submit",
    payload
  );
  return response.data;
}
