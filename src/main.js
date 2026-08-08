const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// 允许自动播放视频（无需用户手势）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let tray = null;

const WIDTH = 192;
const HEIGHT = 208;

// IPC: 窗口移动（限制在屏幕内）
ipcMain.on('move-window', (event, { dx, dy }) => {
  if (win) {
    const bounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const { x: sx, y: sy, width: sw, height: sh } = display.workArea;
    const nx = Math.max(sx, Math.min(sx + sw - WIDTH, bounds.x + Math.round(dx)));
    const ny = Math.max(sy, Math.min(sy + sh - HEIGHT, bounds.y + Math.round(dy)));
    win.setBounds({ x: nx, y: ny, width: WIDTH, height: HEIGHT });
    // 回传实际位置和屏幕边界，供渲染进程边缘检测
    event.sender.send('window-moved', { x: nx, y: ny, sx, sy, sw, sh });
  }
});

// IPC: 获取屏幕工作区
ipcMain.on('get-screen-info', (event) => {
  const display = screen.getPrimaryDisplay();
  event.returnValue = display.workArea;
});

// IPC: 获取窗口位置
ipcMain.on('get-window-pos', (event) => {
  if (win) event.returnValue = win.getBounds();
  else event.returnValue = { x: 0, y: 0 };
});

// IPC: 右键菜单
ipcMain.on('show-context-menu', (event) => {
  const menu = Menu.buildFromTemplate([
    { label: '🐱 发呆', click: () => win.webContents.send('set-state', 'idle') },
    { label: '🚶 向右走', click: () => win.webContents.send('set-state', 'running-right') },
    { label: '🚶 向左走', click: () => win.webContents.send('set-state', 'running-left') },
    { label: '👋 挥手', click: () => win.webContents.send('set-state', 'waving') },
    { label: '🦘 跳跃', click: () => win.webContents.send('set-state', 'jumping') },
    { label: '😢 难过', click: () => win.webContents.send('set-state', 'failed') },
    { label: '⏳ 等待', click: () => win.webContents.send('set-state', 'waiting') },
    { label: '💭 思考', click: () => win.webContents.send('set-state', 'running') },
    { label: '🔍 检查', click: () => win.webContents.send('set-state', 'review') },
    { type: 'separator' },
    { label: '🎯 追逐', click: () => win.webContents.send('set-state', 'chase') },
    { label: '⏹ 停止追逐', click: () => win.webContents.send('chase-stop') },
  ]);
  menu.popup({ window: win });
});

// IPC: 追逐模式
let chaseActive = false;
const stopChase = () => {
  if (!chaseActive) return;
  chaseActive = false;
  try { globalShortcut.unregister('Escape'); } catch (e) {}
};
ipcMain.on('chase-start', () => {
  chaseActive = true;
  try {
    if (!globalShortcut.register('Escape', () => {
      if (win) win.webContents.send('chase-stop');
    })) {
      console.warn('全局 ESC 注册失败，将只响应窗口聚焦时的按键');
    }
  } catch (e) {}
});
ipcMain.on('chase-stop', stopChase);

// 追逐时推送鼠标屏幕坐标（~60fps）
setInterval(() => {
  if (chaseActive && win && !win.isDestroyed()) {
    const p = screen.getCursorScreenPoint();
    win.webContents.send('cursor-pos', { x: p.x, y: p.y });
  }
}, 16);

function createTrayIcon() {
  // 用原生方式生成 16x16 橘色小图标
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = size / 2, cy = size / 2;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (dist < size / 2 - 1) {
        buf[i] = 255; buf[i + 1] = 140; buf[i + 2] = 40; buf[i + 3] = 255;
        // 耳朵
        if (dist > size / 2 - 3 && dy < 0) {
          buf[i + 1] = 165; buf[i + 2] = 60;
        }
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const x = width - WIDTH - 40;
  const y = height - HEIGHT - 60;

  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x, y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    useContentSize: true,
    ...(process.platform === 'darwin' ? { visibleOnAllWorkspaces: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // 窗口聚焦时 ESC 也能退出追逐（全局快捷键失败时的兜底）
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      win.webContents.send('chase-stop');
    }
  });
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, 'screen-saver');
  } else {
    win.setAlwaysOnTop(true);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
  } else {
    icon = createTrayIcon();
  }
  tray = new Tray(icon);
  tray.setToolTip('桌面宠物 · 年年');

  const ctx = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => win.isVisible() ? win.hide() : win.show() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(ctx);
  // 左键也弹出菜单，不直接切换
  tray.on('click', () => tray.popUpContextMenu());
}

app.on('ready', () => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
