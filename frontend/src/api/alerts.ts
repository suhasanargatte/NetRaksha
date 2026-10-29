import apiClient from "./client";
import type {
  PaginatedResponse,
  AlertListItem,
  Alert,
  AlertStatus,
  AlertReviewUpdate,
  Severity,
  SuccessResponse,
} from "@/types";

export interface AlertFilters {
  page?: number;
  page_size?: number;
  severity?: Severity;
  status?: AlertStatus;
  log_file_id?: number;
  investigation_id?: number;
}

export async function fetchAlerts(filters: AlertFilters = {}): Promise<PaginatedResponse<AlertListItem>> {
  const { data } = await apiClient.get<PaginatedResponse<AlertListItem>>("/alerts", {
    params: filters,
  });
  return data;
}

export async function fetchAlert(id: number): Promise<Alert> {
  const { data } = await apiClient.get<SuccessResponse<Alert>>(`/alerts/${id}`);
  return data.data;
}

export async function updateAlertReview(id: number, payload: AlertReviewUpdate): Promise<Alert> {
  const { data } = await apiClient.patch<SuccessResponse<Alert>>(`/alerts/${id}`, payload);
  return data.data;
}

