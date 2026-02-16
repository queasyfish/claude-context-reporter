// Claude Context Reporter - Popup Script
// Manages the reports list, copy, delete, and export functionality

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // DOM references with null checks
  const reportsList = document.getElementById("reports-list");
  const emptyState = document.getElementById("empty-state");
  const exportBtn = document.getElementById("export-btn");
  const clearBtn = document.getElementById("clear-btn");
  const template = document.getElementById("report-template");

  // Verify required elements exist
  if (!reportsList || !emptyState || !template) {
    console.error("Required DOM elements not found");
    return;
  }

  // Load reports on popup open
  loadReports();

  // Export all reports
  if (exportBtn) {
    exportBtn.addEventListener("click", handleExport);
  }

  // Clear all reports
  if (clearBtn) {
    clearBtn.addEventListener("click", handleClearAll);
  }

  async function handleExport() {
    try {
      exportBtn.disabled = true;
      const response = await browser.runtime.sendMessage({ action: "exportReports" });

      if (response?.success && response.data) {
        downloadJSON(response.data);
      } else {
        console.error("Export failed:", response?.error);
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      exportBtn.disabled = false;
    }
  }

  async function handleClearAll() {
    if (!confirm("Delete all reports? This cannot be undone.")) {
      return;
    }

    try {
      clearBtn.disabled = true;
      await browser.runtime.sendMessage({ action: "clearAllReports" });
      await loadReports();
    } catch (error) {
      console.error("Clear all error:", error);
    } finally {
      clearBtn.disabled = false;
    }
  }

  // Load and display reports
  async function loadReports() {
    try {
      const response = await browser.runtime.sendMessage({ action: "getReports" });
      const reports = Array.isArray(response?.reports) ? response.reports : [];

      // Clear existing content
      reportsList.innerHTML = "";

      if (reports.length === 0) {
        emptyState.classList.remove("hidden");
        reportsList.classList.add("hidden");
        return;
      }

      emptyState.classList.add("hidden");
      reportsList.classList.remove("hidden");

      // Use document fragment for better performance
      const fragment = document.createDocumentFragment();

      for (const report of reports) {
        try {
          const item = createReportItem(report);
          if (item) {
            fragment.appendChild(item);
          }
        } catch (error) {
          console.warn("Failed to create report item:", error);
        }
      }

      reportsList.appendChild(fragment);
    } catch (error) {
      console.error("Failed to load reports:", error);
      emptyState.classList.remove("hidden");
      reportsList.classList.add("hidden");
    }
  }

  // Create report list item
  function createReportItem(report) {
    if (!report || !report.id) {
      console.warn("Invalid report data");
      return null;
    }

    const clone = template.content.cloneNode(true);
    const item = clone.querySelector(".report-item");

    if (!item) return null;

    // Element info
    const elementInfo = item.querySelector(".report-element");
    if (elementInfo) {
      elementInfo.textContent = formatElementName(report);
    }

    // Time
    const time = item.querySelector(".report-time");
    if (time) {
      time.textContent = formatTime(report.timestamp);
      time.title = report.timestamp ? new Date(report.timestamp).toLocaleString() : "";
    }

    // Comment
    const comment = item.querySelector(".report-comment");
    if (comment) {
      const commentText = report.comment?.trim() || "";
      comment.textContent = commentText;
      // Hide if empty
      if (!commentText) {
        comment.style.display = "none";
      }
    }

    // URL
    const url = item.querySelector(".report-url");
    if (url) {
      url.textContent = formatUrl(report.pageUrl);
      url.title = report.pageUrl || "";
    }

    // Copy button
    const copyBtn = item.querySelector(".btn-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => copyAsMarkdown(report, copyBtn));
    }

    // Delete button
    const deleteBtn = item.querySelector(".btn-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => handleDelete(report.id));
    }

    return item;
  }

  async function handleDelete(id) {
    try {
      await browser.runtime.sendMessage({ action: "deleteReport", id });
      await loadReports();
    } catch (error) {
      console.error("Delete error:", error);
    }
  }

  // Format element name for display
  function formatElementName(report) {
    const tagName = report.tagName || "unknown";
    let name = `<${tagName}>`;

    if (report.id) {
      name += `#${truncate(report.id, 20)}`;
    } else if (report.className && typeof report.className === "string") {
      const firstClass = report.className.trim().split(/\s+/)[0];
      if (firstClass) {
        name += `.${truncate(firstClass, 20)}`;
      }
    }

    return name;
  }

  // Format URL for display
  function formatUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      return parsed.hostname + parsed.pathname;
    } catch {
      return truncate(url, 50);
    }
  }

  // Format timestamp
  function formatTime(timestamp) {
    if (!timestamp) return "";

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";

      const now = new Date();
      const diff = now - date;

      if (diff < 0) return date.toLocaleDateString();
      if (diff < 60000) return "Just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

      return date.toLocaleDateString();
    } catch {
      return "";
    }
  }

  // Truncate string
  function truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str || "";
    return str.substring(0, maxLength) + "…";
  }

  // Copy report as Markdown
  async function copyAsMarkdown(report, button) {
    const originalText = button.textContent;

    try {
      const markdown = generateMarkdown(report);
      await navigator.clipboard.writeText(markdown);

      button.textContent = "Copied!";
      button.classList.add("copied");

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("copied");
      }, 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
      button.textContent = "Failed";
      setTimeout(() => {
        button.textContent = originalText;
      }, 1500);
    }
  }

  // Generate Markdown report
  function generateMarkdown(report) {
    const lines = [
      "## Element Context Report",
      "",
      `**Page:** ${escapeMarkdown(report.pageTitle || "Untitled")}`,
      `**URL:** ${report.pageUrl || ""}`,
      `**Captured:** ${formatTimestamp(report.timestamp)}`,
      ""
    ];

    if (report.comment?.trim()) {
      lines.push("### Comment");
      lines.push(report.comment.trim());
      lines.push("");
    }

    lines.push("### Element");
    lines.push(`- **Tag:** \`<${report.tagName || "unknown"}>\``);
    if (report.id) lines.push(`- **ID:** \`${report.id}\``);
    if (report.className) lines.push(`- **Class:** \`${report.className}\``);
    if (report.selector) lines.push(`- **CSS Selector:** \`${report.selector}\``);
    if (report.xpath) lines.push(`- **XPath:** \`${report.xpath}\``);
    lines.push("");

    if (report.textContent?.trim()) {
      lines.push("### Text Content");
      lines.push("```");
      lines.push(report.textContent.trim().substring(0, 300));
      lines.push("```");
      lines.push("");
    }

    if (report.attributes && Object.keys(report.attributes).length > 0) {
      lines.push("### Attributes");
      for (const [key, value] of Object.entries(report.attributes)) {
        lines.push(`- \`${key}\`: ${escapeMarkdown(String(value))}`);
      }
      lines.push("");
    }

    if (report.computedStyles && Object.keys(report.computedStyles).length > 0) {
      lines.push("### Computed Styles");
      lines.push("```css");
      for (const [key, value] of Object.entries(report.computedStyles)) {
        // Key is already in kebab-case from content.js
        lines.push(`${key}: ${value};`);
      }
      lines.push("```");
      lines.push("");
    }

    if (report.boundingRect) {
      const r = report.boundingRect;
      lines.push("### Bounding Box");
      lines.push(`- Position: (${r.left ?? 0}, ${r.top ?? 0})`);
      lines.push(`- Size: ${r.width ?? 0}×${r.height ?? 0}px`);
      lines.push("");
    }

    return lines.join("\n");
  }

  // Format timestamp for markdown
  function formatTimestamp(timestamp) {
    if (!timestamp) return "Unknown";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return "Unknown";
    }
  }

  // Escape markdown special characters
  function escapeMarkdown(str) {
    if (!str) return "";
    return str.replace(/[*_`\[\]]/g, "\\$&");
  }

  // Download JSON file
  function downloadJSON(data) {
    try {
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `context-reports-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  }
});
