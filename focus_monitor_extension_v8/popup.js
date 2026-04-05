let timerInterval;

// 加载保存的配置和当前状态
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 加载配置
  const data = await chrome.storage.local.get(['config', 'lastResult']);
  const config = data.config || {
    monitorDomain: true,
    monitorTab: true,
    monitorWindow: true,
    monitorFile: true
  };

  document.getElementById('monitorDomain').checked = config.monitorDomain;
  document.getElementById('monitorTab').checked = config.monitorTab;
  document.getElementById('monitorWindow').checked = config.monitorWindow;
  // monitorFile 永远 true，不显示可选项

  // 2. 加载上次结果
  if (data.lastResult) {
    showStats(data.lastResult);
  }

  // 3. 检查当前状态
  chrome.runtime.sendMessage({ action: "get_status" }, (response) => {
    if (response && response.isActive) {
      updateUI(true, response.startTime);
    } else {
      updateUI(false);
    }
  });
});

function updateUI(active, startTime) {
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const indicator = document.getElementById('status-indicator');
  const timerDisplay = document.getElementById('timer-display');
  const currentDuration = document.getElementById('current-duration');

  if (active) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    indicator.classList.add('active');
    timerDisplay.style.display = 'block';

    // 启动计时器
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      currentDuration.innerText = formatTime(seconds);
    }, 1000);
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    indicator.classList.remove('active');
    timerDisplay.style.display = 'none';
    if (timerInterval) clearInterval(timerInterval);
  }
}

function showStats(result) {
  const statsDiv = document.getElementById('stats-report');
  document.getElementById('res-duration').innerText = formatTime(result.duration);
  document.getElementById('res-tabs').innerText = `${result.tabSwitches} 次`;
  document.getElementById('res-domains').innerText = `${result.domainSwitches} 次`;
  document.getElementById('res-focus').innerText = `${result.windowFocusLost} 次`;
  statsDiv.style.display = 'block';
}

// 开始监控
document.getElementById('start-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "start_monitoring" }, (response) => {
    updateUI(true, Date.now());
    document.getElementById('stats-report').style.display = 'none';
  });
});

// 结束监控
document.getElementById('stop-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "stop_monitoring" }, (response) => {
    updateUI(false);
    if (response && response.result) {
      showStats(response.result);
      // 保存最后一次结果
      chrome.storage.local.set({ lastResult: response.result });
    }
  });
});

// 保存配置
document.getElementById('save-settings').addEventListener('click', async () => {
  const config = {
    monitorDomain: document.getElementById('monitorDomain').checked,
    monitorTab: document.getElementById('monitorTab').checked,
    monitorWindow: document.getElementById('monitorWindow').checked,
    monitorFile: true,
    messages: ["保持专注！", "你分心了吗？", "回到工作中去！", "专注是成功的关键。"]
  };

  await chrome.storage.local.set({ config });

  const saveBtn = document.getElementById('save-settings');
  saveBtn.innerText = '配置已保存！';
  saveBtn.style.backgroundColor = '#4CAF50';
  saveBtn.style.color = 'white';

  setTimeout(() => {
    saveBtn.innerText = '保存监控配置';
    saveBtn.style.backgroundColor = '#eee';
    saveBtn.style.color = '#666';
  }, 2000);
});

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
