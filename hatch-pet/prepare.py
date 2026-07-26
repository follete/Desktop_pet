#!/usr/bin/env python3
"""
 hatch-pet 简化版准备脚本
 生成 layout guides + prompts + job manifest
 用户自行负责 AI 生图部分（用任何工具：ComfyUI / DALL-E / SD / Midjourney 等）
"""
import argparse, json, os, sys
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw

# === 精灵图规范（Codex 兼容） ===
CELL_W, CELL_H = 192, 208
COLS, ROWS = 8, 9
SAFE_X, SAFE_Y = 18, 16  # 安全区域边距

# === 9 行动画定义 ===
ROW_SPECS = [
    ("idle",          0, 6, "发呆呼吸/眨眼"),
    ("running-right", 1, 8, "向右行走"),
    ("running-left",  2, 8, "向左行走"),
    ("waving",        3, 5, "挥手打招呼"),
    ("jumping",       4, 5, "跳跃"),
    ("failed",        5, 8, "失败/难过"),
    ("waiting",       6, 6, "等待输入"),
    ("running",       7, 6, "工作中"),
    ("review",        8, 6, "检查/思考"),
]

# === 文件路径 ===
GUIDE_DIR = "references/layout-guides"
PROMPT_DIR = "prompts/rows"
RETRY_PROMPT_DIR = "prompts/row-retries"

# === Layout Guide 生成 ===
def create_layout_guide(path, state, frames):
    """生成水平条带的布局引导图"""
    width = frames * CELL_W
    height = CELL_H
    img = Image.new("RGB", (width, height), "#F7F7F7")
    draw = ImageDraw.Draw(img)

    for i in range(frames):
        left = i * CELL_W
        right = left + CELL_W - 1

        # 黑色外框
        draw.rectangle((left, 0, right, height - 1), outline="#111111", width=2)

        # 蓝色内框（安全区域）
        sl, st = left + SAFE_X, SAFE_Y
        sr, sb = right - SAFE_X, height - 1 - SAFE_Y
        draw.rectangle((sl, st, sr, sb), outline="#2F80ED", width=2)

        # 十字中心线（虚线）
        cx, cy = left + CELL_W // 2, height // 2
        for y in range(st, sb, 5):
            draw.line((cx, y, cx, min(y + 3, sb)), fill="#B8B8B8")
        for x in range(sl, sr, 5):
            draw.line((x, cy, min(x + 3, sr), cy), fill="#B8B8B8")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return path


# === Prompt 生成 ===
def make_base_prompt(pet_name, description, style, chroma_key):
    return f"""# Base Pet: {pet_name}

Create a single centered full-body character sprite on a flat chroma-key background.

## Character
{description}

## Style
{style}

## Output requirements
- One centered full-body character, front-facing or 3/4 view
- Flat chroma-key background: {chroma_key} (bright green, easily removable)
- No shadows, no scenery, no text, no logos, no UI elements
- The character must fill roughly 60-80% of the frame
- Output: single PNG image with the character centered
- Frame size: {CELL_W}x{CELL_H} pixels
- The character should be readable as a small sprite

## Purpose
This is the identity reference for all subsequent animations.
All other poses will be derived from this character's appearance.
"""


