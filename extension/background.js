chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    console.error("Cannot run extension on browser internal pages.");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (err) {
    console.error("Failed to inject FocusReader:", err);
  }
});
