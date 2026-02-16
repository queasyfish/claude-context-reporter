/**
 * Storage module for Claude Context Report Chrome Extension
 *
 * Provides typed CRUD operations for Report storage using chrome.storage.local.
 * This module isolates storage implementation from business logic.
 */

const STORAGE_KEY = 'claude-context-report';

/**
 * Report interface matching PROJECT.md schema.
 * Represents a captured element report with user comment.
 */
export interface Report {
  reportId: string;
  url: string;
  comment: string;
  element: {
    selector: string;
    xpath: string;
    computedStyles: Record<string, string>;
  };
}

/**
 * Get all reports from storage.
 * @returns Promise resolving to array of reports (empty array if none exist)
 */
export async function getReports(): Promise<Report[]> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || [];
}

/**
 * Save a new report to storage.
 * Appends the report to the existing array.
 * @param report The report to save
 */
export async function saveReport(report: Report): Promise<void> {
  const reports = await getReports();
  reports.push(report);
  await chrome.storage.local.set({ [STORAGE_KEY]: reports });
}

/**
 * Delete a report by its ID.
 * @param reportId The ID of the report to delete
 */
export async function deleteReport(reportId: string): Promise<void> {
  const reports = await getReports();
  const filtered = reports.filter((r) => r.reportId !== reportId);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

/**
 * Clear all reports from storage.
 */
export async function clearReports(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