def make_row_prompt(pet_name, description, state, frames, purpose, chroma_key):
    state_instructions = {
        "idle": "Calm resting loop. Subtle breathing motion, tiny blink, slight head/body bob. Keep motion quiet and persona-preserving. Do NOT show waving, walking, running, jumping, talking, or large gestures.",
        "running-right": "Rightward movement loop. Show directional movement to the RIGHT through body and limb poses. Body and limbs should show stride motion. Do NOT draw speed lines, dust, motion trails, or floor shadows.",
        "running-left": "Leftward movement loop. Show directional movement to the LEFT through body and limb poses. Body and limbs should show stride motion. Do NOT draw speed lines, dust, motion trails, or floor shadows.",
        "waving": "Greeting/attention gesture. Paw/limb starts down, raises up in a wave, and returns. Clear friendly attention gesture. Do NOT draw wave marks, motion arcs, or floating effects.",
        "jumping": "Jump loop: anticipation (crouch) → lift → airborne peak → descent → settle. Show vertical motion through body position. Do NOT draw shadows, dust, landing marks, or impact bursts.",
        "failed": "Failed/sad reaction. Slumped or deflated posture, sad/closed eyes. Small attached tears or smoke puffs allowed. Do NOT draw red X marks, floating symbols, or detached effects.",
        "waiting": "Expectant asking pose. Looking up/forward with attentive expression. Blocked-on-user-input state.",
        "running": "Active task work state. Focused processing, thinking, scanning, or effortful concentration. This is NOT foot-running — avoid jogging, sprinting, treadmill motion, speed lines.",
        "review": "Focused inspection. Lean forward, blink, narrowed eyes, head tilt, or paw pose. Inspecting output.",
    }

    instruction = state_instructions.get(state, "")

    return f"""# Row Strip: {pet_name} — {state}

Generate a horizontal strip of {frames} frames for the "{state}" animation.

## Character Identity
Use the canonical base image as the identity reference.
{description}

## Animation: {purpose}
{instruction}

## Layout
- Generate exactly {frames} equally-spaced sprite cells in a single horizontal strip
- Each cell: {CELL_W}x{CELL_H} pixels
- Total strip width: {frames * CELL_W} pixels, height: {CELL_H} pixels
- Center each character pose inside its cell's safe area (see layout guide)
- The layout guide shows cell boundaries — use for spacing only, do NOT include guide lines in output

## Background
- Flat chroma-key background: {chroma_key}
- One solid color across the entire strip, no gradients

## Output format
- Single PNG image, exactly {frames * CELL_W}x{CELL_H} pixels
- All {frames} frames must be present in order
- Each character must be fully inside its cell, not clipped or overlapping
- No text, no UI, no labels, no frame numbers
"""


def make_retry_prompt(pet_name, description, state, frames, purpose, chroma_key):
    base = make_row_prompt(pet_name, description, state, frames, purpose, chroma_key)
    return base + "\n\n## RETRY NOTE\nPrevious generation was rejected. Please ensure:\n- Exact frame count: exactly {frames} frames\n- Flat chroma-key background without variation\n- Character identity matches the canonical base exactly\n- No guide lines, boxes, or center marks in output\n"


