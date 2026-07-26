#!/usr/bin/env python3
"""单行动画预览：生成 GIF 动图并打开"""
import sys, subprocess
from pathlib import Path
from PIL import Image

DURATIONS = {
    "idle":           [280, 110, 110, 140, 140, 320],
    "running-right":  [120]*7 + [220],
    "running-left":   [120]*7 + [220],
    "waving":         [140, 140, 140, 140, 280],
    "jumping":        [140, 140, 140, 140, 280],
    "failed":         [140]*7 + [240],
    "waiting":        [150]*5 + [260],
    "running":        [120]*5 + [220],
    "review":         [150]*5 + [280],
}

def main():
    if len(sys.argv) < 2:
        print("用法: python3 preview_row.py <行名>")
        print("行名: idle / running-right / running-left / waving / jumping / failed / waiting / running / review")
        sys.exit(1)

    state = sys.argv[1]
    base = Path.home() / "Desktop" / "素材" / "年年" / state

    if not base.is_dir():
        print(f"找不到目录: {base}")
        sys.exit(1)

    files = sorted([f for f in base.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg')])
    if not files:
        print(f"{base} 里没有图片")
        sys.exit(1)

    print(f"{state}: {len(files)} 张图")

    CELL_W, CELL_H = 192, 208
    frames = []

    for f in files:
        img = Image.open(f).convert("RGBA")

        # 裁掉右下角水印
        w, h = img.size
        img = img.crop((0, 0, int(w * 0.92), int(h * 0.92)))

        # 自动去背景
        import numpy as np
        arr = np.array(img)
        corners = []
        for y in range(5):
            for x in range(5):
                corners.append(arr[y, x, :3])
                corners.append(arr[y, -1-x, :3])
                corners.append(arr[-1-y, x, :3])
                corners.append(arr[-1-y, -1-x, :3])
        bg = np.median(corners, axis=0).astype(int)
        diff = np.sqrt(np.sum((arr[:, :, :3].astype(float) - bg.astype(float)) ** 2, axis=2))
        arr[diff < 40, 3] = 0
        img = Image.fromarray(arr)

        # 裁剪 + 缩放
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        img.thumbnail((CELL_W * 0.85, CELL_H * 0.85), Image.LANCZOS)

        canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        canvas.paste(img, ((CELL_W - img.width) // 2, (CELL_H - img.height) // 2), img)
        frames.append(canvas)

    # 生成 GIF
    out = Path(__file__).parent.parent / "hatch-output" / "qa" / f"{state}.gif"
    out.parent.mkdir(parents=True, exist_ok=True)
    dur = DURATIONS.get(state, [200] * len(frames))
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=dur, loop=0, disposal=2)
    print(f"GIF: {out}")

    subprocess.run(["open", str(out)])

if __name__ == "__main__":
    main()
