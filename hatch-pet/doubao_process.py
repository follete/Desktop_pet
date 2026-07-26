#!/usr/bin/env python3
"""
豆包产出后处理脚本
将豆包生成的每帧独立图 → 裁剪去背景 → 缩放 → 拼接成 Codex 格式精灵图
"""
import os, sys, json
from pathlib import Path
from PIL import Image, ImageOps

CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 9

# 输入：豆包生成的图片目录（每行动画一个子目录）
# 目录结构：
#   input/
#     base.png (或 base/ 目录下单张)
#     idle/      → 6 张 PNG
#     running-right/ → 8 张
#     ...
#
# 输出：标准精灵图 spritesheet.png

def remove_watermark(img):
    """裁掉右下角水印区域"""
    w, h = img.size
    # 裁掉右下角 8% 的区域（水印通常在这里）
    crop_w = int(w * 0.92)
    crop_h = int(h * 0.92)
    return img.crop((0, 0, crop_w, crop_h))


def remove_background(img, tolerance=40):
    """自动探测背景色并移除，变为透明"""
    import numpy as np
    img = img.convert("RGBA")
    arr = np.array(img)

    # 采样四角 5px 宽的区域，取中位数作为背景色
    corners = []
    for y in range(5):
        for x in range(5):
            corners.append(arr[y, x, :3])
            corners.append(arr[y, -1-x, :3])
            corners.append(arr[-1-y, x, :3])
            corners.append(arr[-1-y, -1-x, :3])
    bg = np.median(corners, axis=0).astype(int)

    # 计算每个像素与背景色的欧氏距离
    diff = np.sqrt(np.sum((arr[:, :, :3].astype(float) - bg.astype(float)) ** 2, axis=2))

    # 距离小于容差的视为背景
    mask = diff < tolerance
    arr[mask, 3] = 0

    return Image.fromarray(arr)

def crop_to_content(img, padding=4):
    """裁剪到非透明内容区域"""
    bbox = img.getbbox()
    if bbox is None:
        return img
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(img.width, bbox[2] + padding)
    bottom = min(img.height, bbox[3] + padding)
    return img.crop((left, top, right, bottom))

def process_row(files, expected, mirror=False):
    """处理一行所有帧，统一裁剪缩放保证大小一致"""
    import numpy as np
    frames = []
    bboxes = []

    for f in files[:expected]:
        img = Image.open(f)
        img = remove_watermark(img)
        img = remove_background(img)
        bbox = img.getbbox()
        if bbox:
            bboxes.append(bbox)
        frames.append((img, bbox))

    if not bboxes:
        return [Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))] * expected

    # 取所有帧的最大包围盒
    max_left = min(b[0] for b in bboxes)
    max_top = min(b[1] for b in bboxes)
    max_right = max(b[2] for b in bboxes)
    max_bottom = max(b[3] for b in bboxes)

    # 统一裁剪到相同区域
    results = []
    for img, _ in frames:
        img = img.crop((max_left, max_top, max_right, max_bottom))
        if mirror:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)

        # 统一缩放到固定高度
        img_w, img_h = img.size
        target_h = int(CELL_H * 0.75)
        scale = target_h / img_h
        new_w, new_h = int(img_w * scale), target_h
        if new_w > CELL_W * 0.85:
            scale = (CELL_W * 0.85) / img_w
            new_w, new_h = int(img_w * scale), int(img_h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

        canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        canvas.paste(img, ((CELL_W - new_w) // 2, (CELL_H - new_h) // 2), img)
        results.append(canvas)

    return results

ROW_SPECS = [
    ("idle", 0, 6),
    ("running-right", 1, 8),
    ("running-left", 2, 8),
    ("waving", 3, 5),
    ("jumping", 4, 5),
    ("failed", 5, 8),
    ("waiting", 6, 6),
    ("running", 7, 6),
    ("review", 8, 6),
]

def main():
    if len(sys.argv) < 2:
        input_dir = Path.home() / "Desktop" / "素材" / "年年"
        output = Path("assets/spritesheet.png")
    else:
        input_dir = Path(sys.argv[1])
        output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("assets/spritesheet.png")

    atlas = Image.new("RGBA", (COLS * CELL_W, ROWS * CELL_H), (0, 0, 0, 0))
    total = 0
    errors = []

    for state, row, expected in ROW_SPECS:
        # running-left 自动从 running-right 镜像
        if state == "running-left":
            right_dir = input_dir / "running-right"
            if right_dir.is_dir():
                files = sorted([f for f in right_dir.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')])
                try:
                    cells = process_row(files, expected, mirror=True)
                    for col, cell in enumerate(cells):
                        atlas.paste(cell, (col * CELL_W, row * CELL_H), cell)
                        total += 1
                except Exception as e:
                    errors.append(f"running-left: {e}")
            else:
                errors.append("running-left 需要 running-right 目录才能镜像")
            continue

        state_dir = input_dir / state
        if not state_dir.is_dir():
            errors.append(f"缺少目录: {state_dir}")
            continue

        files = sorted([f for f in state_dir.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')])
        if len(files) < expected:
            errors.append(f"{state}: 需要 {expected} 帧，找到 {len(files)}")

        try:
            cells = process_row(files, expected)
            for col, cell in enumerate(cells):
                atlas.paste(cell, (col * CELL_W, row * CELL_H), cell)
                total += 1
        except Exception as e:
            errors.append(f"{state}: {e}")

    if errors:
        print("⚠️  错误:")
        for e in errors:
            print(f"  - {e}")

    atlas.save(output)
    print(f"\n✅ 精灵图已生成: {output}")
    print(f"   尺寸: {atlas.size}")
    print(f"   帧数: {total}/58")

if __name__ == "__main__":
    main()
