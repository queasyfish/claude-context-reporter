// DevTools page entry point
// Creates the sidebar pane in the Elements panel

chrome.devtools.panels.elements.createSidebarPane(
  "Context Report",
  function(sidebar) {
    sidebar.setPage("sidebar.html");
  }
);
