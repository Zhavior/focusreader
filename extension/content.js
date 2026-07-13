if (!window.hasInjectedFocusReader) {
  window.hasInjectedFocusReader = true;

  function bionicFormat(text) {
    return text.split(' ').map(word => {
      if (word.length <= 1) return `<b>${word}</b>`;
      const mid = Math.ceil(word.length / 2);
      return `<b>${word.slice(0, mid)}</b>${word.slice(mid)}`;
    }).join(' ');
  }

  // --- 1. Text Extraction ---
  // A heuristic to grab the main article text
  let rawText = "";
  const paragraphs = document.querySelectorAll('p');
  const validParagraphs = [];
  
  paragraphs.forEach(p => {
    const text = p.innerText || p.textContent;
    // Only grab substantial paragraphs to avoid nav/footer noise
    if (text.trim().length > 40) {
      validParagraphs.push(text.trim());
    }
  });

  if (validParagraphs.length === 0) {
    alert("FocusReader couldn't find a main article on this page.");
    window.hasInjectedFocusReader = false;
  } else {
    rawText = validParagraphs.join('\n\n');

    // --- 2. Build the Hyperfocus Vault Overlay ---
    const vault = document.createElement('div');
    vault.id = "focusreader-vault";
    Object.assign(vault.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      backgroundColor: '#050505',
      color: '#ffffff',
      overflowY: 'auto',
      padding: '10vh 10vw',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      opacity: '0',
      transition: 'opacity 0.7s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    });

    // Content Container
    const contentContainer = document.createElement('div');
    Object.assign(contentContainer.style, {
      maxWidth: '800px',
      width: '100%',
      fontSize: '2rem', // Massive text
      lineHeight: '1.8',
      letterSpacing: '-0.02em',
      paddingBottom: '20vh'
    });

    // Add Bionic text
    validParagraphs.forEach(pText => {
      const pEl = document.createElement('p');
      pEl.style.marginBottom = '2rem';
      pEl.innerHTML = bionicFormat(pText);
      contentContainer.appendChild(pEl);
    });

    vault.appendChild(contentContainer);
    document.body.appendChild(vault);
    
    // Fade in
    requestAnimationFrame(() => {
      vault.style.opacity = '1';
    });
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    // --- 3. Generative Brown Noise ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = 4096;
    let lastOut = 0;
    const whiteNoise = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    whiteNoise.onaudioprocess = function(e) {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
    }
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.2;
    whiteNoise.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // --- 4. Hyper-Realistic Voice Engine (Backend API) ---
    // Instead of window.speechSynthesis, we POST to our backend API!
    let voiceAudio = null;
    
    // We add a loading overlay while generating voice
    const loadingUI = document.createElement('div');
    loadingUI.innerText = "Generating hyper-realistic voice...";
    Object.assign(loadingUI.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(99, 102, 241, 0.2)',
      border: '1px solid rgba(99, 102, 241, 0.5)',
      color: '#a5b4fc',
      padding: '10px 20px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
    });
    vault.appendChild(loadingUI);

    fetch('http://localhost:3001/api/extension-tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Note: the backend chunking might take a bit for huge texts, MVP sends the whole thing
      // Max length limit might apply, so we slice to 10k chars for safety in the extension MVP
      body: JSON.stringify({ text: rawText.slice(0, 5000), voice: 'premium' })
    })
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      voiceAudio = new Audio(url);
      voiceAudio.play();
      loadingUI.remove();
    })
    .catch(err => {
      console.error("Voice generation failed:", err);
      loadingUI.innerText = "Error loading voice. (Check if backend is running on 3001)";
      loadingUI.style.background = "rgba(239, 68, 68, 0.2)";
      loadingUI.style.border = "1px solid rgba(239, 68, 68, 0.5)";
      loadingUI.style.color = "#fca5a5";
    });

    // --- 5. UI Controls ---
    const controlPanel = document.createElement('div');
    Object.assign(controlPanel.style, {
      position: 'fixed',
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '15px',
      backgroundColor: 'rgba(11, 13, 16, 0.95)',
      backdropFilter: 'blur(15px)',
      padding: '15px 25px',
      borderRadius: '20px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
    });
    
    const pauseBtn = document.createElement('button');
    pauseBtn.innerText = "⏸️ Pause";
    Object.assign(pauseBtn.style, {
      padding: '12px 24px',
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '16px',
      transition: 'all 0.2s'
    });
    
    const exitBtn = document.createElement('button');
    exitBtn.innerText = "🛑 Exit Vault";
    Object.assign(exitBtn.style, {
      padding: '12px 24px',
      background: 'linear-gradient(45deg, #ef4444, #b91c1c)',
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '16px',
      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
    });
    
    let isPaused = false;
    
    pauseBtn.onclick = () => {
      if (isPaused) {
        if (voiceAudio) voiceAudio.play();
        audioCtx.resume();
        pauseBtn.innerText = "⏸️ Pause";
        isPaused = false;
      } else {
        if (voiceAudio) voiceAudio.pause();
        audioCtx.suspend();
        pauseBtn.innerText = "▶️ Resume";
        isPaused = true;
      }
    };
    
    const cleanup = () => {
      if (voiceAudio) {
        voiceAudio.pause();
        voiceAudio = null;
      }
      try {
        whiteNoise.disconnect();
        gainNode.disconnect();
        audioCtx.close();
      } catch(e) {}
      
      vault.style.opacity = '0';
      setTimeout(() => {
        vault.remove();
        document.body.style.overflow = 'auto';
        window.hasInjectedFocusReader = false;
      }, 700);
    };
    
    exitBtn.onclick = cleanup;
    
    controlPanel.appendChild(pauseBtn);
    controlPanel.appendChild(exitBtn);
    vault.appendChild(controlPanel);
  }
}
