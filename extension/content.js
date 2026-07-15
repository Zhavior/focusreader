/**
 * Zhavior FocusReader — content script (v3)
 *
 * Turns any article into a dopamine-optimized read-along session:
 * hyperfocus vault, karaoke word highlighting, Bionic reading, procedural
 * soundscapes, voice commands, and premium TTS streamed from the FocusReader
 * backend.
 *
 * Performance principles ("easy on the Chrome"):
 *  - Nothing heavy runs until the user clicks the launcher. No AudioContext,
 *    no TTS fetches (credits are only spent on demand), no rAF loops.
 *  - Soundscapes are precomputed 8s looped AudioBuffers — zero per-sample
 *    JS during playback (the old ScriptProcessorNode burned main-thread CPU
 *    on every page, even with sound off).
 *  - DOM virtualization: only the current chunk's words exist in the DOM.
 *  - The karaoke loop runs only while audio is actually playing.
 */
(function () {
  // Script-load guard (prevents double injection); distinct from the
  // per-page launcher flag below.
  if (window.__frScriptLoaded) return;
  window.__frScriptLoaded = true;

  // Server endpoints. Defaults are local dev or CONFIG overrides; production overrides live in
  // chrome.storage.sync (set once at install/login) so the same build ships to the Web Store.
  let API_BASE = (typeof CONFIG !== "undefined" && CONFIG.APP_URL) ? CONFIG.APP_URL : "http://localhost:3001";
  let TTS_BASE  = (typeof CONFIG !== "undefined" && CONFIG.TTS_URL) ? CONFIG.TTS_URL : "http://localhost:4000";
  let DASHBOARD_URL = `${API_BASE}/dashboard`;
  try {
    chrome?.storage?.sync?.get(["zhaviorApiBase", "zhaviorTtsBase"], (res) => {
      if (res?.zhaviorApiBase) { API_BASE = res.zhaviorApiBase.replace(/\/$/, ""); DASHBOARD_URL = `${API_BASE}/dashboard`; }
      if (res?.zhaviorTtsBase) { TTS_BASE = res.zhaviorTtsBase.replace(/\/$/, ""); }
    });
    chrome?.runtime?.sendMessage({ action: "CHECK_AUTH_STATUS" }, (res) => {
      if (res && res.token) {
        window.__hyperfiAuthToken = res.token;
      }
    });
  } catch { /* storage unavailable — keep dev defaults */ }

  // One-Click Tokenless Auth: intercept token broadcasts when logged into Hyperfi dashboard
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "HYPERFI_SESSION_TOKEN" && event.data.token) {
      if (window.location.hostname.includes("hyperfi") || window.location.hostname.includes("localhost")) {
        window.__hyperfiAuthToken = event.data.token;
        chrome?.runtime?.sendMessage({ action: "SAVE_AUTH_TOKEN", token: event.data.token }, () => {});
      }
    }
  });

  // ==========================================
  // THEME (visual truth preserved from v2)
  // ==========================================
  const THEME = {
    colors: [
      { name: "White", val: "rgba(255, 255, 255, 0.8)", solid: "#ffffff" },
      { name: "Neon Purple", val: "rgba(168, 85, 247, 0.8)", solid: "#d8b4fe" },
      { name: "Cyber Blue", val: "rgba(56, 189, 248, 0.8)", solid: "#bae6fd" },
      { name: "Hot Pink", val: "rgba(236, 72, 153, 0.8)", solid: "#fbcfe8" }
    ],
    speeds: [1.0, 1.25, 1.5, 2.0],
    soundscapes: ["Sound: Off", "Brown Noise", "Pink Noise", "White Noise", "Light Rain", "Heavy Rain"],
    voices: [
      { name: "Voice: Female (US)", id: "Samantha", elevenId: "EXAVITQu4vr4xnSDxMaL" },
      { name: "Voice: Male (US Standard)", id: "Reed (English (US))", elevenId: "ErXwobaYiN019PkySvjV" },
      { name: "Voice: Male (Warm & Deep)", id: "Evan", elevenId: "nPczCjzI2XWHr1WexmYd" },
      { name: "Voice: Male (UK British)", id: "Daniel", elevenId: "ONwK4e9ZLuTAKqWW03F9" },
      { name: "Voice: Female (Warm & Calm)", id: "Flo (English (US))", elevenId: "21m00Tcm4TlvDq8ikWAM" }
    ]
  };

  const ICONS = {
    voice: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
    lightning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    adhd: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
    pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    home: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    waves: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-9 5 18 5-18 2 9h2"/></svg>`,
    headphones: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`
  };

  // ==========================================
  // UTILITIES
  // ==========================================
  /** An error the queue must halt on (no retries, no further chunks). */
  function terminalError(message, action) {
    const err = new Error(message);
    err.terminal = true;
    if (action) err.action = action;
    return err;
  }

  const Utils = {
    bionicFormat(word) {
      if (word.length <= 1) return `<b>${word}</b>`;
      const mid = Math.ceil(word.length / 2);
      return `<b>${word.slice(0, mid)}</b>${word.slice(mid)}`;
    },

    buildWordTimings(text) {
      const words = text.split(/\s+/).filter(Boolean);
      const raw = words.map(word => {
        // Acoustic duration model: base word duration + non-linear syllabic length + punctuation prosody
        let weight = Math.pow(word.length, 0.78) * 45 + 120;
        if (/[.?!]["']?$/.test(word)) weight += 420;      // full stop sentence pause
        else if (/[,;:]["']?$/.test(word)) weight += 220; // clause comma/colon pause
        else if (/[—–"-]$/.test(word)) weight += 120;     // dash/quote pause
        return { word, weight };
      });
      const totalWeight = raw.reduce((sum, t) => sum + t.weight, 0);
      if (totalWeight === 0) return { tokens: [], words: [] };

      const tokens = [];
      let cumulative = 0;
      let charOffset = 0;
      for (const t of raw) {
        const startFrac = cumulative / totalWeight;
        cumulative += t.weight;
        const charStart = text.indexOf(t.word, charOffset);
        const charEnd = charStart !== -1 ? charStart + t.word.length : charOffset + t.word.length;
        if (charStart !== -1) charOffset = charEnd;
        tokens.push({
          word: t.word,
          startFrac,
          endFrac: cumulative / totalWeight,
          charStart: charStart !== -1 ? charStart : 0,
          charEnd: charEnd
        });
      }
      return { tokens, words };
    },

    wordIndexAt(tokens, frac) {
      if (tokens.length === 0) return -1;
      if (frac <= 0) return 0;
      if (frac >= 1) return tokens.length - 1;
      let lo = 0, hi = tokens.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (tokens[mid].endFrac <= frac) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },

    escapeAttr(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    getToken() {
      if (Utils._cachedToken !== undefined) return Promise.resolve(Utils._cachedToken);
      return new Promise((resolve) => {
        if (!chrome?.storage?.sync) return resolve('');
        chrome.storage.sync.get(['zhaviorToken'], res => {
          if (res.zhaviorToken) {
            Utils._cachedToken = res.zhaviorToken;
            return resolve(Utils._cachedToken);
          }
          if (window.__hyperfiAuthToken) {
            Utils._cachedToken = window.__hyperfiAuthToken;
            return resolve(Utils._cachedToken);
          }
          if (chrome.storage.local) {
            chrome.storage.local.get(['hyperfi_auth_token', 'access_token'], loc => {
              Utils._cachedToken = loc.hyperfi_auth_token || loc.access_token || '';
              resolve(Utils._cachedToken);
            });
          } else {
            resolve('');
          }
        });
      });
    },

    tracedFetch(url, options = {}) {
      const headers = new Headers(options.headers || {});
      const genHex = (len) => Array.from({length: len}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const traceId = genHex(32);
      const spanId = genHex(16);
      headers.set('traceparent', `00-${traceId}-${spanId}-01`);
      headers.set('x-trace-id', traceId);
      return fetch(url, { ...options, headers });
    },

    /** Persisted user preferences (speed/color/bionic/noise/voice survive sessions). */
    loadPrefs() {
      return new Promise((resolve) => {
        const defaults = { speedIdx: 0, colorIdx: 0, noiseIdx: 0, isBionic: true, voiceIdx: 0, noiseVolume: 0.35 };
        if (!chrome?.storage?.sync) return resolve(defaults);
        chrome.storage.sync.get(['zhaviorPrefs'], res =>
          resolve({ ...defaults, ...(res.zhaviorPrefs || {}) })
        );
      });
    },

    savePrefs(prefs) {
      try { chrome?.storage?.sync?.set({ zhaviorPrefs: prefs }); } catch { /* best-effort */ }
    },

    /** Automatically log/save article to Reading Library when opened */
    recordVisit(item) {
      if (!chrome?.storage?.local) return;
      chrome.storage.local.get(['zhaviorLibrary'], res => {
        let list = res.zhaviorLibrary || [];
        const existingIdx = list.findIndex(i => i.url === item.url);
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...item, isFavorite: list[existingIdx].isFavorite || item.isFavorite };
        } else {
          list.unshift(item);
        }
        chrome.storage.local.set({ zhaviorLibrary: list });
      });
      Utils.syncToCloudVault(item);
    },

    toggleFavorite(url, cb) {
      if (!chrome?.storage?.local) return;
      chrome.storage.local.get(['zhaviorLibrary'], res => {
        let list = res.zhaviorLibrary || [];
        const existingIdx = list.findIndex(i => i.url === url);
        let newStatus = true;
        if (existingIdx >= 0) {
          list[existingIdx].isFavorite = !list[existingIdx].isFavorite;
          newStatus = list[existingIdx].isFavorite;
        } else {
          list.unshift({
            id: url,
            title: document.title || window.location.hostname,
            url: window.location.href,
            domain: window.location.hostname,
            date: new Date().toISOString(),
            isFavorite: true
          });
        }
        chrome.storage.local.set({ zhaviorLibrary: list }, () => { if (cb) cb(newStatus); });
        if (newStatus) {
          Utils.syncToCloudVault({ url, title: document.title || window.location.hostname });
        }
      });
    },

    async syncToCloudVault(item) {
      try {
        const token = await Utils.getToken();
        if (!token) return;
        const textToSave = item.text || ArticleExtractor?.extract()?.map(p => p.text).join('\n\n') || document.body?.innerText?.slice(0, 100000) || "";
        if (!textToSave) return;
        await Utils.tracedFetch(`${API_BASE}/api/extension-vault`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: item.title || document.title || window.location.hostname,
            url: item.url || window.location.href,
            text: textToSave,
            speed: 1.5,
            background: 'brown_noise'
          })
        });
      } catch { /* best-effort cloud sync */ }
    }
  };

  // ==========================================
  // ARTICLE EXTRACTION
  // ==========================================
  class ArticleExtractor {
    static extract() {
      const articleNode = document.querySelector('article, [role="main"], main, .article-body, .story-body, .article-content, .post-content, #article-body, .entry-content') || document.body;
      const rawParagraphs = articleNode.querySelectorAll('p, h1, h2, h3, h4, blockquote, li, .paragraph, .article-paragraph');
      const validParagraphs = [];

      const badSelector = 'nav, footer, aside, figure, .sidebar, .comments, .ad, .promo, .social, [id*="nav"], [id*="footer"], [class*="ad-"], [class*="sponsored"], [class*="newsletter"], .cookie-banner, [class*="cookie"], [class*="share"], [class*="meta"], .author-bio, .related-posts, [aria-label="breadcrumb"], [role="navigation"], [role="complementary"], [role="contentinfo"], .ad-container, #banner';
      const ctaKeywords = ['in your inbox', 'join medium', 'get updates', 'subscribe to', 'sign up', 'read more from', 'written by', 'newsletter', 'accept cookies', 'privacy policy'];

      const isNoiseParagraph = (text) => {
        const trimmed = text.trim();
        if (!trimmed) return true;
        if (trimmed.length < 15 && !/[a-zA-Z]{3,}/.test(trimmed)) return true;
        if (/^(share on|click to copy|copy link|subscribe|read next|more from|photo by|image credit|continue reading|ad[v]?\.|advertisement|sponsored by|read time:|min read|page \d+ of \d+|table of contents)/i.test(trimmed)) {
          return true;
        }
        if (/^[•▪■♦★☆►●*—–|+~=•\.\s,;:_/\\-]+$/.test(trimmed)) return true;
        return false;
      };

      rawParagraphs.forEach(p => {
        const text = (p.innerText || p.textContent || '').trim();
        if (isNoiseParagraph(text)) return;
        if (p.closest(badSelector)) return;

        let linkTextLen = 0;
        p.querySelectorAll('a').forEach(a => { linkTextLen += (a.innerText || "").length; });
        const linkDensity = linkTextLen / Math.max(text.length, 1);

        const lowerText = text.toLowerCase();
        if (ctaKeywords.some(keyword => lowerText.includes(keyword))) return;
        if (linkDensity < 0.55) {
          validParagraphs.push(text);
        }
      });

      // Multi-Stage Fallback 1: If standard paragraph tags yield < 2 blocks (e.g. Notion, Google Docs, complex SPAs)
      if (validParagraphs.length < 2) {
        const divContainers = articleNode.querySelectorAll('div, section, span, li');
        divContainers.forEach(div => {
          if (div.closest(badSelector)) return;
          const text = (div.innerText || div.textContent || '').trim();
          if (isNoiseParagraph(text) || text.length > 3000) return;

          // Check if this container has block-level children that already extracted text to avoid duplicate overlapping chunks
          const hasInnerParagraphs = div.querySelector('p, h1, h2, h3, blockquote');
          if (hasInnerParagraphs && validParagraphs.length > 0) return;

          let linkTextLen = 0;
          div.querySelectorAll('a').forEach(a => { linkTextLen += (a.innerText || "").length; });
          const linkDensity = linkTextLen / Math.max(text.length, 1);
          if (linkDensity < 0.45 && !validParagraphs.includes(text)) {
            // Split clean double-newline blocks inside divs
            text.split(/\n{2,}/).forEach(subBlock => {
              const cleanSub = subBlock.trim();
              if (!isNoiseParagraph(cleanSub) && cleanSub.length >= 40 && !validParagraphs.includes(cleanSub)) {
                validParagraphs.push(cleanSub);
              }
            });
          }
        });
      }

      // Multi-Stage Fallback 2: Ultimate fallback to innerText splitting if still empty
      if (validParagraphs.length === 0) {
        const rawBodyText = (document.body?.innerText || '').trim();
        if (rawBodyText) {
          rawBodyText.split(/\n{2,}/).forEach(block => {
            const cleanBlock = block.trim();
            if (!isNoiseParagraph(cleanBlock) && cleanBlock.length >= 30) validParagraphs.push(cleanBlock);
          });
        }
      }

      if (validParagraphs.length === 0) return { paragraphs: [], chunks: [], chunkWordRanges: [] };

      // Build fluid sentences across all paragraphs, keeping exact word counts
      const chunks = [];
      const chunkWordRanges = [];
      let currentWords = [];
      let currentStartWordIdx = 0;
      let runningWordIdx = 0;

      validParagraphs.forEach(pText => {
        pText.split(/(?<=[.?!])\s+/).forEach(sentence => {
          const trimmed = sentence.trim();
          if (!trimmed || isNoiseParagraph(trimmed)) return;
          const sWords = trimmed.split(/\s+/).filter(Boolean);
          if (sWords.length === 0) return;

          const maxLimit = chunks.length === 0 ? 160 : 360;
          const maxWords = chunks.length === 0 ? 25 : 55;

          // If adding this sentence exceeds chunk limit and we already have words buffered, flush
          if ((currentWords.join(' ').length + trimmed.length + 1 > maxLimit || currentWords.length + sWords.length > maxWords) && currentWords.length > 0) {
            const chunkStr = currentWords.join(' ');
            if (chunkStr.length > 2 && /[a-zA-Z0-9]/.test(chunkStr)) {
              chunks.push(chunkStr);
              chunkWordRanges.push({ startIdx: currentStartWordIdx, endIdx: runningWordIdx - 1 });
            }
            currentWords = [];
            currentStartWordIdx = runningWordIdx;
          }

          // If a single sentence itself exceeds maxWords (e.g. long title without periods), sub-split it by words
          if (sWords.length > maxWords && currentWords.length === 0) {
            for (let i = 0; i < sWords.length; i += maxWords) {
              const sub = sWords.slice(i, i + maxWords);
              const chunkStr = sub.join(' ');
              if (chunkStr.length > 2 && /[a-zA-Z0-9]/.test(chunkStr)) {
                chunks.push(chunkStr);
                chunkWordRanges.push({ startIdx: runningWordIdx + i, endIdx: runningWordIdx + i + sub.length - 1 });
              }
            }
            runningWordIdx += sWords.length;
            currentStartWordIdx = runningWordIdx;
          } else {
            currentWords.push(...sWords);
            runningWordIdx += sWords.length;
          }
        });
      });

      if (currentWords.length > 0) {
        const chunkStr = currentWords.join(' ');
        if (chunkStr.length > 2 && /[a-zA-Z0-9]/.test(chunkStr)) {
          chunks.push(chunkStr);
          chunkWordRanges.push({ startIdx: currentStartWordIdx, endIdx: runningWordIdx - 1 });
        }
      }

      return { paragraphs: validParagraphs, chunks, chunkWordRanges };
    }
  }

  // ==========================================
  // SOUNDSCAPES — precomputed looped buffers
  // ==========================================
  // Each mode renders 8 seconds of noise ONCE into an AudioBuffer, then loops
  // it via AudioBufferSourceNode. After generation there is no per-sample JS
  // at all. Buffers are cached per mode.
  // ==========================================
  // SOUNDSCAPES — High-Quality Stereo Binaural DSP Buffers
  // ==========================================
  // Each mode renders 8 seconds of binaural stereo (2-channel) noise ONCE into
  // an AudioBuffer, then loops seamlessly via AudioBufferSourceNode with 200ms cosine crossfade.
  const Soundscapes = {
    LOOP_SECONDS: 600, // 10 FULL MINUTES (600 seconds) so 7-9 minute reading sessions NEVER loop once!
    cache: new Map(),

    getBuffer(ctx, mode) {
      if (this.cache.has(mode)) return this.cache.get(mode);
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * this.LOOP_SECONDS;
      const fadeLen = Math.floor(sampleRate * 2.0); // 2-second ultra-smooth equal-power crossfade seam if they read > 10 minutes
      const totalSamples = length + fadeLen;
      const buffer = ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      const rawL = new Float32Array(totalSamples);
      const rawR = new Float32Array(totalSamples);

      // Decorrelated DSP filters for immersive 3D spatial separation
      let lastL = 0, lastR = 0;
      const bL = [0, 0, 0, 0, 0, 0, 0];
      const bR = [0, 0, 0, 0, 0, 0, 0];
      let rainTimerL = 0, rainTimerR = 0;

      for (let i = 0; i < totalSamples; i++) {
        const whiteL = Math.random() * 2 - 1;
        const whiteR = Math.random() * 2 - 1;
        let sL = 0, sR = 0;

        if (mode === 1) { // Deep Brown Cabin Noise (ADHD Calming Shield)
          sL = (lastL + (0.015 * whiteL)) / 1.015;
          sR = (lastR + (0.015 * whiteR)) / 1.015;
          lastL = sL;
          lastR = sR;
          sL *= 3.8;
          sR *= 3.8;
        } else if (mode === 2 || mode === 4 || mode === 5) { // Binaural Pink / Rain / Heavy Atmosphere
          bL[0] = 0.99886 * bL[0] + whiteL * 0.0555179;
          bL[1] = 0.99332 * bL[1] + whiteL * 0.0750759;
          bL[2] = 0.96900 * bL[2] + whiteL * 0.1538520;
          bL[3] = 0.86650 * bL[3] + whiteL * 0.3104856;
          bL[4] = 0.55000 * bL[4] + whiteL * 0.5329522;
          bL[5] = -0.7616 * bL[5] - whiteL * 0.0168980;
          sL = (bL[0] + bL[1] + bL[2] + bL[3] + bL[4] + bL[5] + bL[6] + whiteL * 0.5362) * 0.12;
          bL[6] = whiteL * 0.115926;

          bR[0] = 0.99886 * bR[0] + whiteR * 0.0555179;
          bR[1] = 0.99332 * bR[1] + whiteR * 0.0750759;
          bR[2] = 0.96900 * bR[2] + whiteR * 0.1538520;
          bR[3] = 0.86650 * bR[3] + whiteR * 0.3104856;
          bR[4] = 0.55000 * bR[4] + whiteR * 0.5329522;
          bR[5] = -0.7616 * bR[5] - whiteR * 0.0168980;
          sR = (bR[0] + bR[1] + bR[2] + bR[3] + bR[4] + bR[5] + bR[6] + whiteR * 0.5362) * 0.12;
          bR[6] = whiteR * 0.115926;

          if (mode >= 4) { // Stereo Organic Rain & Atmospheric Rumble
            let rainL = sL * 0.45;
            let rainR = sR * 0.45;
            rainTimerL--;
            rainTimerR--;
            const dropThresh = mode === 4 ? 3200 : 1100;
            if (Math.random() * dropThresh < 1) rainTimerL = mode === 4 ? 120 : 280;
            if (Math.random() * dropThresh < 1) rainTimerR = mode === 4 ? 120 : 280;

            if (rainTimerL > 0) rainL += whiteL * 0.18 * (rainTimerL / 280);
            if (rainTimerR > 0) rainR += whiteR * 0.18 * (rainTimerR / 280);

            sL = rainL * (mode === 5 ? 1.75 : 1.25);
            sR = rainR * (mode === 5 ? 1.75 : 1.25);
          }
        } else if (mode === 3) { // Softened Silky White Air
          sL = whiteL * 0.14;
          sR = whiteR * 0.14;
        }
        rawL[i] = sL;
        rawR[i] = sR;
      }

      // True equal-power overlap blending at loop boundary without any volume drop
      for (let i = 0; i < length; i++) {
        if (i < fadeLen) {
          const frac = i / fadeLen;
          const gainStart = Math.sin(frac * 0.5 * Math.PI);
          const gainEnd = Math.cos(frac * 0.5 * Math.PI);
          left[i] = rawL[i] * gainStart + rawL[length + i] * gainEnd;
          right[i] = rawR[i] * gainStart + rawR[length + i] * gainEnd;
        } else {
          left[i] = rawL[i];
          right[i] = rawR[i];
        }
      }

      this.cache.set(mode, buffer);
      return buffer;
    }
  };

  // ==========================================
  // AUDIO ENGINE — lazy, on-demand
  // ==========================================
  class AudioEngine {
    constructor() {
      this.ctx = null;          // created on first use, not at page load
      this.noiseSource = null;
      this.noiseGain = null;
      this.noiseMode = 0;
      this.noiseVolume = 0.35;
      this.voiceIdx = 0;
      this.voiceAudio = null;
      this.playbackRate = 1.0;
      this.abortController = null;
    }

    ensureCtx() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    setVoiceIdx(idx) {
      this.voiceIdx = idx;
    }

    setNoiseVolume(val) {
      this.noiseVolume = val;
      if (this.noiseGain && this.ctx) {
        this.noiseGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.04);
      }
    }

    setNoiseMode(mode, volume = 0.35) {
      this.noiseMode = mode;
      this.noiseVolume = volume;
      if (this.noiseSource) {
        try { this.noiseSource.stop(); } catch {}
        try { this.noiseSource.disconnect(); } catch {}
        this.noiseSource = null;
      }
      if (mode === 0) return;

      const ctx = this.ensureCtx();
      if (!this.noiseGain) {
        this.noiseGain = ctx.createGain();
        this.noiseGain.connect(ctx.destination);
      }
      this.noiseGain.gain.setValueAtTime(this.noiseVolume, ctx.currentTime);

      this.noiseSource = ctx.createBufferSource();
      this.noiseSource.buffer = Soundscapes.getBuffer(ctx, mode);
      this.noiseSource.loop = true;
      this.noiseSource.connect(this.noiseGain);
      this.noiseSource.start();
    }

    async fetchTTS(text, retries = 3) {
      if (!text || typeof text !== 'string' || !text.trim()) {
        throw terminalError("Text chunk is empty or invalid.");
      }
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      try {
        const token = await Utils.getToken();
        if (!token) throw terminalError("Not logged in — open the extension popup to add your token.");

        const activeVoice = THEME.voices[this.voiceIdx || 0];
        const res = await Utils.tracedFetch(`${TTS_BASE}/api/extension/tts`, {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            text: text.trim(),
            voice: activeVoice ? activeVoice.id : undefined,
            voiceId: activeVoice ? activeVoice.elevenId : undefined
          })
        });

        if (res.status === 429 && retries > 0) {
          await new Promise(r => setTimeout(r, 4000));
          return this.fetchTTS(text, retries - 1);
        }
        if (res.status === 401) {
          throw terminalError("Token invalid or revoked — generate a new one in Dashboard → Tools.");
        }
        if (res.status === 402) {
          throw terminalError("Out of credits — open Billing to upgrade.", "billing");
        }
        if (!res.ok) {
          let errMsg = `API Error ${res.status}`;
          try { const data = await res.json(); if (data.message) errMsg = data.message; } catch { /* not json */ }
          throw new Error(`TTS Error (${res.status}): ${errMsg}`);
        }

        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch (err) {
        if (err.name === 'AbortError' || signal.aborted) {
          throw err; // Silently terminate on intentional user abort without retries
        }
        if (retries > 0 && !err.terminal) {
          const isNetworkErr = err instanceof TypeError;
          const waitTime = isNetworkErr ? 2500 : (4 - retries) * 1000;
          await new Promise(r => setTimeout(r, waitTime));
          return this.fetchTTS(text, retries - 1);
        }
        if (err.terminal) {
          throw err;
        }
        console.warn("[FocusReader] Cloud engine unavailable or timed out — falling back to local neural WebSpeech engine:", err.message);
        return "webspeech_fallback";
      }
    }

    playWebSpeech(text, tokens, onBoundary, onEnd) {
      this.stopVoice();
      if (!window.speechSynthesis) {
        if (onEnd) onEnd();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.playbackRate;
      const voices = window.speechSynthesis.getVoices();
      const activeName = THEME.voices[this.voiceIdx || 0]?.name || "";
      const isMale = activeName.toLowerCase().includes("male") || activeName.includes("Alex") || activeName.includes("Daniel") || activeName.includes("Evan") || activeName.includes("Standard");
      const matchedVoice = voices.find(v => v.lang.startsWith("en") && (isMale ? v.name.toLowerCase().includes("male") || v.name.includes("Alex") || v.name.includes("Daniel") : v.name.toLowerCase().includes("female") || v.name.includes("Samantha"))) || voices.find(v => v.lang.startsWith("en")) || voices[0];
      if (matchedVoice) utterance.voice = matchedVoice;

      utterance.onboundary = (event) => {
        if (event.name === 'word' && onBoundary) {
          onBoundary(event.charIndex);
        }
      };
      utterance.onend = () => {
        if (this.webSpeechLivenessTimer) clearInterval(this.webSpeechLivenessTimer);
        this.webSpeechLivenessTimer = null;
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        if (this.webSpeechLivenessTimer) clearInterval(this.webSpeechLivenessTimer);
        this.webSpeechLivenessTimer = null;
        if (onEnd) onEnd();
      };
      this.activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);

      // Industry-standard anti-freeze workaround for Chrome/macOS 15-second speech synthesis timeout bug
      if (this.webSpeechLivenessTimer) clearInterval(this.webSpeechLivenessTimer);
      this.webSpeechLivenessTimer = setInterval(() => {
        if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else if (window.speechSynthesis && !window.speechSynthesis.speaking) {
          if (this.webSpeechLivenessTimer) clearInterval(this.webSpeechLivenessTimer);
          this.webSpeechLivenessTimer = null;
        }
      }, 10000);
    }

    playVoice(url, onPlay, onEnd) {
      this.stopVoice();
      this.voiceAudio = new Audio(url);
      this.voiceAudio.defaultPlaybackRate = this.playbackRate;
      this.voiceAudio.playbackRate = this.playbackRate;

      const triggerPlayCallback = () => {
        if (this.voiceAudio) {
          this.voiceAudio.defaultPlaybackRate = this.playbackRate;
          this.voiceAudio.playbackRate = this.playbackRate;
        }
        if (onPlay) onPlay();
      };

      this.voiceAudio.onplay = triggerPlayCallback;
      this.voiceAudio.onended = () => {
        URL.revokeObjectURL(url);
        if (onEnd) onEnd();
      };
      this.voiceAudio.play().catch(e => {
        console.error("[FocusReader] playback error:", e);
        if (this.voiceAudio && this.voiceAudio.readyState >= 2) {
          triggerPlayCallback();
        } else if (this.voiceAudio) {
          this.voiceAudio.oncanplaythrough = () => {
            this.voiceAudio.defaultPlaybackRate = this.playbackRate;
            this.voiceAudio.playbackRate = this.playbackRate;
            this.voiceAudio.play().catch(() => {});
            triggerPlayCallback();
          };
        }
      });
    }

    stopVoice() {
      if (this.webSpeechLivenessTimer) {
        clearInterval(this.webSpeechLivenessTimer);
        this.webSpeechLivenessTimer = null;
      }
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      if (this.voiceAudio) {
        this.voiceAudio.pause();
        this.voiceAudio.src = '';
        this.voiceAudio = null;
      }
      if (window.speechSynthesis && this.activeUtterance) {
        window.speechSynthesis.cancel();
        this.activeUtterance = null;
      }
    }

    pause() {
      if (this.voiceAudio) this.voiceAudio.pause();
      if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.pause();
      if (this.ctx?.state === 'running') this.ctx.suspend();
    }

    resume() {
      if (this.voiceAudio) {
        this.voiceAudio.defaultPlaybackRate = this.playbackRate;
        this.voiceAudio.playbackRate = this.playbackRate;
        this.voiceAudio.play();
      }
      if (window.speechSynthesis && window.speechSynthesis.paused) window.speechSynthesis.resume();
      if (this.ctx?.state === 'suspended') this.ctx.resume();
    }

    setSpeed(speed) {
      this.playbackRate = speed;
      if (this.voiceAudio) {
        this.voiceAudio.defaultPlaybackRate = speed;
        this.voiceAudio.playbackRate = speed;
      }
      if (this.activeUtterance && window.speechSynthesis) {
        this.activeUtterance.rate = speed;
      }
    }

    destroy() {
      this.stopVoice();
      if (this.noiseSource) { this.noiseSource.stop(); this.noiseSource.disconnect(); }
      if (this.noiseGain) this.noiseGain.disconnect();
      if (this.ctx) this.ctx.close();
      this.ctx = null;
    }
  }

  // ==========================================
  // SHADOW UI — vault, controls, toasts
  // ==========================================
  class ShadowUI {
    constructor() {
      this.host = document.createElement('div');
      this.host.id = "focusreader-host";
      Object.assign(this.host.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        pointerEvents: 'none'
      });

      this.shadow = this.host.attachShadow({ mode: 'open' });
      document.body.appendChild(this.host);

      this.buildStyles();
      this.buildVault();
      this.buildControls();
      this.buildToasts();
    }

    buildStyles() {
      const style = document.createElement('style');
      style.textContent = `
        :host {
          --bg-color: #050505;
          --text-color: #ffffff;
          --inactive-text: #525252;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .vault {
          position: absolute;
          inset: 0;
          background-color: var(--bg-color);
          color: var(--text-color);
          overflow-y: auto;
          padding: 10vh 10vw;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .vault.visible { opacity: 1; }

        .content-container {
          max-width: 800px;
          width: 100%;
          font-size: 2rem;
          line-height: 1.8;
          letter-spacing: -0.02em;
          padding-bottom: 30vh;
        }

        .word {
          display: inline-block;
          color: var(--inactive-text);
          transition: color 0.12s ease, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), text-shadow 0.12s ease, background-color 0.12s ease;
          padding: 1px 4px;
          margin: 0 1px;
          border-radius: 6px;
          cursor: pointer;
        }
        .word:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }
        .word.active {
          transform: scale(1.08);
          color: var(--active-color, #fff);
          text-shadow: 0 0 18px var(--active-shadow, rgba(255,255,255,0.6));
          background-color: var(--active-bg, rgba(255,255,255,0.14));
        }

        .controls-wrapper {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: auto;
          padding-bottom: 20px;
        }

        .controls {
          display: flex;
          gap: 12px;
          background-color: rgba(20, 20, 20, 0.65);
          backdrop-filter: blur(16px);
          padding: 12px 20px;
          border-radius: 40px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          transform: scale(0.85) translateY(10px);
          opacity: 0.4;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .controls-wrapper:hover .controls {
          transform: scale(1) translateY(0);
          opacity: 1;
          background-color: rgba(25, 25, 25, 0.9);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
        }

        button {
          padding: 10px 18px;
          background: transparent;
          color: #fff;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          line-height: 1;
          height: 42px;
        }
        button:hover { background: rgba(255,255,255,0.1); }
        button:active { transform: scale(0.95); }

        button.primary { background: rgba(255,255,255,0.95); color: #000; }
        button.primary:hover { transform: scale(1.05); background: #fff; }

        .noise-vol-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          height: 42px;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .noise-vol-container.hidden {
          display: none;
        }
        .noise-vol-label {
          font-size: 12px;
          font-weight: 700;
          color: #a1a1aa;
          min-width: 36px;
          text-align: right;
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 76px;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          outline: none;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #d8b4fe;
          border: 2px solid #ffffff;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.8);
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.25);
          background: #c084fc;
        }

        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }

        .toast {
          background: rgba(99, 102, 241, 0.9);
          color: white;
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          animation: slideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .toast.error { background: rgba(239, 68, 68, 0.9); }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      this.shadow.appendChild(style);
    }

    buildVault() {
      this.vault = document.createElement('div');
      this.vault.className = "vault";
      this.content = document.createElement('div');
      this.content.className = "content-container";
      this.vault.appendChild(this.content);
      this.shadow.appendChild(this.vault);
    }

    buildControls() {
      this.controlsWrapper = document.createElement('div');
      this.controlsWrapper.className = "controls-wrapper";
      this.controls = document.createElement('div');
      this.controls.className = "controls";
      this.controlsWrapper.appendChild(this.controls);
      this.shadow.appendChild(this.controlsWrapper);
    }

    buildToasts() {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = "toast-container";
      this.shadow.appendChild(this.toastContainer);
    }

    showToast(msg, isError = false, onClick = null) {
      // Dedupe: identical message already visible → don't stack another.
      if (this._lastToastMsg === msg && this._lastToastAt > Date.now() - 4000) return;
      this._lastToastMsg = msg;
      this._lastToastAt = Date.now();

      const toast = document.createElement('div');
      toast.className = "toast" + (isError ? " error" : "");
      toast.innerText = onClick ? `${msg} (click)` : msg;
      if (onClick) {
        toast.style.pointerEvents = 'auto';
        toast.style.cursor = 'pointer';
        toast.onclick = onClick;
      }
      this.toastContainer.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
    }

    addControlButton(iconHtml, text, isPrimary = false) {
      const btn = document.createElement('button');
      if (isPrimary) btn.className = 'primary';
      btn.innerHTML = `${iconHtml} ${text}`;
      this.controls.appendChild(btn);
      return btn;
    }

    show() {
      requestAnimationFrame(() => this.vault.classList.add('visible'));
      document.body.style.overflow = 'hidden';
    }

    destroy() {
      this.vault.classList.remove('visible');
      setTimeout(() => {
        this.host.remove();
        document.body.style.overflow = '';
      }, 500);
    }
  }

  // ==========================================
  // CONTROLLER — session orchestration
  // ==========================================
  class FocusReaderController {
    constructor(articleData, prefs, onExit, prefetchPromise = null) {
      this.articleData = articleData;
      this.chunks = articleData.chunks;
      this.paragraphs = articleData.paragraphs;
      this.chunkWordRanges = articleData.chunkWordRanges;
      this.chunkTokens = this.chunks.map(c => Utils.buildWordTimings(c));
      this.onExit = onExit;
      this.prefetchPromise = prefetchPromise;

      this.ui = new ShadowUI();
      this.audio = new AudioEngine();

      this.currentChunkIdx = 0;
      this.expectedNextChunkIdx = 0;
      this.isPaused = false;
      this.isQueueActive = true;
      this.audioQueue = [];
      this.isPlaying = false;
      this.nextFetchIdx = 0;
      this.inflightFetches = 0;
      this.queueGeneration = 0;

      this.config = { ...prefs };

      this.allSpans = [];
      this.activeWordSpan = null;
      this.animationFrameId = null;
      this._lastScroll = 0;

      this.setupUI();
      this.applyPrefs();
      this.ui.show();
      this.bindKeys();
      this.fillBuffer();

      // Automatically log/save visit to Reading Library
      Utils.recordVisit({
        id: window.location.href,
        title: document.title || window.location.hostname,
        url: window.location.href,
        domain: window.location.hostname,
        wordCount: this.paragraphs ? this.paragraphs.join(' ').split(/\s+/).length : 0,
        date: new Date().toISOString(),
        isFavorite: false
      });
    }

    setupUI() {
      this.renderAllParagraphs();

      this.btnSpeed = this.ui.addControlButton(ICONS.lightning, `${THEME.speeds[this.config.speedIdx].toFixed(2)}x`);
      this.btnSpeed.onclick = () => {
        this.config.speedIdx = (this.config.speedIdx + 1) % THEME.speeds.length;
        this.applySpeed();
        this.persist();
      };

      this.btnVoice = this.ui.addControlButton(ICONS.voice, THEME.voices[this.config.voiceIdx || 0].name);
      this.btnVoice.onclick = () => {
        this.config.voiceIdx = ((this.config.voiceIdx || 0) + 1) % THEME.voices.length;
        this.applyVoice();
        this.persist();

        if (this.isPlaying || this.audioQueue.length > 0) {
          this.queueGeneration = (this.queueGeneration || 0) + 1;
          this.audioQueue.forEach(i => URL.revokeObjectURL(i.url));
          this.audioQueue = [];
          this.audio.stopVoice();
          this.stopKaraoke();
          this.isPlaying = false;
          this.nextFetchIdx = this.currentChunkIdx;
          this.inflightFetches = 0;
          this.fillBuffer();
        }
      };

      this.btnColor = this.ui.addControlButton(ICONS.palette, "Color");
      this.btnColor.onclick = () => {
        this.config.colorIdx = (this.config.colorIdx + 1) % THEME.colors.length;
        this.applyColor();
        this.persist();
      };

      this.btnBionic = this.ui.addControlButton(ICONS.adhd, "ADHD Mode");
      this.btnBionic.onclick = () => {
        this.config.isBionic = !this.config.isBionic;
        this.applyBionic();
        this.persist();
      };

      this.btnNoise = this.ui.addControlButton(ICONS.waves, THEME.soundscapes[this.config.noiseIdx]);
      this.btnNoise.onclick = () => {
        this.config.noiseIdx = (this.config.noiseIdx + 1) % THEME.soundscapes.length;
        this.applyNoise();
        this.persist();
      };

      // Customizable Soundscape Volume Slider
      this.noiseVolContainer = document.createElement('div');
      this.noiseVolContainer.className = 'noise-vol-container';
      this.noiseVolContainer.title = "Background Sound Volume";

      const volIcon = document.createElement('span');
      volIcon.className = 'noise-vol-icon';
      volIcon.innerHTML = '🔊';
      volIcon.style.fontSize = '14px';

      this.noiseVolSlider = document.createElement('input');
      this.noiseVolSlider.type = 'range';
      this.noiseVolSlider.min = '0';
      this.noiseVolSlider.max = '1';
      this.noiseVolSlider.step = '0.02';
      this.noiseVolSlider.value = (this.config.noiseVolume !== undefined ? this.config.noiseVolume : 0.35).toString();
      this.noiseVolSlider.title = "Background Sound Volume";

      const volLabel = document.createElement('span');
      volLabel.className = 'noise-vol-label';
      volLabel.textContent = `${Math.round(this.noiseVolSlider.value * 100)}%`;

      this.noiseVolSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        this.config.noiseVolume = val;
        volLabel.textContent = `${Math.round(val * 100)}%`;
        this.audio.setNoiseVolume(val);
      };
      this.noiseVolSlider.onchange = () => {
        this.persist();
      };

      this.noiseVolContainer.appendChild(volIcon);
      this.noiseVolContainer.appendChild(this.noiseVolSlider);
      this.noiseVolContainer.appendChild(volLabel);
      this.ui.controls.appendChild(this.noiseVolContainer);

      this.btnPause = this.ui.addControlButton(ICONS.pause, "Pause");
      this.btnPause.onclick = () => (this.isPaused ? this.resumeSystem() : this.pauseSystem());

      this.btnFav = this.ui.addControlButton("☆", "Favorite");
      this.btnFav.onclick = () => {
        Utils.toggleFavorite(window.location.href, (isFav) => {
          this.btnFav.innerHTML = isFav ? `★ <span style="color: #fbbf24;">Favorited</span>` : `☆ <span>Favorite</span>`;
          this.ui.showToast(isFav ? "Saved to your reading favorites!" : "Removed from favorites");
        });
      };

      const btnLib = this.ui.addControlButton("📚", "Library");
      btnLib.onclick = () => window.open(chrome.runtime.getURL('library.html'), '_blank');

      const btnDash = this.ui.addControlButton(ICONS.home, "Dashboard");
      btnDash.onclick = () => window.open(DASHBOARD_URL, '_blank');

      const btnExit = this.ui.addControlButton(ICONS.x, "Exit", true);
      btnExit.onclick = () => this.destroy();
    }

    // Preference application (also used to restore persisted prefs on boot)
    applyPrefs() {
      this.applySpeed();
      this.applyVoice();
      this.applyColor();
      this.applyBionic();
      this.applyNoise();
    }
    applySpeed() {
      const spd = THEME.speeds[this.config.speedIdx];
      this.btnSpeed.innerHTML = `${ICONS.lightning} <span>${spd.toFixed(2)}x</span>`;
      this.audio.setSpeed(spd);
    }
    applyVoice() {
      const voice = THEME.voices[this.config.voiceIdx || 0];
      this.btnVoice.innerHTML = `${ICONS.voice} <span>${voice.name}</span>`;
      this.audio.setVoiceIdx(this.config.voiceIdx || 0);
    }
    applyColor() {
      const color = THEME.colors[this.config.colorIdx || 0];
      if (this.btnColor) this.btnColor.style.color = color.solid;
      if (this.ui?.content) {
        this.ui.content.style.setProperty('--active-color', color.solid);
        this.ui.content.style.setProperty('--active-shadow', color.val);
      }
      if (this.activeWordSpan) {
        this.activeWordSpan.style.color = color.solid;
        this.activeWordSpan.style.textShadow = `0 0 18px ${color.val}`;
      }
    }
    applyBionic() {
      this.btnBionic.style.color = this.config.isBionic ? '#bae6fd' : '#fff';
      this.refreshSpanContent();
    }
    applyNoise() {
      this.btnNoise.innerHTML = `${ICONS.waves} <span>${THEME.soundscapes[this.config.noiseIdx]}</span>`;
      const mode = this.config.noiseIdx;
      const volume = this.config.noiseVolume !== undefined ? this.config.noiseVolume : 0.35;
      if (mode === 0) {
        this.noiseVolContainer.classList.add('hidden');
      } else {
        this.noiseVolContainer.classList.remove('hidden');
        this.noiseVolSlider.value = volume.toString();
        const label = this.noiseVolContainer.querySelector('.noise-vol-label');
        if (label) label.textContent = `${Math.round(volume * 100)}%`;
      }
      this.audio.setNoiseMode(mode, volume);
    }
    persist() {
      Utils.savePrefs(this.config);
    }

    bindKeys() {
      this.keyHandler = (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          this.isPaused ? this.resumeSystem() : this.pauseSystem();
        } else if (e.code === 'Escape') {
          this.destroy();
        }
      };
      document.addEventListener('keydown', this.keyHandler, true);
    }

    // --- DOM virtualization: high-performance batch innerHTML + Event Delegation ------
    renderAllParagraphs() {
      this.ui.content.textContent = '';
      this.allSpans = [];
      this.activeWordSpan = null;

      let globalWordCounter = 0;
      const isBionic = this.config.isBionic;
      const htmlChunks = [];
      const pCount = this.paragraphs.length;

      for (let pIdx = 0; pIdx < pCount; pIdx++) {
        const words = this.paragraphs[pIdx].split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;

        let pHtml = '<p style="margin-bottom: 2.2rem; line-height: 1.85;">';
        const wCount = words.length;
        for (let wIdx = 0; wIdx < wCount; wIdx++) {
          const word = words[wIdx];
          const bionic = Utils.bionicFormat(word);
          const idx = globalWordCounter++;
          const displayHtml = isBionic ? bionic : word;
          pHtml += `<span class="word" data-idx="${idx}" data-raw="${Utils.escapeAttr(word)}" data-bionic="${Utils.escapeAttr(bionic)}">${displayHtml}</span> `;
        }
        pHtml += '</p>';
        htmlChunks.push(pHtml);
      }

      // Batch inserting via innerHTML is up to 30x faster than thousands of createElement & appendChild calls!
      this.ui.content.innerHTML = htmlChunks.join('');
      this.allSpans = Array.from(this.ui.content.getElementsByClassName('word'));

      // Apply current active color variables immediately
      const color = THEME.colors[this.config.colorIdx || 0];
      this.ui.content.style.setProperty('--active-color', color.solid);
      this.ui.content.style.setProperty('--active-shadow', color.val);

      // Event delegation: ONE single click listener for all words instead of thousands of closures
      if (!this._hasWordClickListener) {
        this._hasWordClickListener = true;
        this.ui.content.addEventListener('click', (e) => {
          const span = e.target.closest('.word');
          if (span && span.dataset.idx !== undefined) {
            this.seekToGlobalWord(parseInt(span.dataset.idx, 10));
          }
        });
      }
    }

    refreshSpanContent() {
      const isBionic = this.config.isBionic;
      const len = this.allSpans.length;
      for (let i = 0; i < len; i++) {
        const span = this.allSpans[i];
        if (!span) continue;
        const val = isBionic ? span.dataset.bionic : span.dataset.raw;
        if (span.innerHTML !== val) span.innerHTML = val;
      }
    }

    /** Click-to-seek within any word across the entire document. */
    seekToGlobalWord(globalIdx) {
      let targetChunkIdx = 0;
      for (let i = 0; i < this.chunkWordRanges.length; i++) {
        if (globalIdx >= this.chunkWordRanges[i].startIdx && globalIdx <= this.chunkWordRanges[i].endIdx) {
          targetChunkIdx = i;
          break;
        }
      }

      const range = this.chunkWordRanges[targetChunkIdx];
      const localWordIdx = globalIdx - range.startIdx;
      const tokens = this.chunkTokens[targetChunkIdx]?.tokens || [];
      const audio = this.audio.voiceAudio;

      if (targetChunkIdx === this.currentChunkIdx && audio && audio.duration && tokens[localWordIdx]) {
        audio.currentTime = tokens[localWordIdx].startFrac * audio.duration;
        this.highlightWordAt(tokens, audio.currentTime / audio.duration);
        if (this.isPaused) this.resumeSystem();
        return;
      }

      // Seeking into a different chunk
      this.queueGeneration = (this.queueGeneration || 0) + 1;
      this.audioQueue.forEach(i => URL.revokeObjectURL(i.url));
      this.audioQueue = [];
      this.audio.stopVoice();
      this.stopKaraoke();
      this.isPlaying = false;
      this.currentChunkIdx = targetChunkIdx;
      this.expectedNextChunkIdx = targetChunkIdx;
      this.nextFetchIdx = targetChunkIdx;
      this.inflightFetches = 0;

      // Pre-highlight the sought word while audio buffers
      if (this.activeWordSpan) {
        this.activeWordSpan.classList.remove('active');
        this.activeWordSpan.style.color = '';
        this.activeWordSpan.style.textShadow = '';
      }
      const targetSpan = this.allSpans[globalIdx];
      if (targetSpan) {
        targetSpan.classList.add('active');
        this.activeWordSpan = targetSpan;
      }

      this.fillBuffer();
      if (this.isPaused) this.resumeSystem();
    }

    // --- Audio queue: keep up to 6 chunks buffered ahead (`120+ seconds`) with Monotonic Generation race immunity ---
    fillBuffer() {
      while (
        this.isQueueActive &&
        this.audioQueue.length + this.inflightFetches < 6 &&
        this.nextFetchIdx < this.chunks.length &&
        this.inflightFetches < 3
      ) {
        const fetchIdx = this.nextFetchIdx++;
        this.inflightFetches++;
        const currentGen = this.queueGeneration;

        const fetchReq = (fetchIdx === 0 && this.prefetchPromise)
          ? this.prefetchPromise.then(url => { this.prefetchPromise = null; return url || this.audio.fetchTTS(this.chunks[fetchIdx]); })
          : this.audio.fetchTTS(this.chunks[fetchIdx]);

        fetchReq
          .then(url => {
            if (currentGen !== this.queueGeneration || !this.isQueueActive) {
              if (url && url !== "webspeech_fallback") URL.revokeObjectURL(url);
              return;
            }
            this.audioQueue.push({ url, chunkIdx: fetchIdx });
            this.audioQueue.sort((a, b) => a.chunkIdx - b.chunkIdx);
            if (!this.isPlaying && !this.isPaused && this.audioQueue.length > 0 && this.audioQueue[0].chunkIdx === this.expectedNextChunkIdx) {
              this.playNextInQueue();
            }
          })
          .catch(err => {
            if (currentGen !== this.queueGeneration || err.name === 'AbortError') return;
            console.error("[FocusReader] TTS fetch failed:", err);
            if (err.terminal) {
              this.isQueueActive = false;
              const action = err.action === "billing"
                ? () => window.open(`${API_BASE}/dashboard/billing`, '_blank')
                : () => window.open(`${DASHBOARD_URL}/tools`, '_blank');
              this.ui.showToast(err.message, true, action);
            } else {
              this.ui.showToast(`TTS Notice: ${err.message || "Chunk delayed — using offline engine"}`, false);
              this.audioQueue.push({ url: "webspeech_fallback", chunkIdx: fetchIdx });
              this.audioQueue.sort((a, b) => a.chunkIdx - b.chunkIdx);
              if (!this.isPlaying && !this.isPaused && this.audioQueue.length > 0 && this.audioQueue[0].chunkIdx === this.expectedNextChunkIdx) {
                this.playNextInQueue();
              }
            }
          })
          .finally(() => {
            if (currentGen !== this.queueGeneration) return;
            this.inflightFetches--;
            if (this.isQueueActive) this.fillBuffer();
          });
      }
    }

    playNextInQueue() {
      if (!this.isQueueActive || this.isPaused) {
        this.isPlaying = false;
        return;
      }
      if (this.audioQueue.length === 0 || this.audioQueue[0].chunkIdx !== this.expectedNextChunkIdx) {
        this.isPlaying = false;
        if (this.expectedNextChunkIdx < this.chunks.length) {
          this.fillBuffer();
        }
        return;
      }

      this.isPlaying = true;
      const { url, chunkIdx } = this.audioQueue.shift();
      this.currentChunkIdx = chunkIdx;
      this.expectedNextChunkIdx = chunkIdx + 1;

      const currentTokens = this.chunkTokens[chunkIdx]?.tokens || [];
      if (url === "webspeech_fallback") {
        this.ui.showToast("Server offline — using instant Offline Neural Voice Engine", false);
        const chunkText = this.chunks[chunkIdx];
        this.audio.playWebSpeech(
          chunkText,
          currentTokens,
          (charIdx) => {
            const matchedToken = currentTokens.find(t => charIdx >= t.charStart && charIdx < t.charEnd) || currentTokens[0];
            if (matchedToken) {
              const globalIdx = this.chunkWordRanges[chunkIdx].startIdx + currentTokens.indexOf(matchedToken);
              const targetSpan = this.allSpans[globalIdx];
              if (targetSpan && targetSpan !== this.activeWordSpan) {
                if (this.activeWordSpan) {
                  this.activeWordSpan.classList.remove('active');
                  this.activeWordSpan.style.color = '';
                  this.activeWordSpan.style.textShadow = '';
                }
                targetSpan.classList.add('active');
                this.activeWordSpan = targetSpan;
                this.applyColor();
              }
            }
          },
          () => {
            this.stopKaraoke();
            this.playNextInQueue();
          }
        );
        this.fillBuffer();
        return;
      }

      this.audio.playVoice(
        url,
        () => {
          this.startKaraoke(currentTokens);
          this.fillBuffer();
        },
        () => {
          this.stopKaraoke();
          this.playNextInQueue();
        }
      );
    }

    // Karaoke loop runs ONLY while audio is playing.
    startKaraoke(tokens) {
      this.stopKaraoke();
      const step = () => {
        const audio = this.audio.voiceAudio;
        if (!audio || audio.paused || audio.ended) {
          this.animationFrameId = null;
          return;
        }
        let duration = audio.duration;
        if (!duration || isNaN(duration) || !isFinite(duration) || duration <= 0) {
          // Estimate duration dynamically based on word count (~380ms per word at 1.0x speed)
          duration = Math.max(1.5, ((tokens?.length || 10) * 0.38) / (this.playbackRate || 1));
        }
        const frac = Math.min(1, Math.max(0, audio.currentTime / duration));
        if (tokens && tokens.length > 0) {
          this.highlightWordAt(tokens, frac);
        }
        this.animationFrameId = requestAnimationFrame(step);
      };
      this.animationFrameId = requestAnimationFrame(step);
    }

    stopKaraoke() {
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    highlightWordAt(tokens, frac) {
      const localIdx = Utils.wordIndexAt(tokens, frac);
      const range = this.chunkWordRanges[this.currentChunkIdx];
      if (!range) return;

      const globalIdx = Math.min(this.allSpans.length - 1, range.startIdx + localIdx);
      const nextSpan = this.allSpans[globalIdx];
      if (!nextSpan || nextSpan === this.activeWordSpan) return;

      if (this.activeWordSpan) {
        this.activeWordSpan.classList.remove('active');
      }

      nextSpan.classList.add('active');

      if (!this._lastScroll || Date.now() - this._lastScroll > 450) {
        const rect = nextSpan.getBoundingClientRect();
        const vh = window.innerHeight;
        if (rect.top > vh * 0.58 || rect.top < vh * 0.28) {
          this._lastScroll = Date.now();
          const targetTop = this.ui.vault.scrollTop + rect.top - (vh * 0.38);
          this.ui.vault.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        }
      }
      this.activeWordSpan = nextSpan;
    }

    pauseSystem() {
      this.isPaused = true;
      this.audio.pause();
      this.stopKaraoke();
      this.btnPause.innerHTML = `${ICONS.play} Play`;
    }

    resumeSystem() {
      this.isPaused = false;
      this.audio.resume();
      this.btnPause.innerHTML = `${ICONS.pause} Pause`;
      if (this.audio.voiceAudio) {
        this.startKaraoke(this.chunkTokens[this.currentChunkIdx].tokens);
      } else if (this.audioQueue.length > 0) {
        this.playNextInQueue();
      } else {
        this.fillBuffer();
      }
    }

    destroy() {
      this.isQueueActive = false;
      this.stopKaraoke();
      document.removeEventListener('keydown', this.keyHandler, true);
      this.audioQueue.forEach(i => URL.revokeObjectURL(i.url));
      this.audioQueue = [];
      this.audio.destroy();
      this.ui.destroy();
      if (this.onExit) this.onExit();
    }
  }

  // ==========================================
  // LAUNCHER — the always-available entry pill
  // ==========================================
  // A small, cheap floating pill on article pages. Nothing else exists until
  // it's clicked: no AudioContext, no fetches, no credits spent.
  class Launcher {
    constructor(articleData = null) {
      this.articleData = articleData;
      this.chunks = articleData ? (articleData.chunks || []) : [];
      this.controller = null;

      this.host = document.createElement('div');
      this.host.id = 'focusreader-launcher';
      Object.assign(this.host.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '2147483646'
      });

      const shadow = this.host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fr-enter {
          from { transform: translateY(60px) scale(0.85); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 0.18; }
        }
        button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 36px;
          background: #111318;
          color: #a1a1aa;
          font: 600 13px system-ui, -apple-system, sans-serif;
          letter-spacing: 0.01em;
          cursor: pointer;
          opacity: 0.18;
          filter: grayscale(80%);
          animation: fr-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        button:hover {
          opacity: 1;
          filter: grayscale(0%);
          color: #ffffff;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-color: rgba(216, 180, 254, 0.45);
          transform: translateY(-3px) scale(1.06);
          box-shadow: 0 8px 30px rgba(0,0,0,0.45), 0 0 24px rgba(168, 85, 247, 0.65);
        }
        button:active { transform: scale(0.96); }
        button svg { width: 16px; height: 16px; flex-shrink: 0; }
      `;
      shadow.appendChild(style);

      this.btn = document.createElement('button');
      const mins = Math.max(1, Math.round((document.body?.innerText || "").length / 5000));
      this.btn.innerHTML = `${ICONS.headphones} <span>Listen &middot; ~${mins}m</span>`;
      this.btn.title = "Hyperfi Reader (Hover to expand & listen aloud)";
      this.btn.onclick = () => this.start();
      this.btn.onmouseenter = () => this.prewarm();
      shadow.appendChild(this.btn);

      document.body.appendChild(this.host);
    }

    async prewarm() {
      if (this.prewarmed || !this.btn) return;
      this.prewarmed = true;
      try {
        const token = await Utils.getToken();
        if (!token) return;
        if (!this.articleData || !this.articleData.chunks || this.articleData.chunks.length === 0) {
          this.articleData = ArticleExtractor.extract();
          this.chunks = this.articleData.chunks;
        }
        if (this.chunks && this.chunks.length > 0 && !this.prefetchPromise) {
          const firstChunk = this.chunks[0];
          const prefs = await Utils.loadPrefs();
          const activeVoice = THEME.voices[prefs.voiceIdx || 0];
          this.prefetchPromise = Utils.tracedFetch(`${TTS_BASE}/api/extension/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              text: firstChunk,
              voice: activeVoice ? activeVoice.id : undefined,
              voiceId: activeVoice ? activeVoice.elevenId : undefined
            })
          }).then(res => res.ok ? res.blob() : null).then(b => b ? URL.createObjectURL(b) : null).catch(() => null);
        }
      } catch (e) { /* ignore prewarm errors */ }
    }

    async start() {
      if (this.controller) return;
      const token = await Utils.getToken();
      if (!token) {
        alert("Action Required: Please click the Hyperfi extension icon in your browser toolbar (top right) and paste your Access Token to log in!");
        window.open(`${DASHBOARD_URL}/tools`, '_blank');
        return;
      }
      let data = this.articleData;
      if (!data || !data.chunks || data.chunks.length === 0) {
        data = ArticleExtractor.extract();
      }
      if (!data || !data.chunks || data.chunks.length === 0) {
        alert("No speakable article paragraphs found on this webpage.");
        return;
      }
      this.articleData = data;
      this.chunks = data.chunks;
      this.host.style.display = 'none';

      if (!this.prefetchPromise) {
        const firstChunk = data.chunks[0];
        const prefs = await Utils.loadPrefs();
        const activeVoice = THEME.voices[prefs.voiceIdx || 0];
        this.prefetchPromise = Utils.tracedFetch(`${TTS_BASE}/api/extension/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            text: firstChunk,
            voice: activeVoice ? activeVoice.id : undefined,
            voiceId: activeVoice ? activeVoice.elevenId : undefined
          })
        }).then(res => res.ok ? res.blob() : null).then(b => b ? URL.createObjectURL(b) : null).catch(() => null);
      }

      const prefs = await Utils.loadPrefs();
      this.controller = new FocusReaderController(data, prefs, () => {
        this.controller = null;
        this.host.style.display = '';
      }, this.prefetchPromise);
      this.prefetchPromise = null;
    }

    destroy() {
      if (this.controller) this.controller.destroy();
      this.host.remove();
    }
  }

  // ==========================================
  // INITIALIZATION (SPA-AWARE)
  // ==========================================
  let launcher = null;

  function syncBridgeToken() {
    const bridge = document.getElementById("fr-auth-bridge");
    if (!bridge) return;
    const token = bridge.getAttribute("data-token");
    const apiBase = bridge.getAttribute("data-api-base");
    const ttsBase = bridge.getAttribute("data-tts-base");
    if (!token) return;

    if (chrome?.storage?.sync) {
      const updates = {};
      chrome.storage.sync.get(['zhaviorToken', 'zhaviorApiBase', 'zhaviorTtsBase'], res => {
        if (res.zhaviorToken !== token) {
          updates.zhaviorToken = token;
          Utils._cachedToken = token;
        }
        if (apiBase && res.zhaviorApiBase !== apiBase) {
          updates.zhaviorApiBase = apiBase;
          API_BASE = apiBase;
          DASHBOARD_URL = `${apiBase}/dashboard`;
        }
        if (ttsBase && res.zhaviorTtsBase !== ttsBase) {
          updates.zhaviorTtsBase = ttsBase;
          TTS_BASE = ttsBase;
        }

        if (Object.keys(updates).length > 0) {
          chrome.storage.sync.set(updates, () => {
            console.log("[FocusReader] Automatically synced authentication token & environment config from website!");
          });
        }
      });
    }
  }

  function attemptInit() {
    syncBridgeToken();
    if (launcher || !document.body) return;
    launcher = new Launcher(null);
  }

  attemptInit();
  setTimeout(attemptInit, 800);

  // SPA navigations: reset launcher only if URL changes
  let lastHref = location.href;
  setInterval(() => {
    syncBridgeToken();
    if (location.href === lastHref) return;
    lastHref = location.href;
    if (launcher && !launcher.controller) {
      launcher.destroy();
      launcher = null;
    }
    if (!launcher) {
      setTimeout(attemptInit, 300);
    }
  }, 1000);

})();
