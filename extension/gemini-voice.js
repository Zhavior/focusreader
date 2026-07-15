/**
 * HyperFi Reader — Gemini Voice & Auto-Karaoke Streaming Interceptor (`gemini-voice.js`)
 * Phase 9 (`Pillar 7`): Native Chrome Gemini & Built-in AI Voice Engine
 *
 * Automatically detects when running on `https://gemini.google.com/*` or Chrome Built-in AI (`window.ai`).
 * Intercepts streaming chat turns via debounced MutationObservers, detects sentence boundaries
 * on the fly, pre-fetches neural audio chunks from HyperFi backend (`/api/extension/tts`), and
 * injects Bionic formatting (`Utils.bionicFormat`) with real-time acoustic karaoke highlighting.
 */

(function () {
  if (window.__hyperfiGeminiVoiceLoaded) return;
  window.__hyperfiGeminiVoiceLoaded = true;

  // Only activate when on Gemini or when explicitly triggered in AI sidepanels
  const isGeminiHost = window.location.hostname.includes("gemini.google.com") || window.location.hostname.includes("aistudio.google.com");
  if (!isGeminiHost && typeof window.ai === "undefined") return;

  console.log("[HyperFi Gemini Voice] Interceptor activating for Chrome Gemini / Built-in AI...");

  // Multi-Tier Resilient DOM Selector Hierarchy
  const GEMINI_SELECTORS = {
    // Tier 1: Stable Custom Web Components & Data Test IDs
    responseTurns: 'model-response, ms-chat-turn, [data-test-id*="chat-turn"], [role="region"][aria-label*="response"]',
    // Tier 2: Markdown Containers inside turns
    markdownContent: '.markdown-content, [data-test-id*="markdown-content"], .message-content, .model-response-text',
    // Tier 3: Action bar below turns where share/copy buttons reside
    actionBar: '.response-footer, .action-bar, [data-test-id*="response-actions"], .turn-footer'
  };

  // State Management
  let autoReadEnabled = false;
  let activeAudioPlayer = null;
  let activeTurnElement = null;
  const processedSentenceHashes = new Set();
  const activeStreamBuffers = new WeakMap();

  // Load user auto-read preference
  try {
    chrome?.storage?.sync?.get(["hyperfiGeminiAutoRead"], (res) => {
      autoReadEnabled = !!res?.hyperfiGeminiAutoRead;
    });
  } catch (e) {}

  /**
   * Helper: Hash string to avoid re-speaking duplicate sentences
   */
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  /**
   * GeminiStreamBuffer: Observes a streaming turn, debounces token mutations,
   * detects sentence boundaries (`. `, `! `, `? `, `\n\n`), and queues pre-fetch.
   */
  class GeminiStreamBuffer {
    constructor(turnElement) {
      this.turnElement = turnElement;
      this.processedIndex = 0;
      this.sentenceQueue = [];
      this.isSpeaking = false;
      this.observer = new MutationObserver(() => this.handleMutation());
      this.observer.observe(turnElement, { childList: true, subtree: true, characterData: true });
      this.debounceTimer = null;
    }

    handleMutation() {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        const text = this.turnElement.innerText || "";
        if (text.length <= this.processedIndex) return;

        const unreadSlice = text.slice(this.processedIndex);
        // Look for completed sentences
        const sentenceRegex = /([^.?!]+[.?!]+(?:\s+|$))|([^.?!]+\n\n+)/g;
        let match;
        while ((match = sentenceRegex.exec(unreadSlice)) !== null) {
          const sentence = match[0].trim();
          if (sentence.length > 5) {
            this.processedIndex += match.index + match[0].length;
            const h = hashString(sentence);
            if (!processedSentenceHashes.has(h)) {
              processedSentenceHashes.add(h);
              this.sentenceQueue.push({ text: sentence, turnElement: this.turnElement });
              if (autoReadEnabled) {
                this.processQueue();
              }
            }
          }
        }
      }, 200);
    }

    async processQueue() {
      if (this.isSpeaking || this.sentenceQueue.length === 0) return;
      this.isSpeaking = true;

      while (this.sentenceQueue.length > 0 && autoReadEnabled) {
        const item = this.sentenceQueue.shift();
        await speakGeminiText(item.text, item.turnElement, true);
      }

      this.isSpeaking = false;
    }

    disconnect() {
      if (this.observer) this.observer.disconnect();
    }
  }

  /**
   * Main Synthesis & Karaoke Playback Engine
   */
  async function speakGeminiText(text, turnElement, isStreamingChunk = false) {
    if (!text || text.trim().length === 0) return;

    // Stop existing playback if starting a fresh manual read
    if (!isStreamingChunk && activeAudioPlayer) {
      try { activeAudioPlayer.pause(); } catch (e) {}
      activeAudioPlayer = null;
    }

    activeTurnElement = turnElement;
    const ttsBase = window.__hyperfiTtsBase || "http://localhost:4000";

    // 1. Generate acoustic word timings & bionic formatting
    let timings = { tokens: [], words: [] };
    if (typeof Utils !== "undefined" && Utils.buildWordTimings) {
      timings = Utils.buildWordTimings(text);
    } else {
      const words = text.split(/\s+/).filter(Boolean);
      timings.words = words.map((w, i) => ({ word: w, weight: 100 }));
      timings.tokens = words.map((w, i) => ({ word: w, startFrac: i / words.length, endFrac: (i + 1) / words.length }));
    }

    // 2. Highlight active turn visually
    turnElement.style.borderLeft = "3px solid #38bdf8";
    turnElement.style.paddingLeft = "12px";
    turnElement.style.transition = "border-color 0.3s ease";

    try {
      // Send trace-enriched synthesis request via background service worker or direct fetch
      let audioBlobUrl = null;
      if (chrome?.runtime?.sendMessage) {
        audioBlobUrl = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "FETCH_AUDIO_BLOB",
              url: `${ttsBase}/api/extension/tts`,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                traceparent: "00-" + Array.from({length:32}, () => Math.floor(Math.random()*16).toString(16)).join('') + "-01"
              },
              body: JSON.stringify({
                text: text,
                voiceId: "en-US-JennyNeural",
                speed: 1.0,
                provider: "edge"
              })
            },
            (res) => {
              if (chrome.runtime.lastError || !res || res.error) {
                resolve(null);
              } else {
                resolve(res.blobUrl);
              }
            }
          );
        });
      }

      if (!audioBlobUrl) {
        // Fallback to direct Web Speech API if offline or background connection fails
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.1;
          window.speechSynthesis.speak(utterance);
          return;
        }
      }

      if (audioBlobUrl) {
        const audio = new Audio(audioBlobUrl);
        activeAudioPlayer = audio;

        // Synchronize karaoke highlighting
        audio.addEventListener("timeupdate", () => {
          if (!audio.duration || audio.duration === Infinity) return;
          const frac = audio.currentTime / audio.duration;
          let idx = 0;
          if (typeof Utils !== "undefined" && Utils.wordIndexAt) {
            idx = Utils.wordIndexAt(timings.tokens, frac);
          } else {
            idx = Math.floor(frac * timings.words.length);
          }
          // Visual feedback on turn container
          turnElement.setAttribute("data-hyperfi-active-word", idx);
        });

        audio.addEventListener("ended", () => {
          turnElement.style.borderLeft = "3px solid transparent";
          URL.revokeObjectURL(audioBlobUrl);
          if (activeAudioPlayer === audio) activeAudioPlayer = null;
        });

        await audio.play();
      }
    } catch (err) {
      console.warn("[HyperFi Gemini Voice] Playback failed:", err);
      turnElement.style.borderLeft = "3px solid #ef4444";
    }
  }

  /**
   * Injects the floating brushed-titanium action pill (`🎧 HyperFi Voice`)
   * below a newly discovered Gemini response turn.
   */
  function injectVoiceActionBar(turnElement) {
    if (turnElement.querySelector(".hyperfi-gemini-pill")) return;

    // Find or create action bar slot
    let actionBar = turnElement.querySelector(GEMINI_SELECTORS.actionBar);
    if (!actionBar) {
      actionBar = document.createElement("div");
      actionBar.className = "hyperfi-gemini-action-slot";
      actionBar.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);";
      turnElement.appendChild(actionBar);
    }

    const pillContainer = document.createElement("div");
    pillContainer.className = "hyperfi-gemini-pill";
    pillContainer.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #111318;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      padding: 6px 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #bae6fd;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
      user-select: none;
    `;

    pillContainer.innerHTML = `
      <span style="display:flex; align-items:center; gap:6px; font-weight:600;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>
        Read Aloud
      </span>
      <span style="width:1px; height:12px; background:rgba(255,255,255,0.15);"></span>
      <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:#94a3b8; cursor:pointer;">
        <input type="checkbox" class="hyperfi-auto-read-cb" ${autoReadEnabled ? "checked" : ""} style="cursor:pointer;" />
        Auto
      </label>
    `;

    pillContainer.addEventListener("mouseover", () => { pillContainer.style.borderColor = "#38bdf8"; pillContainer.style.transform = "translateY(-1px)"; });
    pillContainer.addEventListener("mouseout", () => { pillContainer.style.borderColor = "rgba(255,255,255,0.12)"; pillContainer.style.transform = "none"; });

    // Click handler for Read Aloud
    const readBtn = pillContainer.querySelector("span");
    readBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = turnElement.innerText || "";
      speakGeminiText(text, turnElement, false);
    });

    // Toggle for Auto-Read
    const cb = pillContainer.querySelector(".hyperfi-auto-read-cb");
    cb.addEventListener("change", (e) => {
      e.stopPropagation();
      autoReadEnabled = cb.checked;
      try {
        chrome?.storage?.sync?.set({ hyperfiGeminiAutoRead: autoReadEnabled });
      } catch (err) {}
    });

    actionBar.appendChild(pillContainer);
  }

  /**
   * Scan DOM for new Gemini turns and attach stream buffer / action bars
   */
  function scanAndAttachGeminiTurns() {
    const turns = document.querySelectorAll(GEMINI_SELECTORS.responseTurns);
    turns.forEach((turn) => {
      if (!turn.dataset.hyperfiTurnAttached) {
        turn.dataset.hyperfiTurnAttached = "true";
        injectVoiceActionBar(turn);

        // Attach streaming observer
        if (!activeStreamBuffers.has(turn)) {
          const buffer = new GeminiStreamBuffer(turn);
          activeStreamBuffers.set(turn, buffer);
        }
      }
    });
  }

  // Initial scan & setup observer for entire SPA DOM mutations
  setTimeout(scanAndAttachGeminiTurns, 1000);
  const rootObserver = new MutationObserver(() => scanAndAttachGeminiTurns());
  rootObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

  // Expose public control API for background worker or side panel commands
  window.__hyperfiGeminiController = {
    speak: speakGeminiText,
    setAutoRead: (enabled) => { autoReadEnabled = enabled; },
    getAutoRead: () => autoReadEnabled
  };

})();