def main():
    parser = argparse.ArgumentParser(description="hatch-pet 准备脚本")
    parser.add_argument("--pet-name", required=True, help="宠物名称")
    parser.add_argument("--description", required=True, help="宠物描述（1-3句话）")
    parser.add_argument("--style", default="flat cartoon, simple shapes, bold colors, cute mascot style", help="风格描述")
    parser.add_argument("--chroma-key", default="#00FF00", help="色键背景色（#RRGGBB）")
    parser.add_argument("--output-dir", default="./hatch-output", help="输出目录")
    parser.add_argument("--reference", action="append", help="参考图片路径（可多次指定）")
    args = parser.parse_args()

    run_dir = Path(args.output_dir).resolve()
    run_dir.mkdir(parents=True, exist_ok=True)

    print(f"🐱 准备宠物: {args.pet_name}")
    print(f"📁 输出目录: {run_dir}")
    print()

    # 1. 生成 Layout Guides
    print("📐 生成 Layout Guides...")
    guides = []
    for state, row, frames, purpose in ROW_SPECS:
        guide_path = run_dir / GUIDE_DIR / f"{state}.png"
        create_layout_guide(guide_path, state, frames)
        guides.append({"state": state, "frames": frames, "path": str(guide_path.relative_to(run_dir))})
        print(f"   ✓ {state} ({frames}格) → {guide_path.name}")

    # 2. 生成 Prompts
    print()
    print("📝 生成 Prompts...")
    prompt_dir = run_dir / PROMPT_DIR
    retry_dir = run_dir / RETRY_PROMPT_DIR
    prompt_dir.mkdir(parents=True, exist_ok=True)
    retry_dir.mkdir(parents=True, exist_ok=True)

    # base prompt
    base_prompt = make_base_prompt(args.pet_name, args.description, args.style, args.chroma_key)
    (run_dir / "prompts/base-pet.md").write_text(base_prompt, encoding="utf-8")
    print(f"   ✓ base-pet.md")

    # row prompts
    for state, row, frames, purpose in ROW_SPECS:
        p = make_row_prompt(args.pet_name, args.description, state, frames, purpose, args.chroma_key)
        r = make_retry_prompt(args.pet_name, args.description, state, frames, purpose, args.chroma_key)
        (prompt_dir / f"{state}.md").write_text(p, encoding="utf-8")
        (retry_dir / f"{state}.md").write_text(r, encoding="utf-8")
        print(f"   ✓ prompts/rows/{state}.md")

    # 3. 生成 Job Manifest
    print()
    print("📋 生成 Job Manifest...")

    jobs = [
        {
            "id": "base",
            "kind": "base-pet",
            "status": "pending",
            "prompt_file": "prompts/base-pet.md",
            "output_path": "decoded/base.png",
            "depends_on": [],
            "output_spec": f"Single full-body character, {CELL_W}x{CELL_H}px, chroma-key {args.chroma_key}",
        }
    ]

    for state, row, frames, purpose in ROW_SPECS:
        depends = ["base"]
        if state == "running-left":
            depends.append("running-right")

        jobs.append({
            "id": state,
            "kind": "row-strip",
            "status": "pending",
            "prompt_file": f"prompts/rows/{state}.md",
            "retry_prompt_file": f"prompts/row-retries/{state}.md",
            "layout_guide": f"{GUIDE_DIR}/{state}.png",
            "output_path": f"decoded/{state}.png",
            "depends_on": depends,
            "output_spec": f"{frames} equally-spaced cells in horizontal strip, {frames * CELL_W}x{CELL_H}px, chroma-key {args.chroma_key}",
        })

    manifest = {
        "schema_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "pet_name": args.pet_name,
        "description": args.description,
        "style": args.style,
        "chroma_key": args.chroma_key,
        "cell_size": f"{CELL_W}x{CELL_H}",
        "rows": [{"state": s, "row": r, "frames": f, "purpose": p} for s, r, f, p in ROW_SPECS],
        "layout_guides": guides,
        "jobs": jobs,
    }

    (run_dir / "imagegen-jobs.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # 4. 创建必要的目录
    (run_dir / "decoded").mkdir(exist_ok=True)
    (run_dir / "frames").mkdir(exist_ok=True)
    (run_dir / "final").mkdir(exist_ok=True)
    (run_dir / "qa").mkdir(exist_ok=True)

    # 5. 输出摘要
    print()
    print("=" * 60)
    print("✅ 准备完成！")
    print()
    print("📂 目录结构：")
    for root, dirs, files in os.walk(run_dir):
        level = root.replace(str(run_dir), "").count(os.sep)
        indent = "  " * level
        print(f"  {indent}{os.path.basename(root)}/")
        sub_indent = "  " * (level + 1)
        for f in sorted(files):
            print(f"  {sub_indent}{f}")
    print()
    print("📋 下一步（你需要手动完成）：")
    print("   1. 生成 base 图 → 放到 decoded/base.png")
    print("   2. 对每行动画，参考 prompts/rows/<state>.md + layout guide")
    print("   3. 生成行条带 PNG → 放到 decoded/<state>.png")
    print("   4. 标记 imagegen-jobs.json 中对应 job 的 status 为 'complete'")
    print()
    print("⚙️  所有行完成后运行：")
    print(f"   python3 hatch-pet/scripts/extract_strip_frames.py --decoded-dir {run_dir}/decoded --output-dir {run_dir}/frames --states all --method auto")
    print(f"   python3 hatch-pet/scripts/compose_atlas.py --frames-root {run_dir}/frames --output {run_dir}/final/spritesheet.png --webp-output {run_dir}/final/spritesheet.webp")
    print(f"   python3 hatch-pet/scripts/validate_atlas.py {run_dir}/final/spritesheet.webp --json-out {run_dir}/final/validation.json")
    print(f"   python3 hatch-pet/scripts/make_contact_sheet.py {run_dir}/final/spritesheet.webp --output {run_dir}/qa/contact-sheet.png")
    print()


if __name__ == "__main__":
    main()
