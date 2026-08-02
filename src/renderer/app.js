/**
 * 桌面宠物 — 纯视频引擎
 */
const path = require('path');
const fs = require('fs');

const CELL_W = 192, CELL_H = 208;
const STATES = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review', 'dragged', 'struggling', 'edge-cling-left', 'edge-cling-right', 'edge-climb-left', 'edge-climb-right', 'edge-jump-left', 'edge-jump-right'];

const MIRROR_MAP = {
  'edge-cling-right': 'edge-cling-left',
  'edge-climb-right': 'edge-climb-left',
  'edge-jump-right': 'edge-jump-left',
};

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
      if (MIRROR_MAP[name] && !fs.existsSync(fp)) {
        fp = path.join(videoDir, MIRROR_MAP[name] + '.mp4');
        m = true;
      }
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
    if (!v || v.readyState < 2 || v.videoWidth === 0) return true; // 帧未就绪，保留上一帧避免闪白
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
      const ch = Math.floor(cs / 3);
      const blank = (d, x, y) => { for (let py = y; py < y + ch; py++) for (let px = x; px < x + cs; px++) d[(py * CELL_W + px) * 4 + 3] = 0; };
      blank(frame.data, 0, 0); blank(frame.data, CELL_W - cs, 0);
      blank(frame.data, 0, CELL_H - ch); blank(frame.data, CELL_W - cs, CELL_H - ch);
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
    const ch = Math.floor(cs / 3);
    const blank = (d, x, y) => { for (let py = y; py < y + ch; py++) for (let px = x; px < x + cs; px++) d[(py * vw + px) * 4 + 3] = 0; };
    blank(frame.data, 0, 0); blank(frame.data, vw - cs, 0);
    blank(frame.data, 0, vh - ch); blank(frame.data, vw - cs, vh - ch);
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
    this.walkStartTime = 0;
    this.walkJumpStartY = 0;
    this.userState = null;

    // 屏幕边界 + 窗口位置追踪
    const { ipcRenderer } = require('electron');
    this._screenWA = ipcRenderer.sendSync('get-screen-info');
    const pos = ipcRenderer.sendSync('get-window-pos');
    this._winX = pos.x; this._winY = pos.y;
    ipcRenderer.on('window-moved', (_, info) => {
      this._winX = info.x; this._winY = info.y;
      this._screenWA = { x: info.sx, y: info.sy, width: info.sw, height: info.sh };
    });

    // 边缘行为状态
    this._edgePhase = null;    // null | 'cling' | 'climb' | 'jump'
    this._edgeSide = null;     // 'left' | 'right'
    this._edgeStartTime = null;
    this._edgeClimbTarget = 0;
    this._edgeClimbSpeed = 0;
    this._edgeClimbDuration = 0; // 爬升时长（ms）
    this._edgeJumpStartY = 0;

    this.video.onEnded = () => {
      if (this.state === 'dragged') {
        if (this._dragTarget) {
          const v = this.video.active;
          v.currentTime = 0;
          v.play().catch(() => {});
          return;
        }
        this._setState('idle');
      } else if (this.state === 'struggling') {
        this._dragTarget = null; this._dragPhase = null; this._struggleStartTime = null;
        if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null; }
        if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null; }
        this._setState('idle');
      } else if (this.state.startsWith('edge-cling')) {
        if (this._edgePhase === 'cling') { this.video.play(this.state); return; }
        this._setState('idle');
      } else if (this.state.startsWith('edge-climb')) {
        if (this._edgePhase === 'climb') { this.video.play(this.state); return; }
        this._setState('idle');
      } else if (this.state.startsWith('edge-jump')) {
        const v = this.video.active;
        v.currentTime = 0;
        v.play().catch(() => {});
        return;
      } else if (this.state === 'idle') {
        const av = STATES.filter(s => !s.startsWith('edge-') && s !== 'idle' && s !== 'dragged' && s !== 'struggling' && this.video.has(s));
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
    if (this.walking) { this.walkStartTime = performance.now(); this.walkJumpStartY = 0; }
    this._stateChangeTime = performance.now();
    // 状态切换时清理拖拽监听和计时器
    if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null; }
    if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null; }
    if (this._dragTimer) { clearTimeout(this._dragTimer); this._dragTimer = null; }
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
    this._dragTimer = null;

    this.canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (performance.now() - this._stateChangeTime < 300) return;
      moved = false;
      const sx = e.screenX, sy = e.screenY;
      const dragTimer = setTimeout(() => {
        this._dragTimer = null;
        document.removeEventListener('mousemove', onPreMove);
        document.removeEventListener('mouseup', onPreUp);
        this._edgePhase = null; this._edgeSide = null;
        this._dragPhase = null; this._struggleStartTime = null;
        this._dragStartTime = performance.now();
        this._dragPhase = 'relaxed';
        this._dragTarget = { x: sx, y: sy, lastX: sx, lastY: sy };
        this._setState('dragged');
        moved = true;
        this._onMove = e2 => {
          if (this._edgePhase) {
            if (performance.now() - this._edgeStartTime > 200) {
              this._edgePhase = null; this._edgeSide = null;
              this._dragPhase = 'relaxed';
              this._dragStartTime = performance.now();
              this._setState('dragged');
            }
          }
          if (!this._dragTarget) return;
          this._dragTarget.x = e2.screenX;
          this._dragTarget.y = e2.screenY;
        };
        this._onUp = () => {
          if (!this._edgePhase) {
            this._dragTarget = null; this._dragPhase = null; this._struggleStartTime = null;
            this._setState('idle');
          }
          document.removeEventListener('mousemove', this._onMove);
          document.removeEventListener('mouseup', this._onUp);
          this._onMove = null; this._onUp = null;
        };
        document.addEventListener('mousemove', this._onMove);
        document.addEventListener('mouseup', this._onUp);
      }, 300);
      this._dragTimer = dragTimer;
      const onPreMove = ev => {}; // 占位，仅用于下面 removeEventListener
      const onPreUp = () => {
        clearTimeout(dragTimer);
        this._dragTimer = null;
        document.removeEventListener('mousemove', onPreMove);
        document.removeEventListener('mouseup', onPreUp);
      };
      document.addEventListener('mousemove', onPreMove);
      document.addEventListener('mouseup', onPreUp);
    });
    this.canvas.addEventListener('dblclick', () => { if (!this._edgePhase && this._dragPhase !== 'struggling') this._setState('jumping'); });
    this.canvas.addEventListener('click', () => { if (!this._edgePhase && this._dragPhase !== 'struggling' && !moved) this._setState('waving'); });
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this._dragTarget = null; this._dragPhase = null; this._struggleStartTime = null;
      this._edgePhase = null; this._edgeSide = null;
      if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null; }
      if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null; }
      if (this._dragTimer) { clearTimeout(this._dragTimer); this._dragTimer = null; }
      require('electron').ipcRenderer.send('show-context-menu');
    });
    require('electron').ipcRenderer.on('set-state', (_, s) => { this.userState = s; this._setState(s); });
  }

  _loop(prev = 0) {
    const now = performance.now();

    let dx = 0, dy = 0;

    // 边缘模式：动画接管位移
    if (this._edgePhase) {
      if (this._edgePhase === 'climb') {
        if (now - this._edgeStartTime >= 500) {
          dy = -this._edgeClimbSpeed;
        }
      } else if (this._edgePhase === 'jump') {
        const je = (now - this._edgeStartTime) / 1000;
        if (je > 2 && je <= 7) {
          const maxRise = this._edgeJumpStartY - this._screenWA.y;
          const actualRise = Math.min(120, maxRise);
          let targetY;
          if (je <= 4) {
            const rt = (je - 2) / 2;
            targetY = this._edgeJumpStartY - actualRise * (2 * rt - rt * rt);
          } else {
            const ft = (je - 4) / 3;
            targetY = this._edgeJumpStartY - actualRise + 120 * ft * ft;
          }
          dy = targetY - this._winY;
          dx = this._edgeSide === 'left' ? 1 : -1;
        }
      }
    } else if (this._dragTarget) {
      // 正常拖拽追踪
      dx = this._dragTarget.x - this._dragTarget.lastX;
      dy = this._dragTarget.y - this._dragTarget.lastY;
      this._dragTarget.lastX = this._dragTarget.x;
      this._dragTarget.lastY = this._dragTarget.y;
    }

    if (this._dragPhase === 'struggling' && this._struggleStartTime) {
      const se = now - this._struggleStartTime;
      if (se > 1000 && se <= 3000) {
        const t = (se - 1000) / 2000;
        dy += 1 + t * t * 4;
      }
    }
    if (this.walking && !this._dragTarget && !this._edgePhase) {
      const we = now - this.walkStartTime;
      if (we >= 10000) {
        this.walking = false;
        this._setState('idle');
      } else if (we < 9000) {
        dx += this.walkDir * (we >= 4300 ? 3 : 1.5);
        if (we >= 7000) {
          if (!this.walkJumpStartY) this.walkJumpStartY = this._winY;
          const jt = (we - 7000) / 2000;
          const targetY = this.walkJumpStartY - 40 * 4 * jt * (1 - jt);
          dy = targetY - this._winY;
        }
      }
    }

    // 更新追踪位置（IPC 回传修正漂移）
    this._winX += dx;
    this._winY += dy;

    if (dx !== 0 || dy !== 0) {
      require('electron').ipcRenderer.send('move-window', { dx, dy });
    }

    if (!this.video.draw()) {
      this.ctx.clearRect(0, 0, CELL_W, CELL_H);
    }

    // 边缘阶段切换（放 draw 后避免闪白）
    if (this._edgePhase) {
      if (this._edgePhase === 'cling' && now - this._edgeStartTime >= 3000) {
        this._edgePhase = 'climb';
        this._edgeStartTime = now;
        this._edgeClimbTarget = this._winY - (150 + Math.random() * 200);
        const distance = this._winY - this._edgeClimbTarget;
        const duration = 2 + Math.random() * 3; // 2~5 秒随机
        this._edgeClimbDuration = duration * 1000;
        this._edgeClimbSpeed = distance / (duration * 60);
        this._setState(this._edgeSide === 'left' ? 'edge-climb-left' : 'edge-climb-right');
      } else if (this._edgePhase === 'climb' && now - this._edgeStartTime >= this._edgeClimbDuration) {
        this._edgePhase = 'jump';
        this._edgeStartTime = now;
        this._edgeJumpStartY = this._winY;
        this._setState(this._edgeSide === 'left' ? 'edge-jump-left' : 'edge-jump-right');
      } else if (this._edgePhase === 'jump' && now - this._edgeStartTime >= 10000) {
        this._edgePhase = null; this._edgeSide = null;
        this._dragTarget = null; this._dragPhase = null;
        this._setState('idle');
      }
    }

    // 挣扎转换
    if (this._dragTarget && this._dragPhase === 'relaxed' && !this._edgePhase && now - this._dragStartTime >= 10000) {
      this._dragPhase = 'struggling';
      this._struggleStartTime = now;
      this._dragTarget = null;
      if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null; }
      if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null; }
      this._setState('struggling');
    }

    // 走步跳跃时到边缘 → 切换扒边
    if (this.walking && !this._edgePhase) {
      const we = now - this.walkStartTime;
      if (we >= 7000 && we < 8000) {
        const atLeft = this.walkDir === -1 && this._winX <= this._screenWA.x + 1;
        const atRight = this.walkDir === 1 && this._winX + CELL_W >= this._screenWA.x + this._screenWA.width - 1;
        if (atLeft || atRight) {
          this.walking = false;
          this._edgePhase = 'cling';
          this._edgeSide = atLeft ? 'left' : 'right';
          this._edgeStartTime = now;
          this._setState(atLeft ? 'edge-cling-left' : 'edge-cling-right');
        }
      }
    }

    // 边缘检测：拖到屏幕边缘触发攀爬
    if (this._dragTarget && this._dragPhase === 'relaxed' && !this._edgePhase) {
      const atLeft = this._winX <= this._screenWA.x + 1;
      const atRight = this._winX + CELL_W >= this._screenWA.x + this._screenWA.width - 1;
      if (atLeft || atRight) {
        this._edgePhase = 'cling';
        this._edgeSide = atLeft ? 'left' : 'right';
        this._edgeStartTime = now;
        this._dragPhase = null; // 脱离拖拽逻辑，避免挣扎冲突
        this._setState(atLeft ? 'edge-cling-left' : 'edge-cling-right');
      }
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
