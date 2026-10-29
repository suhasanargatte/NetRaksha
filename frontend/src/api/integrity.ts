import apiClient from "./client";
import type {
  IntegrityVerifyResult,
  FileIntegrityRecord,
  IntegrityRecordCreate,
  PaginatedResponse,
  SuccessResponse,
} from "@/types";

export async function verifyFileIntegrity(file: File, referenceHash: string): Promise<IntegrityVerifyResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reference_hash", referenceHash);

  const { data } = await apiClient.post<SuccessResponse<IntegrityVerifyResult>>(
    "/integrity/verify-file",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data.data;
}

export async function verifyLogFileIntegrity(
  logFileId: number,
  referenceHash?: string
): Promise<IntegrityVerifyResult> {
  const { data } = await apiClient.post<SuccessResponse<IntegrityVerifyResult>>(
    `/integrity/verify-log/${logFileId}`,
    null,
    {
      params: referenceHash ? { reference_hash: referenceHash } : undefined,
    }
  );
  return data.data;
}

export async function fetchIntegrityRecords(page = 1, pageSize = 50): Promise<PaginatedResponse<FileIntegrityRecord>> {
  const { data } = await apiClient.get<PaginatedResponse<FileIntegrityRecord>>("/integrity/records", {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function createIntegrityRecord(payload: IntegrityRecordCreate): Promise<FileIntegrityRecord> {
  const { data } = await apiClient.post<SuccessResponse<FileIntegrityRecord>>("/integrity/records", payload);
  return data.data;
}

