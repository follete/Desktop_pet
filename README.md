# 桌面宠物

一只会动的桌面猫咪，支持 Mac 和 Windows。

## 功能

- 🎬 视频动画 — 流畅的桌宠体验
- 🐱 9 种状态：发呆、行走、挥手、跳跃、难过、等待、思考、检查
- 🖱️ 单击挥手，双击跳跃，右键菜单切换状态
- ↔️ 拖动移动位置，走路不超出屏幕
- 📌 常驻桌面顶层，透明背景

## 使用前准备

需要准备 9 段 **绿幕背景的 MP4 视频**（猫咪在纯绿色背景前）。

文件放到 `assets/videos/` 目录下：

```
assets/videos/
├── idle.mp4           # 发呆
├── running-right.mp4  # 向右走
├── running-left.mp4   # 向左走（可选，没有则自动镜像 running-right）
├── waving.mp4         # 挥手
├── jumping.mp4        # 跳跃
├── failed.mp4         # 难过
├── waiting.mp4        # 等待
├── running.mp4        # 思考
└── review.mp4         # 检查
```

每个视频建议 3-10 秒，绿色背景尽量均匀。

可选：放一个 `assets/icon.png` 作为托盘图标（方形 PNG，建议 512×512）。

## 运行

开发模式：
```bash
npm install
npm start
```

打包应用：
```bash
npm run build
```
