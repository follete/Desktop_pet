const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 允许自动播放视频（无需用户手势）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let tray = null;

const WIDTH = 192;
const HEIGHT = 208;

// IPC: 窗口移动（限制在屏幕内）
ipcMain.on('move-window', (_, { dx, dy }) => {
  if (win) {
    const [x, y] = win.getPosition();
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const nx = Math.max(0, Math.min(sw - WIDTH, x + Math.round(dx)));
    const ny = Math.max(0, Math.min(sh - HEIGHT, y + Math.round(dy)));
    win.setPosition(nx, ny);
  }
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
  ]);
  menu.popup({ window: win });
});

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
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    ...(process.platform === 'darwin' ? { visibleOnAllWorkspaces: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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
  tray.setToolTip('桌面宠物 · 咪咪');

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
