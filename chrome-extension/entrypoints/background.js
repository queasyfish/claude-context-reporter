/**
 * Background Script - Message Bridge and Storage Handler
 *
 * Handles context menu, report saving, and file sync operations.
 */

export default defineBackground(() => {
  const STORAGE_KEY = 'claude-context-report';

  // Create context menu item
  chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
      id: 'capture-element',
      title: 'AI Context Capture',
      contexts: ['all']
    });
  });

  // Handle context menu click
  chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === 'capture-element' && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'START_PICKER' }).catch(function() {
        // Content script not loaded
      });
    }
  });

  // Get all reports from storage
  async function getReports() {
    var result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || [];
  }

  // Save a report to storage
  async function saveReport(report) {
    var reports = await getReports();
    reports.push(report);
    await chrome.storage.local.set({ [STORAGE_KEY]: reports });
    return reports;
  }

  // Sync reports to downloads folder
  async function syncReportsToFile() {
    try {
      var reports = await getReports();
      var json = JSON.stringify(reports, null, 2);
      // Use data URL instead of blob URL (service workers don't have URL.createObjectURL)
      var dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(json)));

      chrome.downloads.download({
        url: dataUrl,
        filename: 'claude-context-reports.json',
        saveAs: false,
        conflictAction: 'overwrite'
      });
    } catch (error) {
      console.error('Failed to sync reports to file:', error);
    }
  }

  // Handle messages from content scripts and devtools
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'SAVE_REPORT') {
      // Save report and sync to file
      saveReport(message.report)
        .then(function() {
          return syncReportsToFile();
        })
        .then(function() {
          sendResponse({ success: true });
        })
        .catch(function(error) {
          console.error('Failed to save report:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }

    if (message.type === 'SHOW_MODAL_IN_TAB') {
      // Forward to content script in the specified tab
      chrome.tabs.sendMessage(message.tabId, {
        type: 'SHOW_MODAL',
        elementData: message.elementData
      }).then(function(response) {
        sendResponse(response);
      }).catch(function() {
        // Content script not loaded - page needs refresh
        sendResponse({ success: false, error: 'Content script not loaded' });
      });
      return true; // Keep channel open for async response
    }
  });
});
