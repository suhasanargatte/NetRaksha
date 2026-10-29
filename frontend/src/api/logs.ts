import apiClient from "./client";
import type {
  HealthStatus,
  PaginatedResponse,
  LogFileListItem,
  LogFile,
  LogUploadData,
  ParsedEvent,
  SuccessResponse,
} from "@/types";

export async function fetchHealth(): Promise<HealthStatus> {
  const { data } = await apiClient.get<HealthStatus>("/health");
  return data;
}

export async function fetchLogFiles(
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<LogFileListItem>> {
  const { data } = await apiClient.get<PaginatedResponse<LogFileListItem>>("/logs", {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function fetchLogFile(id: number): Promise<LogFile> {
  const { data } = await apiClient.get<SuccessResponse<LogFile>>(`/logs/${id}`);
  return data.data;
}

export async function uploadLogFile(file: File): Promise<LogUploadData> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await apiClient.post<SuccessResponse<LogUploadData>>(
    "/logs/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return data.data;
}

export async function fetchLogEvents(
  logId: number,
  page = 1,
  pageSize = 50,
  search?: string
): Promise<PaginatedResponse<ParsedEvent>> {
  const { data } = await apiClient.get<PaginatedResponse<ParsedEvent>>(
    `/logs/${logId}/events`,
    {
      params: {
        page,
        page_size: pageSize,
        search: search ? search : undefined,
      },
    }
  );
  return data;
}

export async function fetchRecentEvents(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<PaginatedResponse<ParsedEvent>> {
  const { data } = await apiClient.get<PaginatedResponse<ParsedEvent>>(
    "/logs/events/recent",
    {
      params: {
        page,
        page_size: pageSize,
        search: search ? search : undefined,
      },
    }
  );
  return data;
}

export async function deleteLogFile(id: number): Promise<void> {
  await apiClient.delete(`/logs/${id}`);
}
