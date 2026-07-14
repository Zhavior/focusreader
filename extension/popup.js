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

  const libraryBtn = document.getElementById('libraryBtn');

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
