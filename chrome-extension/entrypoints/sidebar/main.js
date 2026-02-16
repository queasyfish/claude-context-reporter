// Sidebar script - handles element selection display and capture
import { getElementCaptureCode } from '../../lib/element-capture.js';
import { saveReport, getReports, deleteReport, clearReports } from '../../lib/storage.ts';

// State variable to track currently selected element data
var currentElementData = null;

// Sync reports to downloads folder for external access
async function syncReportsToFile() {
  try {
    var reports = await getReports();
    var json = JSON.stringify(reports, null, 2);
    // Use data URL for compatibility with service worker context
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

// Capture comprehensive element data via eval in inspected page context
function captureElementData() {
  return new Promise(function(resolve) {
    chrome.devtools.inspectedWindow.eval(
      getElementCaptureCode(),
      function(result, isException) {
        if (isException || !result) {
          resolve(null);
        } else {
          resolve(result);
        }
      }
    );
  });
}

// Update display with captured element data
function updateDisplay() {
  captureElementData().then(function(data) {
    // Store captured data for save functionality
    currentElementData = data;

    var urlEl = document.getElementById('url-value');
    var selectorEl = document.getElementById('selector-value');
    var xpathEl = document.getElementById('xpath-value');
    var stylesEl = document.getElementById('styles-value');

    if (!data) {
      urlEl.textContent = '-';
      selectorEl.textContent = 'No element selected';
      xpathEl.textContent = '-';
      stylesEl.textContent = '-';
      currentElementData = null;
      return;
    }

    // Display URL
    urlEl.textContent = data.url || '-';

    // Display CSS Selector
    selectorEl.textContent = data.selector || '-';

    // Display XPath
    xpathEl.textContent = data.xpath || '-';

    // Display Computed Styles
    if (data.computedStyles && Object.keys(data.computedStyles).length > 0) {
      var stylesText = '';
      var keys = Object.keys(data.computedStyles);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = data.computedStyles[key];
        if (value) {
          stylesText += key + ': ' + value + '\n';
        }
      }
      stylesEl.textContent = stylesText.trim() || '-';
    } else {
      stylesEl.textContent = '-';
    }
  });
}

// Update save button enabled state based on current conditions
function updateSaveButtonState() {
  var commentInput = document.getElementById('comment-input');
  var saveBtn = document.getElementById('save-btn');
  var comment = commentInput.value.trim();
  var hasComment = comment.length > 0;
  var hasElement = currentElementData !== null;
  saveBtn.disabled = !(hasComment && hasElement);
}

// Clear feedback message
function clearFeedback() {
  var feedbackEl = document.getElementById('save-feedback');
  feedbackEl.textContent = '';
  feedbackEl.classList.remove('success');
  feedbackEl.classList.remove('error');
}

// Show feedback message
function showFeedback(message, isSuccess) {
  var feedbackEl = document.getElementById('save-feedback');
  feedbackEl.textContent = message;
  feedbackEl.classList.remove('success');
  feedbackEl.classList.remove('error');
  if (isSuccess) {
    feedbackEl.classList.add('success');
  } else {
    feedbackEl.classList.add('error');
  }
  setTimeout(clearFeedback, 3000);
}

// Handle save button click
async function handleSave() {
  var commentInput = document.getElementById('comment-input');
  var comment = commentInput.value.trim();

  if (!comment) {
    showFeedback('Please enter a comment', false);
    return;
  }

  // Re-capture element data for freshness
  var elementData = await captureElementData();

  if (!elementData) {
    showFeedback('Please select an element first', false);
    return;
  }

  // Build report object
  var report = {
    reportId: crypto.randomUUID(),
    url: elementData.url,
    comment: comment,
    element: {
      selector: elementData.selector,
      xpath: elementData.xpath,
      computedStyles: elementData.computedStyles,
      tagName: elementData.tagName,
      elementId: elementData.elementId,
      textContent: elementData.textContent
    }
  };

  try {
    await saveReport(report);
    await syncReportsToFile();
    commentInput.value = '';
    updateSaveButtonState();
    showFeedback('Report saved!', true);
  } catch (error) {
    console.error('Failed to save report:', error);
    showFeedback('Failed to save report', false);
  }
}

// Truncate text with ellipsis
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Switch between capture and reports views
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(function(v) {
    v.hidden = true;
  });
  document.getElementById(viewName + '-view').hidden = false;

  document.querySelectorAll('.tab-btn').forEach(function(t) {
    t.classList.remove('active');
  });
  document.querySelector('[data-view="' + viewName + '"]').classList.add('active');

  // Refresh report list when switching to reports view
  if (viewName === 'reports') {
    renderReportList();
  }
}

