#!/usr/bin/env python3
"""把视频中接近背景色的像素替换为纯亮绿色 #00FF00，解决阴影/噪点问题"""
import cv2
import numpy as np
import os

def detect_bg_color(frame, samples=256):
    """检测绿幕背景的主色调（同渲染器逻辑：四角采样取中位数）"""
    h, w = frame.shape[:2]
    pixels = []
    step = max(1, min(w, h) // 16)
    for y in range(0, min(h, step * 8), step):
        for x in range(0, min(w, step * 8), step):
            pixels.append(frame[y, x])
            pixels.append(frame[h-1-y, x])
            pixels.append(frame[y, w-1-x])
            pixels.append(frame[h-1-y, w-1-x])
    r_vals = sorted(p[2] for p in pixels)
    g_vals = sorted(p[1] for p in pixels)
    b_vals = sorted(p[0] for p in pixels)
    mid = len(pixels) // 2
    return (b_vals[mid], g_vals[mid], r_vals[mid])  # BGR

def fix_green_screen(input_path, tolerance=80):
    output_path = os.path.splitext(input_path)[0] + '_fixed.mp4'
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"无法打开: {input_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # 从第一帧检测背景色
    ret, first_frame = cap.read()
    if not ret:
        print("无法读取首帧")
        return
    bg = detect_bg_color(first_frame)
    print(f"  背景色 BGR=({bg[0]}, {bg[1]}, {bg[2]})")
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # 重置

    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        b = frame[:, :, 0].astype(np.float32)
        g = frame[:, :, 1].astype(np.float32)
        r = frame[:, :, 2].astype(np.float32)

        dist = np.sqrt((b - bg[0])**2 + (g - bg[1])**2 + (r - bg[2])**2)
        # 同时要求绿色主导（保护黄绿色眼睛）
        is_green = (g > r + 15) & (g > b + 15)
        mask = (dist < tolerance) & is_green

        # 替换为纯绿 #00FF00 = BGR(0, 255, 0)
        frame[mask] = (0, 255, 0)

        out.write(frame)
        frame_idx += 1
        if frame_idx % 30 == 0:
            print(f"  {os.path.basename(input_path)}: {frame_idx}/{total} 帧")

    cap.release()
    out.release()
    print(f"  完成 → {output_path}")

if __name__ == '__main__':
    videos_dir = '/Users/nora.zhang/Desktop/Desktop_pet/assets/videos'
    for name in ['dragged.mp4', 'struggling.mp4']:
        # 用原件（避免重复处理）
        orig = os.path.join(videos_dir, name.replace('.mp4', '_orig.mp4'))
        path = orig if os.path.exists(orig) else os.path.join(videos_dir, name)
        if os.path.exists(path):
            print(f"处理: {os.path.basename(path)}")
            fix_green_screen(path)
        else:
            print(f"跳过: {path}")
