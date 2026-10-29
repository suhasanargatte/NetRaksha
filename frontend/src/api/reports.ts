import apiClient from "./client";

export async function downloadInvestigationReport(
  investigationId: number,
  format: "csv" | "pdf",
  filenamePrefix = "NetRakshak-Investigation"
): Promise<void> {
  const response = await apiClient.get(
    `/reports/investigation/${investigationId}/${format}`,
    { responseType: "blob" }
  );

  const mimeType = format === "pdf" ? "application/pdf" : "text/csv";
  const blob = new Blob([response.data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${investigationId}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function downloadAlertsCsv(
  severity?: string,
  status?: string
): Promise<void> {
  const params: Record<string, string> = {};
  if (severity && severity !== "all") params.severity = severity;
  if (status && status !== "all") params.status = status;

  const response = await apiClient.get("/reports/alerts/csv", {
    params,
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "NetRakshak-Security-Alerts.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

