/**
 * 桌面宠物 — 纯视频引擎
 */
const path = require('path');
const fs = require('fs');

const CELL_W = 192, CELL_H = 208;
const STATES = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review', 'dragged', 'struggling'];

// === 视频引擎 ===
class VideoEngine {
  constructor(canvas, videoDir) {
    this.ctx = canvas.getContext('2d');
    this.videos = {};
    this.active = null;
    this.bg = null;
    this.tol = 75;
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.mirror = {};

    const c = document.getElementById('videos');
    STATES.forEach(name => {
      let fp = path.join(videoDir, name + '.mp4'), m = false;
      if (name === 'running-left' && !fs.existsSync(fp)) { fp = path.join(videoDir, 'running-right.mp4'); m = true; }
      if (!fs.existsSync(fp)) return;
      const v = document.createElement('video');
      v.src = URL.createObjectURL(new Blob([fs.readFileSync(fp)], { type: 'video/mp4' }));
      v.loop = false; v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.addEventListener('ended', () => this.onEnded && this.onEnded());
      c.appendChild(v);
      this.videos[name] = v;
      if (m) this.mirror[name] = true;
    });
  }

  play(state) {
    const v = this.videos[state];
    if (!v || this.active === v) return;
    if (this.active) { this.active.pause(); this.active.currentTime = 0; }
    this.active = v; this._state = state; this.bg = null;
    v.currentTime = 0;
    const p = v.play();
    if (p) p.catch(() => {}); // autoplay might fail, handled by retry
  }

  draw() {
    const v = this.active;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return false;
    const vw = v.videoWidth, vh = v.videoHeight;

    if (!this.bg) {
      const tmp = document.createElement('canvas'); tmp.width = vw; tmp.height = vh;
      const tc = tmp.getContext('2d'); tc.drawImage(v, 0, 0);
      const d = tc.getImageData(0, 0, vw, vh).data, smp = [];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const g = (px, py) => { const i = (py * vw + px) * 4; return [d[i], d[i + 1], d[i + 2]]; };
        smp.push(g(x, y), g(vw - 1 - x, y), g(x, vh - 1 - y), g(vw - 1 - x, vh - 1 - y));
      }
      const rs = smp.map(s => s[0]).sort((a, b) => a - b);
      const gs = smp.map(s => s[1]).sort((a, b) => a - b);
      const bs = smp.map(s => s[2]).sort((a, b) => a - b);
      const mid = Math.floor(smp.length / 2);
      this.bg = { r: rs[mid], g: gs[mid], b: bs[mid] };
    }

    if (process.platform === 'win32') {
      // Windows: 整体缩放到 192×208 处理
      this.off.width = CELL_W; this.off.height = CELL_H;
      this.offCtx.drawImage(v, 0, 0, CELL_W, CELL_H);
      const frame = this.offCtx.getImageData(0, 0, CELL_W, CELL_H);
      for (let i = 0; i < frame.data.length; i += 4) {
        const dr = frame.data[i] - this.bg.r, dg = frame.data[i + 1] - this.bg.g, db = frame.data[i + 2] - this.bg.b;
        if (Math.sqrt(dr * dr + dg * dg + db * db) < this.tol) frame.data[i + 3] = 0;
      }
      const cs = Math.floor(Math.min(CELL_W, CELL_H) * 0.20);
      const blank = (d, x, y) => { for (let py = y; py < y + cs; py++) for (let px = x; px < x + cs; px++) d[(py * CELL_W + px) * 4 + 3] = 0; };
      blank(frame.data, 0, 0); blank(frame.data, CELL_W - cs, 0);
      blank(frame.data, 0, CELL_H - cs); blank(frame.data, CELL_W - cs, CELL_H - cs);
      this.offCtx.putImageData(frame, 0, 0);

      this.ctx.clearRect(0, 0, CELL_W, CELL_H);
      if (this.mirror[this._state]) {
        this.ctx.save(); this.ctx.translate(CELL_W, 0); this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.off, 0, 0);
        this.ctx.restore();
      } else {
        this.ctx.drawImage(this.off, 0, 0);
      }
      return true;
    }

    // macOS: 正常流程（绿幕抠图 + 水印）
    this.off.width = vw; this.off.height = vh;
    this.offCtx.drawImage(v, 0, 0);
    const frame = this.offCtx.getImageData(0, 0, vw, vh);
    for (let i = 0; i < frame.data.length; i += 4) {
      const dr = frame.data[i] - this.bg.r, dg = frame.data[i + 1] - this.bg.g, db = frame.data[i + 2] - this.bg.b;
      if (Math.sqrt(dr * dr + dg * dg + db * db) < this.tol) frame.data[i + 3] = 0;
    }
    const cs = Math.floor(Math.min(vw, vh) * 0.20);
    const blank = (d, x, y) => { for (let py = y; py < y + cs; py++) for (let px = x; px < x + cs; px++) d[(py * vw + px) * 4 + 3] = 0; };
    blank(frame.data, 0, 0); blank(frame.data, vw - cs, 0);
    blank(frame.data, 0, vh - cs); blank(frame.data, vw - cs, vh - cs);
    this.offCtx.putImageData(frame, 0, 0);

    this.ctx.clearRect(0, 0, CELL_W, CELL_H);
    if (this.mirror[this._state]) {
      this.ctx.save(); this.ctx.translate(CELL_W, 0); this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.off, 0, 0, CELL_W, CELL_H); this.ctx.restore();
    } else {
      this.ctx.drawImage(this.off, 0, 0, CELL_W, CELL_H);
    }
    return true;
  }

  has(s) { return !!this.videos[s]; }

  tryPlay(state) {
    const v = this.videos[state];
    if (!v) return false;
    // Already playing this? check if actually running
    // Force play attempt
    this.play(state);
    return true;
  }
}

