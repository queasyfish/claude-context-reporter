/**
 * Content Script - Element Picker and Modal Overlay
 *
 * Provides a custom element picker activated via context menu.
 * Highlights elements on hover and shows capture modal on click.
 */

export default defineContentScript({
  matches: ['<all_urls>'],

  main() {
    // State
    var modal = null;
    var currentElementData = null;
    var pickerActive = false;
    var highlightOverlay = null;
    var hoveredElement = null;

    // ========== ELEMENT PICKER ==========

    function createHighlightOverlay() {
      if (highlightOverlay) return highlightOverlay;

      highlightOverlay = document.createElement('div');
      highlightOverlay.id = 'ccr-highlight-overlay';

      var style = document.createElement('style');
      style.textContent = `
        #ccr-highlight-overlay {
          position: fixed;
          pointer-events: none;
          border: 2px solid #4285f4;
          background: rgba(66, 133, 244, 0.1);
          z-index: 2147483646;
          transition: all 0.05s ease-out;
          display: none;
        }
        #ccr-highlight-overlay::after {
          content: attr(data-tag);
          position: absolute;
          top: -20px;
          left: -2px;
          background: #4285f4;
          color: white;
          font-size: 11px;
          font-family: system-ui, sans-serif;
          padding: 2px 6px;
          border-radius: 2px;
          white-space: nowrap;
        }
        body.ccr-picker-active {
          cursor: crosshair !important;
        }
        body.ccr-picker-active * {
          cursor: crosshair !important;
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(highlightOverlay);
      return highlightOverlay;
    }

    function updateHighlight(element) {
      if (!element || element === document.body || element === document.documentElement) {
        highlightOverlay.style.display = 'none';
        return;
      }

      var rect = element.getBoundingClientRect();
      highlightOverlay.style.display = 'block';
      highlightOverlay.style.top = rect.top + 'px';
      highlightOverlay.style.left = rect.left + 'px';
      highlightOverlay.style.width = rect.width + 'px';
      highlightOverlay.style.height = rect.height + 'px';

      // Show tag name
      var tag = element.tagName.toLowerCase();
      if (element.id) tag += '#' + element.id;
      else if (element.className && typeof element.className === 'string') {
        var firstClass = element.className.trim().split(/\s+/)[0];
        if (firstClass) tag += '.' + firstClass;
      }
      highlightOverlay.setAttribute('data-tag', tag);
    }

    function handleMouseMove(e) {
      if (!pickerActive) return;

      // Ignore our own elements
      if (e.target.id === 'ccr-highlight-overlay' ||
          e.target.id === 'claude-context-report-modal' ||
          e.target.closest('#claude-context-report-modal')) {
        return;
      }

      hoveredElement = e.target;
      updateHighlight(hoveredElement);
    }

    function handleClick(e) {
      if (!pickerActive) return;

      // Ignore our own elements
      if (e.target.id === 'ccr-highlight-overlay' ||
          e.target.id === 'claude-context-report-modal' ||
          e.target.closest('#claude-context-report-modal')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      var element = hoveredElement || e.target;
      var elementData = captureElementData(element);

      stopPicker();
      showModal(elementData);
    }

    function handleKeyDown(e) {
      if (!pickerActive) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        stopPicker();
      }
    }

    function startPicker() {
      if (pickerActive) return;

      pickerActive = true;
      createHighlightOverlay();
      document.body.classList.add('ccr-picker-active');

      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }

    function stopPicker() {
      if (!pickerActive) return;

      pickerActive = false;
      document.body.classList.remove('ccr-picker-active');

      if (highlightOverlay) {
        highlightOverlay.style.display = 'none';
      }

      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);

      hoveredElement = null;
    }

    // ========== ELEMENT DATA CAPTURE ==========

    function captureElementData(el) {
      if (!el) return null;

      return {
        selector: getCssSelector(el),
        xpath: getXPath(el),
        computedStyles: getComputedStyles(el),
        url: location.href,
        tagName: el.tagName.toLowerCase(),
        elementId: getElementId(el),
        textContent: getTextContent(el)
      };
    }

    function getCssSelector(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

      var path = [];
      var current = el;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        var selector = current.tagName.toLowerCase();

        if (current.id) {
          selector += '#' + current.id;
        }

        if (current.className && typeof current.className === 'string') {
          var classes = current.className.trim().split(/\s+/).filter(function(c) { return c; });
          if (classes.length > 0) {
            selector += '.' + classes.join('.');
          }
        }

        if (current.parentElement) {
          var siblings = [];
          var child = current.parentElement.firstElementChild;
          while (child) {
            if (child.tagName === current.tagName) {
              siblings.push(child);
            }
            child = child.nextElementSibling;
          }
          if (siblings.length > 1) {
            var index = siblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }

        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ');
    }

    function getXPath(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

      var path = [];
      var current = el;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        var tagName = current.tagName.toLowerCase();
        var index = 1;
        var sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousElementSibling;
        }

        var attrs = '';
        if (current.id) {
          attrs += '[@id="' + current.id + '"]';
        }
        if (current.className && typeof current.className === 'string') {
          var classStr = current.className.trim();
          if (classStr) {
            attrs += '[@class="' + classStr + '"]';
          }
        }

        path.unshift(tagName + attrs + '[' + index + ']');
        current = current.parentElement;
      }

      return '/' + path.join('/');
    }

    function getComputedStyles(el) {
      var computed = window.getComputedStyle(el);
      var properties = [
        'display', 'position', 'float', 'clear',
        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
        'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
        'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
        'color', 'background-color', 'opacity', 'visibility',
        'flex-direction', 'justify-content', 'align-items'
      ];

      var result = {};
      for (var i = 0; i < properties.length; i++) {
        var prop = properties[i];
        result[prop] = computed.getPropertyValue(prop);
      }
      return result;
    }

    function getElementId(el) {
      var tag = el.tagName.toLowerCase();
      var identifier = tag;

      if (el.id) {
        identifier += '#' + el.id;
      } else if (el.className && typeof el.className === 'string') {
        var firstClass = el.className.trim().split(/\s+/)[0];
        if (firstClass) {
          identifier += '.' + firstClass;
        }
      }

      return identifier;
    }

    function getTextContent(el) {
      var textContent = '';
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
          textContent += el.childNodes[i].textContent;
        }
      }
      textContent = textContent.trim();

      if (!textContent && el.innerText) {
        textContent = el.innerText.trim();
      }

      if (textContent) {
        textContent = textContent.replace(/\s+/g, ' ').substring(0, 30);
        if (el.innerText && el.innerText.trim().length > 30) {
          textContent += '...';
        }
      }

      return textContent;
    }

    // ========== MODAL ==========

    function createModal() {
      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'claude-context-report-modal';
      modal.innerHTML = `
        <div class="ccr-backdrop"></div>
        <div class="ccr-dialog">
          <div class="ccr-header">
            <span class="ccr-title">Add Context Report</span>
            <button class="ccr-close" aria-label="Close">&times;</button>
          </div>
          <div class="ccr-element-info">
            <span class="ccr-element-id"></span>
            <span class="ccr-element-text"></span>
          </div>
          <textarea class="ccr-comment" placeholder="Describe what to fix or change..." rows="3"></textarea>
          <div class="ccr-actions">
            <button class="ccr-skip">Skip</button>
            <button class="ccr-save">Save Report</button>
          </div>
          <div class="ccr-feedback"></div>
        </div>
      `;

      var style = document.createElement('style');
      style.textContent = `
        #claude-context-report-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2147483647;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
        }
        #claude-context-report-modal * {
          box-sizing: border-box;
        }
        #claude-context-report-modal .ccr-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
        }
        #claude-context-report-modal .ccr-dialog {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          width: 400px;
          max-width: 90vw;
          padding: 16px;
        }
        #claude-context-report-modal .ccr-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        #claude-context-report-modal .ccr-title {
          font-weight: 600;
          font-size: 16px;
          color: #333;
        }
        #claude-context-report-modal .ccr-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #666;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        #claude-context-report-modal .ccr-close:hover {
          color: #333;
        }
        #claude-context-report-modal .ccr-element-info {
          background: #f5f5f5;
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }
        #claude-context-report-modal .ccr-element-id {
          display: block;
          font-family: 'SF Mono', Monaco, Consolas, monospace;
          font-size: 13px;
          color: #4285f4;
          font-weight: 500;
        }
        #claude-context-report-modal .ccr-element-text {
          display: block;
          font-size: 12px;
          color: #666;
          margin-top: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #claude-context-report-modal .ccr-comment {
          width: 100%;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 80px;
        }
        #claude-context-report-modal .ccr-comment:focus {
          outline: none;
          border-color: #4285f4;
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
        }
        #claude-context-report-modal .ccr-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        #claude-context-report-modal .ccr-skip {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          color: #666;
          font-size: 14px;
          cursor: pointer;
        }
        #claude-context-report-modal .ccr-skip:hover {
          background: #f5f5f5;
        }
        #claude-context-report-modal .ccr-save {
          flex: 2;
          padding: 10px 16px;
          border: none;
          border-radius: 4px;
          background: #4285f4;
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        #claude-context-report-modal .ccr-save:hover {
          background: #3367d6;
        }
        #claude-context-report-modal .ccr-save:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        #claude-context-report-modal .ccr-feedback {
          text-align: center;
          font-size: 13px;
          margin-top: 8px;
          min-height: 20px;
        }
        #claude-context-report-modal .ccr-feedback.success {
          color: #0d9488;
        }
        #claude-context-report-modal .ccr-feedback.error {
          color: #dc2626;
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(modal);

      modal.querySelector('.ccr-backdrop').addEventListener('click', hideModal);
      modal.querySelector('.ccr-close').addEventListener('click', hideModal);
      modal.querySelector('.ccr-skip').addEventListener('click', hideModal);
      modal.querySelector('.ccr-save').addEventListener('click', handleSave);

      var textarea = modal.querySelector('.ccr-comment');
      textarea.addEventListener('input', updateSaveButton);
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          handleSave();
        }
        if (e.key === 'Escape') {
          hideModal();
        }
      });

      return modal;
    }

    function showModal(elementData) {
      currentElementData = elementData;
      var m = createModal();

      var elementId = m.querySelector('.ccr-element-id');
      var elementText = m.querySelector('.ccr-element-text');

      elementId.textContent = elementData.elementId || elementData.tagName || 'element';

      if (elementData.textContent) {
        elementText.textContent = '"' + elementData.textContent + '"';
        elementText.style.display = 'block';
      } else {
        elementText.style.display = 'none';
      }

      var textarea = m.querySelector('.ccr-comment');
      textarea.value = '';

      var feedback = m.querySelector('.ccr-feedback');
      feedback.textContent = '';
      feedback.className = 'ccr-feedback';

      updateSaveButton();

      m.style.display = 'block';
      textarea.focus();
    }

    function hideModal() {
      if (modal) {
        modal.style.display = 'none';
        currentElementData = null;
      }
    }

    function updateSaveButton() {
      if (!modal) return;
      var textarea = modal.querySelector('.ccr-comment');
      var saveBtn = modal.querySelector('.ccr-save');
      saveBtn.disabled = !textarea.value.trim();
    }

    function showFeedback(message, isSuccess) {
      if (!modal) return;
      var feedback = modal.querySelector('.ccr-feedback');
      feedback.textContent = message;
      feedback.className = 'ccr-feedback ' + (isSuccess ? 'success' : 'error');
    }

    function handleSave() {
      if (!currentElementData || !modal) return;

      var textarea = modal.querySelector('.ccr-comment');
      var comment = textarea.value.trim();

      if (!comment) {
        showFeedback('Please enter a comment', false);
        return;
      }

      var report = {
        reportId: crypto.randomUUID(),
        url: currentElementData.url,
        comment: comment,
        element: {
          selector: currentElementData.selector,
          xpath: currentElementData.xpath,
          computedStyles: currentElementData.computedStyles,
          tagName: currentElementData.tagName,
          elementId: currentElementData.elementId,
          textContent: currentElementData.textContent
        }
      };

      chrome.runtime.sendMessage({
        type: 'SAVE_REPORT',
        report: report
      }, function(response) {
        if (response && response.success) {
          showFeedback('Report saved!', true);
          setTimeout(hideModal, 800);
        } else {
          showFeedback('Failed to save report', false);
        }
      });
    }

    // ========== MESSAGE HANDLING ==========

    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (message.type === 'START_PICKER') {
        startPicker();
        sendResponse({ success: true });
      }
      if (message.type === 'SHOW_MODAL') {
        showModal(message.elementData);
        sendResponse({ success: true });
      }
      return true;
    });
  }
});
