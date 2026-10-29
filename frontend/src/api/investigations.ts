import apiClient from "./client";
import type {
  PaginatedResponse,
  Investigation,
  InvestigationCreate,
  InvestigationUpdate,
  AlertListItem,
  AuditRecord,
  SuccessResponse,
} from "@/types";

export async function fetchInvestigations(page = 1, pageSize = 20): Promise<PaginatedResponse<Investigation>> {
  const { data } = await apiClient.get<PaginatedResponse<Investigation>>("/investigations", {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function fetchInvestigation(id: number): Promise<Investigation> {
  const { data } = await apiClient.get<SuccessResponse<Investigation>>(`/investigations/${id}`);
  return data.data;
}

export async function createInvestigation(payload: InvestigationCreate): Promise<Investigation> {
  const { data } = await apiClient.post<SuccessResponse<Investigation>>("/investigations", payload);
  return data.data;
}

export async function updateInvestigation(id: number, payload: InvestigationUpdate): Promise<Investigation> {
  const { data } = await apiClient.patch<SuccessResponse<Investigation>>(`/investigations/${id}`, payload);
  return data.data;
}

export async function deleteInvestigation(id: number): Promise<void> {
  await apiClient.delete(`/investigations/${id}`);
}

export async function fetchInvestigationAlerts(id: number): Promise<AlertListItem[]> {
  const { data } = await apiClient.get<SuccessResponse<AlertListItem[]>>(`/investigations/${id}/alerts`);
  return data.data;
}

export async function addAlertsToInvestigation(id: number, alertIds: number[]): Promise<Investigation> {
  const { data } = await apiClient.post<SuccessResponse<Investigation>>(`/investigations/${id}/alerts`, {
    alert_ids: alertIds,
  });
  return data.data;
}

export async function removeAlertFromInvestigation(id: number, alertId: number): Promise<Investigation> {
  const { data } = await apiClient.delete<SuccessResponse<Investigation>>(`/investigations/${id}/alerts/${alertId}`);
  return data.data;
}

export async function fetchInvestigationAudit(id: number): Promise<AuditRecord[]> {
  const { data } = await apiClient.get<SuccessResponse<AuditRecord[]>>(`/investigations/${id}/audit`);
  return data.data;
}

export async function fetchGlobalAuditTrail(page = 1, pageSize = 50): Promise<PaginatedResponse<AuditRecord>> {
  const { data } = await apiClient.get<PaginatedResponse<AuditRecord>>("/audit", {
    params: { page, page_size: pageSize },
  });
  return data;
}

