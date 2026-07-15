/**
 * Hyperfi Reader — Background Service Worker (Manifest V3)
 * Orchestrates offscreen document for continuous voice command capture, relays commands to active tabs,
 * and performs automatic tokenless cookie authentication with Hyperfi web dashboard.
 */

try {
  importScripts('config.js');
} catch (e) {
  console.warn("Could not load config.js in service worker:", e.message);
}

let creatingOffscreen = false;

async function setupOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_CAPTURE', 'USER_MEDIA'],
    justification: 'Continuous hands-free voice commands and wake-word recognition for ADHD Bionic Reader'
  });
  await creatingOffscreen;
  creatingOffscreen = false;
}

async function closeOffscreenDocument() {
  if (!(await chrome.offscreen.hasDocument())) return;
  await chrome.offscreen.closeDocument();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SAVE_AUTH_TOKEN') {
    const token = message.token;
    if (token && typeof token === 'string') {
      chrome.storage.local.set({ hyperfi_auth_token: token, access_token: token, logged_in: true }, () => {
        chrome.storage.sync.set({ zhaviorToken: token }, () => {
          sendResponse({ status: 'saved', logged_in: true, token });
        });
      });
    } else {
      sendResponse({ status: 'error', error: 'invalid_token' });
    }
    return true;
  } else if (message.action === 'CHECK_AUTH_STATUS') {
    const appUrl = (typeof CONFIG !== 'undefined' && CONFIG.APP_URL) ? CONFIG.APP_URL : 'http://localhost:3001';
    const cookieName = (typeof CONFIG !== 'undefined' && CONFIG.COOKIE_NAME) ? CONFIG.COOKIE_NAME : '__session';

    if (typeof chrome.cookies !== 'undefined' && chrome.cookies.get) {
      chrome.cookies.get({ url: appUrl, name: cookieName }, (cookie) => {
        if (cookie && cookie.value) {
          chrome.storage.local.set({ hyperfi_auth_token: cookie.value, logged_in: true }, () => {
            sendResponse({ status: 'authenticated', logged_in: true, token: cookie.value });
          });
        } else {
          // Check secondary session name (hyperfi_session) right before local storage fallback
          chrome.cookies.get({ url: appUrl, name: 'hyperfi_session' }, (secCookie) => {
            if (secCookie && secCookie.value) {
              chrome.storage.local.set({ hyperfi_auth_token: secCookie.value, logged_in: true }, () => {
                sendResponse({ status: 'authenticated', logged_in: true, token: secCookie.value });
              });
            } else {
              checkFallbackStorage(sendResponse);
            }
          });
        }
      });
    } else {
      checkFallbackStorage(sendResponse);
    }
    return true; // Keep channel open for async sendResponse
  } else if (message.action === 'ENABLE_VOICE_CONTROLLER') {
    setupOffscreenDocument()
      .then(() => sendResponse({ status: 'enabled' }))
      .catch((err) => sendResponse({ status: 'error', error: err.message }));
    return true; // Keep channel open for async response
  } else if (message.action === 'DISABLE_VOICE_CONTROLLER') {
    closeOffscreenDocument()
      .then(() => sendResponse({ status: 'disabled' }))
      .catch((err) => sendResponse({ status: 'error', error: err.message }));
    return true;
  } else if (message.action === 'VOICE_COMMAND_DETECTED') {
    // Relay command from offscreen.js to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'VOICE_COMMAND',
          command: message.command,
          transcript: message.transcript
        }).catch(() => {/* tab might not have content script ready */});
      }
    });
  } else if (message.action === 'FETCH_AUDIO_BLOB') {
    fetch(message.url, {
      method: message.method || 'POST',
      headers: message.headers || {},
      body: message.body
    })
      .then(async (res) => {
        if (!res.ok) {
          sendResponse({ error: 'TTS_FETCH_FAILED', status: res.status });
          return;
        }
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ blobUrl: reader.result });
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });
    return true; // Keep channel open for async fetch
  }
});

function checkFallbackStorage(sendResponse) {
  chrome.storage.local.get(['hyperfi_auth_token', 'access_token', 'user_token'], (data) => {
    const token = data.hyperfi_auth_token || data.access_token || data.user_token;
    if (token) {
      sendResponse({ status: 'authenticated', logged_in: true, token });
    } else {
      sendResponse({ status: 'unauthenticated', logged_in: false });
    }
  });
}
