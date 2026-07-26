#!/usr/bin/env python3
"""
生成 Codex 兼容格式的程序化卡通橘猫精灵图。
输出：assets/spritesheet.png (1536×1872, 8列×9行, 192×208/格)
9 行 = idle | running-right | running-left | waving | jumping | failed | waiting | running | review
"""
from PIL import Image, ImageDraw
import math, os

W, H = 192, 208          # 单格尺寸
COLS, ROWS = 8, 9        # 8列9行
ATLAS_W = COLS * W       # 1536
ATLAS_H = ROWS * H       # 1872

# 猫咪颜色
CAT_ORANGE = (255, 165, 60)
CAT_LIGHT  = (255, 200, 140)
CAT_WHITE  = (255, 255, 255)
CAT_EYE    = (40, 40, 40)
CAT_NOSE   = (255, 100, 100)
CAT_MOUTH  = (80, 60, 60)

def draw_cat(draw, cx, cy, scale=1.0, **kwargs):
    """在坐标 (cx,cy) 画一只简笔猫，cx/cy 是身体中心"""
    s = scale
    # 身体（椭圆）
    body_w, body_h = int(70*s), int(50*s)
    draw.ellipse([cx-body_w//2, cy-body_h//2, cx+body_w//2, cy+body_h//2], fill=CAT_ORANGE)
    # 白肚皮
    belly_w, belly_h = int(36*s), int(30*s)
    draw.ellipse([cx-belly_w//2, cy-belly_h//2+int(6*s), cx+belly_w//2, cy+belly_h//2+int(6*s)], fill=CAT_WHITE)

    # 头（圆）
    head_r = int(28*s)
    head_x, head_y = cx, cy - body_h//2 - head_r + int(6*s)
    draw.ellipse([head_x-head_r, head_y-head_r, head_x+head_r, head_y+head_r], fill=CAT_ORANGE)

    # 耳朵
    ear_h = int(16*s)
    ear_w = int(12*s)
    for ex in [head_x - int(18*s), head_x + int(6*s)]:
        draw.polygon([ex, head_y-head_r+int(4*s), ex-ear_w//2, head_y-head_r-ear_h, ex+ear_w//2, head_y-head_r+int(4*s)], fill=CAT_ORANGE)
        draw.polygon([ex, head_y-head_r+int(8*s), ex-ear_w//4, head_y-head_r-int(ear_h*0.6), ex+ear_w//4, head_y-head_r+int(8*s)], fill=CAT_LIGHT)

    # 眼睛
    eye_y = head_y - int(4*s)
    blink = kwargs.get('blink', 0)  # 0=正常, 1=半闭, 2=全闭
    for ex in [head_x - int(9*s), head_x + int(9*s)]:
        if blink == 2:
            draw.line([ex-int(5*s), eye_y, ex+int(5*s), eye_y], fill=CAT_EYE, width=2)
        elif blink == 1:
            draw.ellipse([ex-int(4.5*s), eye_y-int(2*s), ex+int(4.5*s), eye_y+int(2*s)], fill=CAT_EYE)
        else:
            draw.ellipse([ex-int(4.5*s), eye_y-int(6*s), ex+int(4.5*s), eye_y+int(5*s)], fill=CAT_WHITE)
            draw.ellipse([ex-int(2.5*s), eye_y-int(3*s), ex+int(2.5*s), eye_y+int(2*s)], fill=CAT_EYE)

    # 鼻子
    nose_y = eye_y + int(8*s)
    draw.polygon([head_x-int(2*s), nose_y, head_x+int(2*s), nose_y, head_x, nose_y+int(3*s)], fill=CAT_NOSE)

    # 嘴
    mouth = kwargs.get('mouth', 0)  # 0=正常, 1=开心, 2=难过
    mouth_y = nose_y + int(4*s)
    if mouth == 1:
        draw.arc([head_x-int(6*s), mouth_y-int(4*s), head_x+int(6*s), mouth_y+int(4*s)], 0, 180, fill=CAT_MOUTH, width=2)
    elif mouth == 2:
        draw.arc([head_x-int(6*s), mouth_y, head_x+int(6*s), mouth_y+int(8*s)], 180, 0, fill=CAT_MOUTH, width=2)
    else:
        draw.arc([head_x-int(3*s), mouth_y-int(2*s), head_x, mouth_y+int(2*s)], 0, 180, fill=CAT_MOUTH, width=1)
        draw.arc([head_x, mouth_y-int(2*s), head_x+int(3*s), mouth_y+int(2*s)], 0, 180, fill=CAT_MOUTH, width=1)

    # 腿（4条短腿）
    leg_w, leg_h = int(10*s), int(16*s)
    for lx in [cx-int(18*s), cx+int(8*s)]:
        draw.rounded_rectangle([lx-leg_w//2, cy+body_h//2-int(6*s), lx+leg_w//2, cy+body_h//2+leg_h-int(6*s)], radius=4, fill=CAT_ORANGE)

    # 尾巴
    tail = kwargs.get('tail', 0)  # 0=自然, 1=翘起, 2=下垂
    tail_start = (cx+body_w//2-int(4*s), cy-body_h//4)
    if tail == 1:
        draw.arc([cx+body_w//2, cy-body_h-int(20*s), cx+body_w//2+int(30*s), cy-body_h+int(20*s)], 180, 270, fill=CAT_ORANGE, width=int(6*s))
    elif tail == 2:
        draw.arc([cx+body_w//2, cy-body_h//2, cx+body_w//2+int(20*s), cy-body_h//2+int(20*s)], 270, 360, fill=CAT_ORANGE, width=int(6*s))
    else:
        draw.arc([cx+body_w//2-int(10*s), cy-body_h//2-int(16*s), cx+body_w//2+int(20*s), cy-body_h//2+int(16*s)], 240, 330, fill=CAT_ORANGE, width=int(6*s))

    # 胡须
    whisker_y = nose_y + int(1*s)
    for side in [-1, 1]:
        wx = head_x + side * int(14*s)
        for angle in [0, 15, -15]:
            rad = math.radians(180 if side == -1 else 0) + math.radians(angle)
            ex = wx + side * int(14*s) * math.cos(rad)
            ey = whisker_y + int(14*s) * math.sin(rad)
            draw.line([wx, whisker_y, int(ex), int(ey)], fill=CAT_MOUTH, width=1)

    return head_x, head_y  # 头部位置，供后续合成用


def draw_frame(row_idx, col_idx, scale=1.0):
    """画一帧到 Image"""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = W//2, H//2 + 20  # 身体中心（偏下，给头部留空间）
    fraction = col_idx / max(1, FRAME_COUNTS[row_idx] - 1)

    # azs 各行的动画参数
    if row_idx == 0:  # idle — 轻微呼吸 + 眨眼
        breath = math.sin(fraction * math.pi * 2) * 3
        blink = 1 if 0.45 < fraction < 0.55 else 0
        draw_cat(draw, cx, cy + int(breath), scale, blink=blink)

    elif row_idx == 1:  # running-right — 向右移动
        bounce = abs(math.sin(fraction * math.pi * 2)) * 8
        lean = int(math.sin(fraction * math.pi * 2) * 4)
        leg_phase = int(fraction * 4) % 2
        draw_cat(draw, cx + lean, cy - int(bounce), scale, tail=1 if leg_phase else 0)

    elif row_idx == 2:  # running-left — 向左（镜像 running-right）
        bounce = abs(math.sin(fraction * math.pi * 2)) * 8
        lean = int(math.sin(fraction * math.pi * 2) * 4)
        leg_phase = int(fraction * 4) % 2
        draw_cat(draw, cx - lean, cy - int(bounce), scale, tail=1 if leg_phase else 0)

    elif row_idx == 3:  # waving — 挥手
        wave_h = int(math.sin(fraction * math.pi) * 20)
        draw_cat(draw, cx, cy, scale)

    elif row_idx == 4:  # jumping — 跳跃
        jump_h = -int(abs(math.sin(fraction * math.pi)) * 30)
        squash = 1.0 - 0.15 * abs(math.sin(fraction * math.pi * 2))
        draw_cat(draw, cx, cy + jump_h, scale * squash)

    elif row_idx == 5:  # failed — 难过
        tear_y = 15 + int(fraction * 8)
        draw_cat(draw, cx, cy, scale, mouth=2, tail=2)
        # 泪滴
        if col_idx % 2 == 0:
            draw.ellipse([cx-20, 45+tear_y, cx-12, 55+tear_y], fill=(100, 160, 255))

    elif row_idx == 6:  # waiting — 期待
        lean = int(math.sin(fraction * math.pi) * 6)
        draw_cat(draw, cx + lean, cy - 4, scale, tail=1)

    elif row_idx == 7:  # running — 工作/思考
        draw_cat(draw, cx, cy, scale)

    elif row_idx == 8:  # review — 检查
        tilt = int(math.sin(fraction * math.pi) * 5)
        draw_cat(draw, cx + tilt, cy, scale)

    return img


FRAME_COUNTS = [6, 8, 8, 4, 5, 8, 6, 6, 6]  # 对应 9 行

def main():
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))

    for row in range(ROWS):
        for col in range(COLS):
            if col < FRAME_COUNTS[row]:
                frame = draw_frame(row, col)
                atlas.paste(frame, (col * W, row * H))

    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "..", "assets", "spritesheet.png")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    atlas.save(out_path)
    print(f"生成精灵图: {out_path}")
    print(f"尺寸: {atlas.size}")
    print(f"帧数: 8列×9行 = {sum(FRAME_COUNTS)} 帧")

if __name__ == "__main__":
    main()