// Render report list from storage
async function renderReportList() {
  var reports = await getReports();
  var container = document.getElementById('report-list');

  if (reports.length === 0) {
    container.innerHTML = '<p class="empty-state">No reports saved yet.</p>';
    return;
  }

  container.innerHTML = reports.map(function(report) {
    // Build element identifier display
    var elemDisplay = '';
    if (report.element && report.element.elementId) {
      elemDisplay = report.element.elementId;
      if (report.element.textContent) {
        elemDisplay += ' "' + truncate(report.element.textContent, 20) + '"';
      }
    }

    return '<div class="report-item" data-id="' + escapeHtml(report.reportId) + '">' +
      '<div class="report-summary">' +
        '<span class="report-url">' + escapeHtml(truncate(report.url, 50)) + '</span>' +
        (elemDisplay ? '<span class="report-element">' + escapeHtml(elemDisplay) + '</span>' : '') +
        '<span class="report-comment">' + escapeHtml(truncate(report.comment, 60)) + '</span>' +
      '</div>' +
      '<div class="report-actions">' +
        '<button class="action-btn copy-btn" data-id="' + escapeHtml(report.reportId) + '">Copy</button>' +
        '<button class="action-btn delete-btn" data-id="' + escapeHtml(report.reportId) + '">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Format report as Markdown for AI tools
function formatReportAsMarkdown(report) {
  var stylesText = Object.keys(report.element.computedStyles).map(function(key) {
    return key + ': ' + report.element.computedStyles[key] + ';';
  }).join('\n');

  return '## Element Report\n\n' +
    '**Page URL:** ' + report.url + '\n\n' +
    '**User Comment:** ' + report.comment + '\n\n' +
    '### Element Identification\n' +
    '- **CSS Selector:** `' + report.element.selector + '`\n' +
    '- **XPath:** `' + report.element.xpath + '`\n\n' +
    '### Computed Styles\n' +
    '```css\n' + stylesText + '\n```\n';
}

// Copy report to clipboard as Markdown
async function copyReportToClipboard(reportId) {
  var reports = await getReports();
  var report = reports.find(function(r) { return r.reportId === reportId; });

  if (!report) {
    showFeedback('Report not found', false);
    return;
  }

  var markdown = formatReportAsMarkdown(report);

  try {
    await navigator.clipboard.writeText(markdown);
    showFeedback('Copied to clipboard!', true);
  } catch (error) {
    console.error('Clipboard write failed:', error);
    showFeedback('Failed to copy', false);
  }
}

// Delete a single report
async function handleDeleteReport(reportId) {
  try {
    await deleteReport(reportId);
    await syncReportsToFile();
    await renderReportList();
    showFeedback('Report deleted', true);
  } catch (error) {
    console.error('Delete failed:', error);
    showFeedback('Failed to delete', false);
  }
}

// Clear all reports with confirmation
async function handleClearAll() {
  var dialog = document.getElementById('clear-confirm-dialog');

  var confirmed = await new Promise(function(resolve) {
    var handler = function() {
      dialog.removeEventListener('close', handler);
      resolve(dialog.returnValue === 'confirm');
    };
    dialog.addEventListener('close', handler);
    dialog.showModal();
  });

  if (!confirmed) return;

  try {
    await clearReports();
    await syncReportsToFile();
    await renderReportList();
    showFeedback('All reports cleared', true);
  } catch (error) {
    console.error('Clear all failed:', error);
    showFeedback('Failed to clear reports', false);
  }
}

// Listen for selection changes
chrome.devtools.panels.elements.onSelectionChanged.addListener(function() {
  updateDisplay();
  updateSaveButtonState();
});

// Comment input event listener
document.getElementById('comment-input').addEventListener('input', updateSaveButtonState);

// Save button click event listener
document.getElementById('save-btn').addEventListener('click', handleSave);

// Tab navigation event listeners
document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    switchView(btn.dataset.view);
  });
});

// Event delegation for report list actions
document.getElementById('report-list').addEventListener('click', async function(e) {
  var button = e.target.closest('button');
  if (!button) return;

  var reportId = button.dataset.id;
  if (!reportId) return;

  if (button.classList.contains('copy-btn')) {
    await copyReportToClipboard(reportId);
  } else if (button.classList.contains('delete-btn')) {
    await handleDeleteReport(reportId);
  }
});

// Clear all button listener
document.getElementById('clear-all-btn').addEventListener('click', handleClearAll);

// Initial update
updateDisplay();
updateSaveButtonState();
