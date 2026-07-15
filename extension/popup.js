document.addEventListener('DOMContentLoaded', () => {
  const loginState = document.getElementById('loginState');
  const loggedInState = document.getElementById('loggedInState');
  const tokenInput = document.getElementById('tokenInput');
  const saveBtn = document.getElementById('saveBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const statusMsg = document.getElementById('statusMsg');

  function setStatus(msg, isError = false) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status' + (isError ? ' error' : '');
    setTimeout(() => { statusMsg.textContent = ''; }, 3000);
  }

  function updateUI() {
    chrome.runtime.sendMessage({ action: 'CHECK_AUTH_STATUS' }, (authRes) => {
      if (authRes && authRes.logged_in) {
        loginState.style.display = 'none';
        loggedInState.style.display = 'block';
      } else {
        chrome.storage.sync.get(['zhaviorToken'], (res) => {
          if (res.zhaviorToken) {
            loginState.style.display = 'none';
            loggedInState.style.display = 'block';
          } else {
            loginState.style.display = 'block';
            loggedInState.style.display = 'none';
          }
        });
      }
    });
  }

  const libraryBtn = document.getElementById('libraryBtn');
  const voiceCtrlBtn = document.getElementById('voiceCtrlBtn');

  chrome.storage.local.get(['voiceCtrlEnabled'], (res) => {
    if (voiceCtrlBtn) {
      if (res.voiceCtrlEnabled) {
        voiceCtrlBtn.textContent = '🛑 Disable Voice Controller';
        voiceCtrlBtn.style.background = '#f59e0b';
      } else {
        voiceCtrlBtn.textContent = '🎙️ Enable Voice Controller v4.0';
        voiceCtrlBtn.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
      }
    }
  });

  if (voiceCtrlBtn) {
    voiceCtrlBtn.addEventListener('click', () => {
      chrome.storage.local.get(['voiceCtrlEnabled'], (res) => {
        const nextState = !res.voiceCtrlEnabled;
        chrome.storage.local.set({ voiceCtrlEnabled: nextState }, () => {
          if (nextState) {
            voiceCtrlBtn.textContent = '🛑 Disable Voice Controller';
            voiceCtrlBtn.style.background = '#f59e0b';
            chrome.runtime.sendMessage({ action: 'ENABLE_VOICE_CONTROLLER' }, () => {
              setStatus('Voice Controller v4.0 Active!');
            });
          } else {
            voiceCtrlBtn.textContent = '🎙️ Enable Voice Controller v4.0';
            voiceCtrlBtn.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
            chrome.runtime.sendMessage({ action: 'DISABLE_VOICE_CONTROLLER' }, () => {
              setStatus('Voice Controller Disabled.');
            });
          }
        });
      });
    });
  }

  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (!token) {
      setStatus('Please enter a valid token.', true);
      return;
    }
    chrome.storage.sync.set({ zhaviorToken: token }, () => {
      setStatus('Logged in successfully!');
      updateUI();
    });
  });

  logoutBtn.addEventListener('click', () => {
    chrome.storage.sync.remove(['zhaviorToken'], () => {
      setStatus('Logged out.');
      updateUI();
    });
  });

  libraryBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });
  });

  updateUI();
});