// === 主控制器 ===
class PetEngine {
  constructor(canvas, videoDir) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.video = new VideoEngine(canvas, videoDir);

    this.state = null;
    this.walking = false;
    this.walkDir = 1;
    this.userState = null;

    this.video.onEnded = () => {
      if (this.state === 'dragged') {
        if (this._dragTarget) {
          // 绕过 play() 的 active===v 早退守卫，直接重播
          const v = this.video.active;
          v.currentTime = 0;
          v.play().catch(() => {});
          return;
        }
        this._setState('idle');
      } else if (this.state === 'struggling') {
        // 挣扎结束 → 自动松手
        this._dragTarget = null; this._dragPhase = null; this._struggleStartTime = null;
        if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null; }
        if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null; }
        this._setState('idle');
      } else if (this.state === 'idle') {
        const av = STATES.filter(s => s !== 'idle' && s !== 'dragged' && s !== 'struggling' && this.video.has(s));
        if (av.length) this._setState(av[Math.floor(Math.random() * av.length)]);
      } else {
        this._setState('idle');
      }
    };

    this._bindInput();
    this._setState('idle');
    this._loop();
  }

  _setState(name) {
    if (!this.video.has(name)) return;
    if (this.state === name) { this.video.play(name); return; }
    this.state = name;
    this.walking = (name === 'running-right' || name === 'running-left');
    this.walkDir = name === 'running-right' ? 1 : -1;
    this.video.play(name);
  }

  _bindInput() {
    let moved = false;
    this._dragTarget = null;
    this._dragPhase = null;
    this._dragStartTime = null;
    this._struggleStartTime = null;
    this._onMove = null;
    this._onUp = null;

    this.canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      moved = false;
      const sx = e.screenX, sy = e.screenY;
      const onPreMove = ev => {
        if (Math.abs(ev.screenX - sx) > 3 || Math.abs(ev.screenY - sy) > 3) {
          // 动了就激活拖拽
          document.removeEventListener('mousemove', onPreMove);
          document.removeEventListener('mouseup', onPreUp);
          this._dragStartTime = performance.now();
          this._dragPhase = 'relaxed';
          this._dragTarget = { x: sx, y: sy, lastX: sx, lastY: sy };
          this._setState('dragged');
          moved = true;
          this._onMove = e2 => {
            if (!this._dragTarget) return;
            this._dragTarget.x = e2.screenX;
            this._dragTarget.y = e2.screenY;
          };
          this._onUp = () => {
            this._dragTarget = null; this._dragPhase = null; this._struggleStartTime = null;
            this._setState('idle');
            document.removeEventListener('mousemove', this._onMove);
            document.removeEventListener('mouseup', this._onUp);
            this._onMove = null; this._onUp = null;
          };
          document.addEventListener('mousemove', this._onMove);
          document.addEventListener('mouseup', this._onUp);
        }
      };
      const onPreUp = () => {
        document.removeEventListener('mousemove', onPreMove);
        document.removeEventListener('mouseup', onPreUp);
      };
      document.addEventListener('mousemove', onPreMove);
      document.addEventListener('mouseup', onPreUp);
    });
    this.canvas.addEventListener('dblclick', () => this._setState('jumping'));
    this.canvas.addEventListener('click', () => { if (!moved) this._setState('waving'); });
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this._dragTarget = null; this._dragPhase = null; this._struggleStartTime = null;
      if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null; }
      if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null; }
      require('electron').ipcRenderer.send('show-context-menu');
    });
    require('electron').ipcRenderer.on('set-state', (_, s) => { this.userState = s; this._setState(s); });
  }

  _loop(prev = 0) {
    const now = performance.now();

    // 合并拖拽 + 行走的位移，每帧只发一次 IPC
    let dx = 0, dy = 0;
    if (this._dragTarget) {
      dx = this._dragTarget.x - this._dragTarget.lastX;
      dy = this._dragTarget.y - this._dragTarget.lastY;
      this._dragTarget.lastX = this._dragTarget.x;
      this._dragTarget.lastY = this._dragTarget.y;
    }

    // 挣扎期下坠（独立于鼠标追踪）
    if (this._dragPhase === 'struggling' && this._struggleStartTime) {
      const se = now - this._struggleStartTime;
      if (se > 1000 && se <= 3000) {
        const t = (se - 1000) / 2000; // 0→1
        dy += 1 + t * t * 4; // 加速下坠（轻柔）
      }
    }
    if (this.walking) {
      dx += this.walkDir * 1.5;
    }
    if (dx !== 0 || dy !== 0) {
      require('electron').ipcRenderer.send('move-window', { dx, dy });
    }

    if (!this.video.draw()) {
      this.ctx.clearRect(0, 0, CELL_W, CELL_H);
    }

    // 切换挣扎 → 脱离鼠标控制
    if (this._dragTarget && this._dragPhase === 'relaxed' && now - this._dragStartTime >= 10000) {
      this._dragPhase = 'struggling';
      this._struggleStartTime = now;
      this._dragTarget = null;
      if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null; }
      if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null; }
      this._setState('struggling');
    }

    requestAnimationFrame(() => this._loop(now));
  }
}

// === 启动 ===
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('c');
  canvas.width = CELL_W; canvas.height = CELL_H;
  new PetEngine(canvas, path.join(__dirname, '..', '..', 'assets', 'videos'));
});
