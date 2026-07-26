/**
 * 桌面宠物 — 纯视频引擎
 */
const path = require('path');
const fs = require('fs');

const CELL_W = 192, CELL_H = 208;
const STATES = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review'];

// === 视频引擎 ===
class VideoEngine {
  constructor(canvas, videoDir) {
    this.ctx = canvas.getContext('2d');
    this.videos = {};
    this.active = null;
    this.bg = null;
    this.tol = 70;
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
      if (this.state === 'idle') {
        const av = STATES.filter(s => s !== 'idle' && this.video.has(s));
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
    let dragging = false, moved = false, start = { x: 0, y: 0 };
    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { dragging = true; moved = false; start = { x: e.screenX, y: e.screenY }; }
    });
    this.canvas.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.screenX - start.x, dy = e.screenY - start.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      start = { x: e.screenX, y: e.screenY };
      require('electron').ipcRenderer.send('move-window', { dx, dy });
    });
    this.canvas.addEventListener('mouseup', () => { dragging = false; });
    this.canvas.addEventListener('dblclick', () => this._setState('jumping'));
    this.canvas.addEventListener('click', () => { if (!moved) this._setState('waving'); });
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault(); dragging = false;
      require('electron').ipcRenderer.send('show-context-menu');
    });
    require('electron').ipcRenderer.on('set-state', (_, s) => { this.userState = s; this._setState(s); });
  }

  _loop(prev = 0) {
    const now = performance.now();
    const dt = prev ? now - prev : 16;

    if (this.walking) {
      require('electron').ipcRenderer.send('move-window', { dx: this.walkDir * 1.5, dy: 0 });
    }

    if (!this.video.draw()) {
      this.ctx.clearRect(0, 0, CELL_W, CELL_H);
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
