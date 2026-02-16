/**
 * Element Capture Module
 *
 * Provides code generation for extracting element data via
 * chrome.devtools.inspectedWindow.eval(). The returned code
 * executes in the inspected page context with access to $0.
 */

/**
 * Returns an eval-ready code string that extracts comprehensive
 * element data from the currently selected element ($0).
 *
 * @returns {string} JavaScript code string to execute via eval
 *
 * Returns object structure:
 * {
 *   selector: string,      // Full CSS selector path from html > body
 *   xpath: string,         // Absolute XPath from /html[1]/body[1]
 *   computedStyles: {},    // Filtered subset of computed styles
 *   url: string            // location.href
 * }
 *
 * Returns null if no element is selected ($0 is null/undefined).
 */
export function getElementCaptureCode() {
  return `
    (function() {
      if (!$0) return null;

      // CSS Selector generation
      // Full path from html > body down to element
      // Includes tag name, ID with #, all classes, nth-of-type for disambiguation
      function getCssSelector(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

        var path = [];
        var current = el;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          var selector = current.tagName.toLowerCase();

          // Add ID if present
          if (current.id) {
            selector += '#' + current.id;
          }

          // Add all classes
          if (current.className && typeof current.className === 'string') {
            var classes = current.className.trim().split(/\\s+/).filter(function(c) { return c; });
            if (classes.length > 0) {
              selector += '.' + classes.join('.');
            }
          }

          // Add nth-of-type if siblings of same tag exist
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

      // XPath generation
      // Absolute path starting from /html[1]/body[1]
      // Every node includes positional index [n]
      // Includes @id and @class attributes at each level where present
      function getXPath(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

        var path = [];
        var current = el;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          var tagName = current.tagName.toLowerCase();
          var segment = tagName;

          // Count position among same-tag siblings (1-based)
          var index = 1;
          var sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) {
              index++;
            }
            sibling = sibling.previousElementSibling;
          }

          // Build attributes string
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

          segment = tagName + attrs + '[' + index + ']';
          path.unshift(segment);
          current = current.parentElement;
        }

        return '/' + path.join('/');
      }

      // Computed styles extraction
      // Filtered subset of most useful properties for AI context
      function getComputedStyles(el) {
        var computed = window.getComputedStyle(el);

        // Properties subset per RESEARCH.md
        var properties = [
          // Layout
          'display', 'position', 'float', 'clear',
          'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
          // Box model
          'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
          'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
          // Typography
          'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
          // Visual
          'color', 'background-color', 'opacity', 'visibility',
          // Flexbox
          'flex-direction', 'justify-content', 'align-items'
        ];

        var result = {};
        for (var i = 0; i < properties.length; i++) {
          var prop = properties[i];
          result[prop] = computed.getPropertyValue(prop);
        }

        return result;
      }

      // Get short element identifier (tag + id/class + text snippet)
      function getElementIdentifier(el) {
        var tag = el.tagName.toLowerCase();
        var identifier = tag;

        // Add ID if present
        if (el.id) {
          identifier += '#' + el.id;
        } else if (el.className && typeof el.className === 'string') {
          // Add first class if no ID
          var firstClass = el.className.trim().split(/\\s+/)[0];
          if (firstClass) {
            identifier += '.' + firstClass;
          }
        }

        // Get text content (direct text, not nested)
        var textContent = '';
        for (var i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
            textContent += el.childNodes[i].textContent;
          }
        }
        textContent = textContent.trim();

        // If no direct text, try innerText but limit depth
        if (!textContent && el.innerText) {
          textContent = el.innerText.trim();
        }

        // Truncate and clean up text
        if (textContent) {
          textContent = textContent.replace(/\\s+/g, ' ').substring(0, 30);
          if (el.innerText && el.innerText.trim().length > 30) {
            textContent += '...';
          }
        }

        return {
          tag: tag,
          identifier: identifier,
          textContent: textContent
        };
      }

      var elemId = getElementIdentifier($0);

      return {
        selector: getCssSelector($0),
        xpath: getXPath($0),
        computedStyles: getComputedStyles($0),
        url: location.href,
        tagName: elemId.tag,
        elementId: elemId.identifier,
        textContent: elemId.textContent
      };
    })()
  `;
}
