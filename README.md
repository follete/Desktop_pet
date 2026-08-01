# 桌面宠物 · 年年

一只会动的桌面猫咪，支持 Mac 和 Windows。

## 功能

- 🎬 视频动画 — 流畅的桌宠体验
- 🐱 11 种状态：发呆、行走、挥手、跳跃、难过、等待、思考、检查、被拎起、挣扎
- 🖱️ 单击挥手，双击跳跃，右键菜单切换状态
- ✋ 按下拖动触发拎起动画，10 秒后挣扎下坠自动松手
- 📌 常驻桌面顶层，透明背景（绿幕抠图）

## 视频素材

11 段绿幕 MP4 放到 `assets/videos/`：

```
assets/videos/
├── idle.mp4           # 发呆
├── running-right.mp4  # 向右走
├── running-left.mp4   # 向左走（可选，无则镜像 right）
├── waving.mp4         # 挥手
├── jumping.mp4        # 跳跃
├── failed.mp4         # 难过
├── waiting.mp4        # 等待
├── running.mp4        # 思考
├── review.mp4         # 检查
├── dragged.mp4        # 被拎起（放松下垂，5 秒循环）
└── struggling.mp4     # 挣扎下坠（5 秒单次）
```

每个视频建议 3-10 秒，绿色背景尽量均匀纯色。

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

产物：`dist/DesktopPet-1.0.0.dmg`

**Windows：**

```bash
npm run build:win
# 国内网络慢加镜像：
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run build:win
```

产物：`dist/DesktopPet-Setup-1.0.0.exe`
