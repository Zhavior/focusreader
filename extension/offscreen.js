/**
 * Hyperfi Reader — Offscreen Voice Controller v4.0
 * Runs inside Chrome Manifest V3 offscreen document to bypass tab-level 60s mic timeouts
 * and tab-switching permission popups.
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

function startRecognition() {
  if (!SpeechRecognition) {
    console.error("SpeechRecognition not supported in this environment");
    return;
  }

  if (recognition) {
    try { recognition.abort(); } catch {}
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_STATUS', status: 'listening' }).catch(() => {});
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        const transcript = event.results[i][0].transcript.trim().toLowerCase();
        const confidence = event.results[i][0].confidence !== undefined ? event.results[i][0].confidence : 1.0;
        handleVoiceTranscript(transcript, confidence);
      }
    }
  };

  recognition.onerror = (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      console.warn("Offscreen recognition error:", event.error);
    }
  };

  recognition.onend = () => {
    isListening = false;
    // Auto-restart if we should still be listening
    setTimeout(() => {
      if (recognition) {
        try { recognition.start(); } catch {}
      }
    }, 500);
  };

  try {
    recognition.start();
  } catch (err) {
    console.error("Failed to start speech recognition:", err);
  }
}

function stopRecognition() {
  if (recognition) {
    try { recognition.abort(); } catch {}
    recognition = null;
  }
  isListening = false;
  chrome.runtime.sendMessage({ action: 'OFFSCREEN_STATUS', status: 'stopped' }).catch(() => {});
}

function handleVoiceTranscript(text, confidence = 1.0) {
  if (!text || typeof text !== 'string') return;
  const cleaned = text.trim().toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);

  // If confidence is low (< 0.6), reject noise
  if (confidence < 0.6) return;

  // Wake words and distinct multi-word command anchors
  const hasWakeWord = cleaned.includes("hyperfi") || cleaned.includes("hey hyperfi") || cleaned.includes("reader") || cleaned.includes("focus reader");
  const isShortCommand = words.length <= 3; // Prevents TTS reading a long sentence containing "pause" from self-triggering

  let command = null;

  // 1. Pause / Stop
  if (cleaned.includes("hyperfi pause") || cleaned.includes("hyperfi stop") || cleaned.includes("pause reading") || cleaned.includes("stop reading") || (isShortCommand && (cleaned === "pause" || cleaned === "stop" || cleaned === "shut up"))) {
    command = "pause";
  }
  // 2. Play / Resume
  else if (cleaned.includes("hyperfi play") || cleaned.includes("hyperfi resume") || cleaned.includes("resume reading") || cleaned.includes("start reading") || (isShortCommand && (cleaned === "play" || cleaned === "resume" || cleaned === "read"))) {
    command = "resume";
  }
  // 3. Scroll Down
  else if (cleaned.includes("hyperfi scroll down") || cleaned.includes("scroll down") || cleaned.includes("next page") || cleaned.includes("page down")) {
    command = "scroll_down";
  }
  // 4. Scroll Up
  else if (cleaned.includes("hyperfi scroll up") || cleaned.includes("scroll up") || cleaned.includes("previous page") || cleaned.includes("page up")) {
    command = "scroll_up";
  }
  // 5. Speed Up
  else if (cleaned.includes("hyperfi speed up") || cleaned.includes("speed up") || cleaned.includes("read faster") || (isShortCommand && cleaned === "faster")) {
    command = "speed_up";
  }
  // 6. Slow Down
  else if (cleaned.includes("hyperfi slow down") || cleaned.includes("slow down") || cleaned.includes("read slower") || (isShortCommand && cleaned === "slower")) {
    command = "slow_down";
  }
  // 7. Save / Favorite
  else if (cleaned.includes("hyperfi save") || cleaned.includes("save article") || cleaned.includes("save to study vault") || cleaned.includes("favorite this")) {
    command = "favorite";
  }

  if (command) {
    chrome.runtime.sendMessage({ action: 'VOICE_COMMAND_DETECTED', command, transcript: cleaned }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_VOICE_CAPTURE') {
    startRecognition();
    sendResponse({ status: 'ok' });
  } else if (message.action === 'STOP_VOICE_CAPTURE') {
    stopRecognition();
    sendResponse({ status: 'ok' });
  }
});

// Auto-start capture when document spawns
startRecognition();
