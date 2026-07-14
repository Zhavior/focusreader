(function () {
  if (window.hasInjectedFocusReader) return;
  window.hasInjectedFocusReader = true;

  // ==========================================
  // CONFIGURATION & THEME
  // ==========================================
  const THEME = {
    colors: [
      { name: "White", val: "rgba(255, 255, 255, 0.8)", solid: "#ffffff" },
      { name: "Neon Purple", val: "rgba(168, 85, 247, 0.8)", solid: "#d8b4fe" },
      { name: "Cyber Blue", val: "rgba(56, 189, 248, 0.8)", solid: "#bae6fd" },
      { name: "Hot Pink", val: "rgba(236, 72, 153, 0.8)", solid: "#fbcfe8" }
    ],
    speeds: [1.0, 1.25, 1.5, 2.0],
    soundscapes: ["Sound: Off", "Brown Noise", "Pink Noise", "White Noise", "Light Rain", "Heavy Rain"]
  };

  const ICONS = {
    lightning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    palette: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    brain: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
    sparkles: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
    pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    home: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    waves: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-9 5 18 5-18 2 9h2"/></svg>`
  };

  // ==========================================
  // UTILITIES
  // ==========================================
  const Utils = {
    bionicFormat(word) {
      if (word.length <= 1) return `<b>${word}</b>`;
      const mid = Math.ceil(word.length / 2);
      return `<b>${word.slice(0, mid)}</b>${word.slice(mid)}`;
    },
    buildWordTimings(text) {
      const words = text.split(/\\s+/).filter(Boolean);
      const raw = words.map(word => {
        let weight = word.length + 1;
        if (/[.,!?:;]["']?$/.test(word)) weight += 8;
        return { word, weight };
      });
      const totalWeight = raw.reduce((sum, t) => sum + t.weight, 0);
      if (totalWeight === 0) return { tokens: [], words: [] };
      
      const tokens = [];
      let cumulative = 0;
      for (const t of raw) {
        const startFrac = cumulative / totalWeight;
        cumulative += t.weight;
        tokens.push({
          word: t.word,
          startFrac,
          endFrac: cumulative / totalWeight
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
    getToken() {
      return new Promise((resolve, reject) => {
        if (!chrome || !chrome.storage || !chrome.storage.sync) {
          alert("Zhavior FocusReader was updated. Please refresh the page to continue using it!");
          reject(new Error("Extension context invalidated"));
          return;
        }
        chrome.storage.sync.get(['zhaviorToken'], res => resolve(res.zhaviorToken || ''));
      });
    }
  };

  // ==========================================
  // MODULES
  // ==========================================

  class ArticleExtractor {
    static extract() {
      const articleNode = document.querySelector('article, [role="main"], main') || document.body;
      const rawParagraphs = articleNode.querySelectorAll('p, h2, h3, li');
      const validParagraphs = [];
      
      const badSelector = 'nav, footer, aside, .sidebar, .comments, .ad, .promo, [id*="nav"], [id*="footer"], [class*="ad-"], [class*="sponsored"]';
      const ctaKeywords = ['in your inbox', 'join medium', 'get updates', 'subscribe to', 'sign up', 'read more from', 'written by', 'newsletter'];
      
      rawParagraphs.forEach(p => {
        if (p.closest(badSelector)) return;
        const text = p.innerText || p.textContent;
        const links = p.querySelectorAll('a');
        let linkTextLen = 0;
        links.forEach(a => { linkTextLen += (a.innerText || "").length; });
        const linkDensity = linkTextLen / Math.max(text.length, 1);
        
        const lowerText = text.toLowerCase();
        if (ctaKeywords.some(keyword => lowerText.includes(keyword))) return;
        
        if (text.trim().length > 30 && linkDensity < 0.3) {
          validParagraphs.push(text.trim());
        }
      });

      // Chunking algorithm
      const chunks = [];
      let currentChunk = [];
      let currentLength = 0;
      
      validParagraphs.forEach(p => {
        const sentences = p.split(/(?<=[.?!])\\s+/);
        sentences.forEach(s => {
          const trimmed = s.trim();
          if (trimmed.length > 10) {
            if (currentLength + trimmed.length > 400 && currentChunk.length > 0) {
              chunks.push(currentChunk.join(' '));
              currentChunk = [];
              currentLength = 0;
            }
            currentChunk.push(trimmed);
            currentLength += trimmed.length;
          }
        });
      });
      if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));
      
      return chunks;
    }
  }

  class AudioEngine {
    constructor() {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.bufferSize = 4096;
      this.noiseProcessor = null;
      this.noiseGain = null;
      this.noiseState = {
        mode: 0, // 0: Off, 1: Brown, 2: Pink, 3: White, 4: Light Rain, 5: Heavy Rain
        lastOut: 0,
        b: [0,0,0,0,0,0,0],
        rainDropTimer: 0
      };
      
      this.voiceAudio = null;
      this.playbackRate = 1.0;
      
      this.initSoundscapes();
    }

    initSoundscapes() {
      this.noiseProcessor = this.audioCtx.createScriptProcessor(this.bufferSize, 1, 1);
      this.noiseProcessor.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        const st = this.noiseState;
        if (st.mode === 0) {
          for (let i = 0; i < this.bufferSize; i++) output[i] = 0;
          return;
        }
        
        for (let i = 0; i < this.bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          let sample = 0;
          
          if (st.mode === 1) { // Brown
            sample = (st.lastOut + (0.02 * white)) / 1.02;
            st.lastOut = sample;
            sample *= 3.5;
          } 
          else if (st.mode === 2 || st.mode === 4 || st.mode === 5) { // Pink-based
            st.b[0] = 0.99886 * st.b[0] + white * 0.0555179;
            st.b[1] = 0.99332 * st.b[1] + white * 0.0750759;
            st.b[2] = 0.96900 * st.b[2] + white * 0.1538520;
            st.b[3] = 0.86650 * st.b[3] + white * 0.3104856;
            st.b[4] = 0.55000 * st.b[4] + white * 0.5329522;
            st.b[5] = -0.7616 * st.b[5] - white * 0.0168980;
            sample = st.b[0] + st.b[1] + st.b[2] + st.b[3] + st.b[4] + st.b[5] + st.b[6] + white * 0.5362;
            sample *= 0.11;
            st.b[6] = white * 0.115926;
            
            if (st.mode >= 4) { // Rain
               let rainSample = sample * 0.4; 
               st.rainDropTimer--;
               let dropThreshold = st.mode === 4 ? 4000 : 1200; 
               if (Math.random() * dropThreshold < 1) {
                  st.rainDropTimer = st.mode === 4 ? 100 : 250;
               }
               if (st.rainDropTimer > 0) {
                  rainSample += white * 0.15 * (st.rainDropTimer / 250);
               }
               sample = rainSample * (st.mode === 5 ? 1.6 : 1.2);
            }
          }
          else if (st.mode === 3) { // White
            sample = white * 0.15;
          }
          output[i] = sample;
        }
      };
      
      this.noiseGain = this.audioCtx.createGain();
      this.noiseGain.gain.value = 0.3;
      this.noiseProcessor.connect(this.noiseGain);
      this.noiseGain.connect(this.audioCtx.destination);
    }

    setNoiseMode(mode) {
      this.noiseState.mode = mode;
      if (mode > 0 && this.audioCtx.state === 'suspended') {
         this.audioCtx.resume();
      }
    }

    async fetchTTS(text, retries = 1) {
      try {
        const token = await Utils.getToken();
        if (!token) throw new Error("Not logged in");
        
        const res = await fetch('http://localhost:3001/api/extension-tts', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          },
          body: JSON.stringify({ text, voice: 'premium' })
        });
        
        if (res.status === 429 && retries > 0) {
          await new Promise(r => setTimeout(r, 4000));
          return this.fetchTTS(text, retries - 1);
        }
        
        if (!res.ok) {
          let errMsg = \`API Error \${res.status}\`;
          try { const data = await res.json(); if (data.message) errMsg = data.message; } catch(e){}
          throw new Error(errMsg);
        }
        
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch (err) {
        if (retries > 0 && err.message !== "Not logged in") {
          await new Promise(r => setTimeout(r, 2000));
          return this.fetchTTS(text, retries - 1);
        }
        throw err;
      }
    }

    playVoice(url, onPlay, onEnd) {
      if (this.voiceAudio) {
        this.voiceAudio.pause();
        this.voiceAudio = null;
      }
      this.voiceAudio = new Audio(url);
      this.voiceAudio.playbackRate = this.playbackRate;
      
      this.voiceAudio.onplay = onPlay;
      this.voiceAudio.onended = () => {
        URL.revokeObjectURL(url);
        if (onEnd) onEnd();
      };
      
      this.voiceAudio.play().catch(e => console.error("Playback error:", e));
    }
    
    pause() {
      if (this.voiceAudio) this.voiceAudio.pause();
      if (this.audioCtx.state === 'running') this.audioCtx.suspend();
    }
    
    resume() {
      if (this.voiceAudio) this.voiceAudio.play();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    setSpeed(speed) {
      this.playbackRate = speed;
      if (this.voiceAudio) this.voiceAudio.playbackRate = speed;
    }

    destroy() {
      this.pause();
      if (this.noiseProcessor) this.noiseProcessor.disconnect();
      if (this.noiseGain) this.noiseGain.disconnect();
      this.audioCtx.close();
    }
  }

  class ShadowUI {
    constructor() {
      this.host = document.createElement('div');
      this.host.id = "focusreader-host";
      
      // Inline styles for the host to take full screen but allow pointer events through when hidden
      Object.assign(this.host.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        pointerEvents: 'none' // Sub-elements will enable pointerEvents
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
      style.textContent = \`
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
          color: var(--inactive-text);
          transition: color 0.1s ease, text-shadow 0.1s ease;
          padding: 0 2px;
          border-radius: 4px;
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

        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
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
      \`;
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

    showToast(msg, isError = false) {
      const toast = document.createElement('div');
      toast.className = "toast" + (isError ? " error" : "");
      toast.innerText = msg;
      this.toastContainer.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }

    addControlButton(iconHtml, text, isPrimary = false) {
      const btn = document.createElement('button');
      if (isPrimary) btn.className = 'primary';
      btn.innerHTML = \`\${iconHtml} \${text}\`;
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

  class BrainCommander {
    constructor(ui, audioEngine, controller) {
      this.ui = ui;
      this.audioEngine = audioEngine;
      this.controller = controller;
      this.recognition = null;
      this.isListening = false;
      this.btn = null;
      this.currentScrollDir = 0;
      
      this.initSpeech();
    }

    initSpeech() {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        this.recognition.onstart = () => {
          this.isListening = true;
          this.btn.innerHTML = \`\${ICONS.sparkles} Brain (Listening...)\`;
          this.btn.style.color = '#4ade80';
          this.scrollLoop();
        };
        
        this.recognition.onend = () => {
          this.isListening = false;
          this.currentScrollDir = 0;
          this.btn.innerHTML = \`\${ICONS.sparkles} Brain (Mic Off)\`;
          this.btn.style.color = '#fff';
        };
        
        this.recognition.onresult = async (event) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript.toLowerCase().trim();
            else interimTranscript += event.results[i][0].transcript.toLowerCase().trim();
          }
          
          const activeText = finalTranscript || interimTranscript;
          
          if (activeText.includes('down')) this.currentScrollDir = 1;
          else if (activeText.includes('up')) this.currentScrollDir = -1;
          else this.currentScrollDir = 0;
          
          if (finalTranscript) {
            this.handleCommand(finalTranscript);
          }
        };
      }
    }

    scrollLoop() {
      if (this.currentScrollDir !== 0) {
        this.ui.vault.scrollBy({ top: this.currentScrollDir * 15, behavior: 'instant' });
      }
      if (this.isListening) requestAnimationFrame(() => this.scrollLoop());
    }

    async handleCommand(cmd) {
      if (cmd.includes('refresh')) window.location.reload();
      else if (cmd.includes('back')) window.history.back();
      else if (cmd.startsWith('go to ')) {
        const target = cmd.replace('go to ', '').trim().replace(/\\s+/g, '');
        if (target) window.location.href = \`https://\${target}.com\`;
      }
      else if (cmd.includes('pause') || cmd.includes('stop')) {
        this.controller.pauseSystem();
      }
      else if (cmd.includes('play') || cmd.includes('turn on voice')) {
        this.controller.resumeSystem();
      }
      
      const noteMatch = cmd.match(/^(?:create|take|save|write|send)\\s+(?:a\\s+)?(?:note|thought|memo)\\s*(?:about|that)?\\s*(.*)$/i);
      if (noteMatch) {
        const noteContent = noteMatch[1].trim() || "Empty note";
        this.ui.showToast("Sending note to dashboard...");
        try {
          const token = await Utils.getToken();
          const res = await fetch('http://localhost:3001/api/extension-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
            body: JSON.stringify({ note: noteContent, source: window.location.href })
          });
          if (res.ok) this.ui.showToast("Note successfully saved! 📝");
        } catch (err) {
          this.ui.showToast("Error saving note.", true);
        }
      }
    }

    attachButton(btn) {
      this.btn = btn;
      if (!this.recognition) {
        this.btn.innerHTML = "Brain Not Supported";
        this.btn.disabled = true;
        return;
      }
      this.btn.onclick = () => {
        if (this.isListening) this.recognition.stop();
        else this.recognition.start();
      };
    }
    
    stop() {
      if (this.recognition && this.isListening) this.recognition.stop();
    }
  }

  class FocusReaderController {
    constructor(chunks) {
      this.chunks = chunks;
      this.chunkTokens = chunks.map(c => Utils.buildWordTimings(c));
      
      this.ui = new ShadowUI();
      this.audio = new AudioEngine();
      this.brain = new BrainCommander(this.ui, this.audio, this);
      
      // State
      this.currentChunkIdx = 0;
      this.isPaused = false;
      this.isQueueActive = true;
      this.audioQueue = [];
      this.isPlaying = false;
      
      this.config = {
        speedIdx: 0,
        colorIdx: 0,
        noiseIdx: 0,
        isBionic: true
      };
      
      this.activeSpans = [];
      this.activeWordSpan = null;
      this.animationFrameId = null;

      this.setupUI();
      this.ui.show();
      this.fetchNextChunk();
    }

    setupUI() {
      // Setup the dynamic content container
      this.renderCurrentChunk();

      // Controls
      const btnSpeed = this.ui.addControlButton(ICONS.lightning, \`\${THEME.speeds[0].toFixed(1)}x\`);
      btnSpeed.onclick = () => {
        this.config.speedIdx = (this.config.speedIdx + 1) % THEME.speeds.length;
        const spd = THEME.speeds[this.config.speedIdx];
        btnSpeed.innerHTML = \`\${ICONS.lightning} \${spd.toFixed(1)}x\`;
        this.audio.setSpeed(spd);
      };

      const btnColor = this.ui.addControlButton(ICONS.palette, "Color");
      btnColor.onclick = () => {
        this.config.colorIdx = (this.config.colorIdx + 1) % THEME.colors.length;
        btnColor.style.color = THEME.colors[this.config.colorIdx].solid;
        if (this.activeWordSpan) {
           this.activeWordSpan.style.color = THEME.colors[this.config.colorIdx].solid;
           this.activeWordSpan.style.textShadow = \`0 0 15px \${THEME.colors[this.config.colorIdx].val}\`;
        }
      };

      const btnBionic = this.ui.addControlButton(ICONS.brain, "ADHD");
      btnBionic.style.color = '#bae6fd';
      btnBionic.onclick = () => {
        this.config.isBionic = !this.config.isBionic;
        btnBionic.style.color = this.config.isBionic ? '#bae6fd' : '#fff';
        this.refreshSpanContent();
      };

      const btnNoise = this.ui.addControlButton(ICONS.waves, THEME.soundscapes[0]);
      btnNoise.onclick = () => {
        this.config.noiseIdx = (this.config.noiseIdx + 1) % THEME.soundscapes.length;
        btnNoise.innerHTML = \`\${ICONS.waves} \${THEME.soundscapes[this.config.noiseIdx]}\`;
        this.audio.setNoiseMode(this.config.noiseIdx);
      };

      const btnBrain = this.ui.addControlButton(ICONS.sparkles, "Brain (Mic Off)");
      this.brain.attachButton(btnBrain);

      this.btnPause = this.ui.addControlButton(ICONS.pause, "Pause");
      this.btnPause.onclick = () => {
        if (this.isPaused) this.resumeSystem();
        else this.pauseSystem();
      };

      const btnDash = this.ui.addControlButton(ICONS.home, "Dashboard");
      btnDash.onclick = () => window.open('http://localhost:3000/dashboard', '_blank');

      const btnExit = this.ui.addControlButton(ICONS.x, "Exit", true);
      btnExit.onclick = () => this.destroy();
    }

    // --- DOM Virtualization ---
    // Only render the CURRENT chunk to the DOM. Massively saves memory on long articles.
    renderCurrentChunk() {
      this.ui.content.innerHTML = '';
      this.activeSpans = [];
      this.activeWordSpan = null;
      
      const { words } = this.chunkTokens[this.currentChunkIdx];
      const pEl = document.createElement('p');
      pEl.style.marginBottom = '2rem';
      
      words.forEach((word, wordIdx) => {
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.rawWord = word;
        span.dataset.bionicHtml = Utils.bionicFormat(word);
        span.innerHTML = this.config.isBionic ? span.dataset.bionicHtml : word;
        
        pEl.appendChild(span);
        pEl.appendChild(document.createTextNode(' '));
        this.activeSpans.push(span);
      });
      
      this.ui.content.appendChild(pEl);
    }
    
    refreshSpanContent() {
      this.activeSpans.forEach(span => {
        span.innerHTML = this.config.isBionic ? span.dataset.bionicHtml : span.dataset.rawWord;
      });
    }

    // --- Audio Queueing ---
    async fetchNextChunk() {
      if (!this.isQueueActive || this.currentChunkIdx >= this.chunks.length) return;
      
      const fetchIdx = this.audioQueue.length + (this.isPlaying ? 1 : 0) + this.currentChunkIdx;
      if (fetchIdx >= this.chunks.length) return;
      
      try {
        const url = await this.audio.fetchTTS(this.chunks[fetchIdx]);
        this.audioQueue.push({ url, chunkIdx: fetchIdx });
        
        if (!this.isPlaying && !this.isPaused && this.isQueueActive) {
          this.playNextInQueue();
        }
      } catch (err) {
        console.error("Fetch failed", err);
        this.ui.showToast(\`TTS Error: \${err.message}\`, true);
      } finally {
        if (this.audioQueue.length < 2) {
          this.fetchNextChunk(); // Buffer ahead
        }
      }
    }

    playNextInQueue() {
      if (!this.isQueueActive || this.audioQueue.length === 0) {
        this.isPlaying = false;
        return;
      }
      
      this.isPlaying = true;
      const { url, chunkIdx } = this.audioQueue.shift();
      
      // If we moved to a new chunk, virtualize the DOM
      if (chunkIdx !== this.currentChunkIdx) {
        this.currentChunkIdx = chunkIdx;
        this.renderCurrentChunk();
      }
      
      const currentTokens = this.chunkTokens[chunkIdx].tokens;
      
      this.audio.playVoice(url, 
        // On Play
        () => {
          this.animationFrameId = requestAnimationFrame(() => this.updateKaraoke(currentTokens));
          this.fetchNextChunk(); // ensure buffer stays full
        },
        // On End
        () => {
          cancelAnimationFrame(this.animationFrameId);
          this.playNextInQueue();
        }
      );
    }

    updateKaraoke(tokens) {
      if (!this.audio.voiceAudio || this.audio.voiceAudio.paused) {
        if (this.isPlaying && this.isQueueActive) {
          this.animationFrameId = requestAnimationFrame(() => this.updateKaraoke(tokens));
        }
        return;
      }
      
      const audio = this.audio.voiceAudio;
      if (!audio.duration) {
         this.animationFrameId = requestAnimationFrame(() => this.updateKaraoke(tokens));
         return;
      }
      
      const frac = audio.currentTime / audio.duration;
      const activeIdx = Utils.wordIndexAt(tokens, frac);
      const nextSpan = this.activeSpans[activeIdx];
      
      if (nextSpan && nextSpan !== this.activeWordSpan) {
         if (this.activeWordSpan) {
            this.activeWordSpan.style.color = 'var(--inactive-text)';
            this.activeWordSpan.style.textShadow = 'none';
         }
         const color = THEME.colors[this.config.colorIdx];
         nextSpan.style.color = color.solid;
         nextSpan.style.textShadow = \`0 0 15px \${color.val}\`;
         
         const rect = nextSpan.getBoundingClientRect();
         const vh = window.innerHeight;
         // Note: Shadow DOM elements return coordinates relative to viewport just like normal elements
         if (rect.top > vh * 0.6 || rect.top < vh * 0.3) {
            nextSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
         }
         
         this.activeWordSpan = nextSpan;
      }
      
      this.animationFrameId = requestAnimationFrame(() => this.updateKaraoke(tokens));
    }

    pauseSystem() {
      this.isPaused = true;
      this.audio.pause();
      this.btnPause.innerHTML = \`\${ICONS.play} Play\`;
    }

    resumeSystem() {
      this.isPaused = false;
      this.audio.resume();
      this.btnPause.innerHTML = \`\${ICONS.pause} Pause\`;
      if (!this.isPlaying && this.audioQueue.length > 0) {
        this.playNextInQueue();
      }
    }

    destroy() {
      this.isQueueActive = false;
      cancelAnimationFrame(this.animationFrameId);
      this.audioQueue.forEach(i => URL.revokeObjectURL(i.url));
      this.audio.destroy();
      this.brain.stop();
      this.ui.destroy();
      window.hasInjectedFocusReader = false;
    }
  }

  // ==========================================
  // INITIALIZATION (SPA AWARE)
  // ==========================================
  function attemptInit() {
    if (window.hasInjectedFocusReader) return; // already got it
    
    const chunks = ArticleExtractor.extract();
    if (chunks.length === 0) return;
    
    // Found an article! Prevent future checks and boot system.
    window.hasInjectedFocusReader = true;
    new FocusReaderController(chunks);
  }

  // Check immediately
  attemptInit();
  
  // Check again for Single Page Apps (React/Next) that load DOM late
  setTimeout(attemptInit, 1000);
  setTimeout(attemptInit, 2500);
  setTimeout(attemptInit, 4000);

})();
