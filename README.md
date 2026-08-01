# 桌面宠物 · 年年

一只会动的桌面猫咪，支持 Mac 和 Windows。

## 功能

- 🎬 视频动画 — 流畅的桌宠体验
- 🐱 14 种状态：发呆、行走、挥手、跳跃、难过、等待、思考、检查、被拎起、挣扎、扒边、上爬、蹬墙跳
- 🖱️ 单击挥手，双击跳跃，右键菜单切换状态
- ✋ 拖拽触发拎起动画，10 秒未松手自动挣扎下坠
- 🧗 拖到屏幕边缘自动扒边 → 上爬 → 蹬墙跳出
- 📌 常驻桌面顶层，透明背景（绿幕抠图）

## 视频素材

14 段绿幕 MP4 放到 `assets/videos/`：

```
assets/videos/
├── idle.mp4              # 发呆（任意时长，循环）
├── running-right.mp4     # 向右走（任意时长，循环）
├── running-left.mp4      # 向左走（可选，无则镜像 right）
├── waving.mp4            # 挥手（任意时长）
├── jumping.mp4           # 跳跃（任意时长）
├── failed.mp4            # 难过（任意时长）
├── waiting.mp4           # 等待（任意时长）
├── running.mp4           # 思考（任意时长）
├── review.mp4            # 检查（任意时长）
├── dragged.mp4           # 被拎起放松（5 秒，自动循环）
├── struggling.mp4        # 挣扎（5 秒，单次）
├── edge-cling-left.mp4   # 扒住左边缘（3 秒，循环）
├── edge-climb-left.mp4   # 沿左边缘上爬（5 秒，循环）
└── edge-jump-left.mp4    # 蹬左墙跳出（10 秒，循环）
```

> 右边三个视频（edge-cling-right 等）无需提供，代码会自动镜像左侧视频。

### 时长和动作对应

| 视频 | 时长 | 播放方式 | 窗口动作说明 |
|------|------|----------|-------------|
| **dragged** | 5s | 循环 | 全程跟随鼠标 |
| **struggling** | 5s | 单次 | 0-1s 原地挣扎，1-3s 窗口加速下坠，3s 后落定 |
| **edge-cling** | 3s | 循环 | 窗口不动，扒在屏幕边缘 |
| **edge-climb** | 5s | 循环 | 0.5s 后开始向上移动，2~5 秒随机爬升时长 |
| **edge-jump** | 10s | 循环 | 0-2s 停顿，2-4s 抛物线上升，4-7s 下落，7-10s 静止落地 |

### 通用要求

- 正方形画面
- 绿色背景尽量均匀纯色（RGB 绿 250+，红蓝 50 以下），与角色颜色有明显区分

可选：`assets/icon.png` 作为托盘图标（方形 PNG，建议 512×512）。

## 运行

```bash
npm install
npm start
```

## 打包

**Mac：**

```bash
npm run build:mac
# 国内网络慢加镜像：
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run build:mac
```

产物：`dist/DesktopPet-1.0.2.dmg`

**Windows：**

```bash
npm run build:win
# 国内网络慢加镜像：
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run build:win
```

产物：`dist/DesktopPet-Setup-1.0.2.exe`
