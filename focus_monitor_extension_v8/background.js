let lastDomain = {};
let lastFile = {};
let focusTarget = null; // 记录开始监控时的域名或文件路径

// 统计数据
let stats = {
  startTime: null,
  tabSwitches: 0,
  domainSwitches: 0,
  fileSwitches: 0,
  windowFocusLost: 0,
  isActive: false
};

// 默认配置
const defaultConfig = {
  monitorDomain: true,
  monitorTab: true,
  monitorWindow: true,
  monitorFile: true,
  messages: ["保持专注！", "你分心了吗？", "回到工作中去！", "专注是成功的关键。"]
};

// 获取配置
async function getConfig() {
  const data = await chrome.storage.local.get('config');
  return data.config || defaultConfig;
}

/**
 * 核心改进：主动注入提示，支持两种风格，应用半透明样式和 2 秒显示时长
 * @param {number} tabId 目标标签页 ID
 * @param {string} message 提示消息
 * @param {string} type 'warning' (红色警告) 或 'welcome' (绿色欢迎)
 */
async function injectAlert(tabId, message, type = 'warning') {
  if (!tabId) return;

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (error) {
    console.warn('Focus Monitor: Could not get tab for alert injection', error);
    return;
  }

  if (!tab || !tab.url) return;
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://') || (!tab.url.startsWith('file://') && !/^https?:\/\//.test(tab.url))) {
    // 无法在内部或非 http(s)/file 页面注入脚本
    return;
  }

  const isWarning = type === 'warning';
  const icon = isWarning ? '⚠️' : '😊';
  // 使用 rgba 设置 20% 透明边框和背景
  const borderColor = isWarning ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.2)';
  const textColor = isWarning ? 'rgba(244, 67, 54, 0.9)' : 'rgba(46, 125, 50, 0.9)';
  const bgColor = isWarning ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.2)';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (msg, icon, borderColor, textColor, bgColor) => {
        let container = document.getElementById('focus-monitor-alert-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'focus-monitor-alert-container';
          container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2147483647;
            display: flex;
            justify-content: center;
            align-items: center;
            pointer-events: none;
            transition: opacity 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          `;
          document.body.appendChild(container);
        }

        container.style.background = bgColor;
        container.innerHTML = `
          <div style="
            background: rgba(255, 255, 255, 0.2); /* 20% 透明白背景 */
            backdrop-filter: blur(8px); /* 磨砂玻璃效果 */
            border: 4px solid ${borderColor};
            border-radius: 20px;
            padding: 30px 50px;
            box-shadow: 0 15px 45px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 80%;
            transform: translateY(-30px);
            transition: transform 0.3s ease;
          ">
            <div style="font-size: 70px; margin-bottom: 20px; opacity: 0.9;">${icon}</div>
            <div id="focus-monitor-alert-msg" style="
              font-size: 26px;
              font-weight: bold;
              color: ${textColor};
              text-align: center;
              line-height: 1.5;
            ">${msg}</div>
          </div>
        `;

        setTimeout(() => {
          container.style.opacity = '1';
          container.firstElementChild.style.transform = 'translateY(0)';
        }, 10);

        // 缩短为 2 秒显示时长
        setTimeout(() => {
          container.style.opacity = '0';
          container.firstElementChild.style.transform = 'translateY(-30px)';
          setTimeout(() => container.remove(), 300);
        }, 2000);
      },
      args: [message, icon, borderColor, textColor, bgColor]
    });
  } catch (e) {
    console.error("Focus Monitor: Failed to inject alert", e);
  }
}

// 监听来自 popup 的控制命令
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "start_monitoring") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      focusTarget = url.protocol === 'file:' ? url.pathname : url.hostname;
    }

    stats = {
      startTime: Date.now(),
      tabSwitches: 0,
      domainSwitches: 0,
      fileSwitches: 0,
      windowFocusLost: 0,
      isActive: true
    };
    sendResponse({ status: "started", startTime: stats.startTime });
  } else if (request.action === "stop_monitoring") {
    const duration = Math.round((Date.now() - stats.startTime) / 1000);
    const result = {
      duration: duration,
      tabSwitches: stats.tabSwitches,
      domainSwitches: stats.domainSwitches,
      fileSwitches: stats.fileSwitches,
      windowFocusLost: stats.windowFocusLost
    };
    stats.isActive = false;
    focusTarget = null;
    sendResponse({ status: "stopped", result: result });
  } else if (request.action === "get_status") {
    sendResponse({ isActive: stats.isActive, startTime: stats.startTime });
  }
  return true;
});

// 1. 监控域名切换和本地文件路径变化
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!stats.isActive) return;

  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
      return;
    }
    const config = await getConfig();
    const url = new URL(tab.url);
    const currentTarget = url.protocol === 'file:' ? url.pathname : url.hostname;
    const msgBase = config.messages[Math.floor(Math.random() * config.messages.length)];

    // 检查是否回到了专注目标
    if (currentTarget === focusTarget) {
      injectAlert(tabId, "欢迎回来，请保持专注！", "welcome");
      return;
    }

    // 本地文件监控（默认始终启用）
    if (url.protocol === 'file:') {
      if (lastFile[tabId] && lastFile[tabId] !== url.pathname) {
        stats.fileSwitches++;
        injectAlert(tabId, `文件路径已变：${msgBase}`, "warning");
      }
      lastFile[tabId] = url.pathname;
      return;
    }

    // 域名监控
    const domain = url.hostname;
    if (config.monitorDomain && lastDomain[tabId] && lastDomain[tabId] !== domain) {
      stats.domainSwitches++;
      injectAlert(tabId, `域名已切换到 ${domain}：${msgBase}`, "warning");
    }
    lastDomain[tabId] = domain;
  }
});

// 2. 监控标签切换
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!stats.isActive) return;
  stats.tabSwitches++;

  const config = await getConfig();
  const tab = await chrome.tabs.get(activeInfo.tabId);

  if (tab && tab.url) {
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://')) {
      return;
    }
    const url = new URL(tab.url);
    const currentTarget = url.protocol === 'file:' ? url.pathname : url.hostname;

    if (currentTarget === focusTarget) {
      injectAlert(activeInfo.tabId, "欢迎回来，请保持专注！", "welcome");
    } else if (config.monitorTab) {
      const msgBase = config.messages[Math.floor(Math.random() * config.messages.length)];
      injectAlert(activeInfo.tabId, `标签已切换：${msgBase}`, "warning");
    }
  }
});

// 3. 监控离开浏览器
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!stats.isActive) return;
  const config = await getConfig();

  if (config.monitorWindow && windowId === chrome.windows.WINDOW_ID_NONE) {
    stats.windowFocusLost++;
    chrome.storage.local.set({ leftBrowser: true });
  } else if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    const data = await chrome.storage.local.get('leftBrowser');
    if (data.leftBrowser) {
      chrome.storage.local.set({ leftBrowser: false });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        const currentTarget = url.protocol === 'file:' ? url.pathname : url.hostname;

        if (currentTarget === focusTarget) {
          injectAlert(tab.id, "欢迎回来，请保持专注！", "welcome");
        } else if (config.monitorWindow) {
          const msgBase = config.messages[Math.floor(Math.random() * config.messages.length)];
          injectAlert(tab.id, `欢迎回来：${msgBase}`, "warning");
        }
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete lastDomain[tabId];
  delete lastFile[tabId];
});
