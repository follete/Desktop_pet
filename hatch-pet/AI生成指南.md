# AI 生图说明书

你需要生成 **1 张 base 图 + 9 张行动画条带**，共 10 张图片。

---

## 通用规则（所有图片）

| 要求 | 说明 |
|------|------|
| 背景色 | **纯色 #00FF00（亮绿）**，整个图片一种颜色，无渐变 |
| 格式 | PNG，RGBA 或 RGB 均可 |
| 无阴影 | 不要画投影、地面阴影、光环 |
| 无特效 | 不要速度线、星芒、灰尘、文字、UI 元素 |
| 角色一致 | 所有 10 张图中猫咪外观保持一致（颜色、比例、表情风格） |

---

## 步骤 1：生成 Base 图

**文件**：`decoded/base.png`
**尺寸**：192 × 208 px
**内容**：一只完整的猫咪正面/微侧面站立图，居中，填充 60-80% 画布

这是后续所有动画的“身份参考图”，其他 9 行必须和它长得一样。

```
┌──────────────┐
│              │
│    🐱        │
│   /█\        │
│   │ │        │
│   │ │        │
│              │
└──────────────┘
    192×208
```

---

## 步骤 2：生成 9 行动画条带

每行多个帧水平排列成一条。每条有对应的 **layout guide**（`references/layout-guides/<state>.png`）告诉 AI 帧数和位置。

生图时把 **layout guide + base 图 + prompt** 一起发给 AI。

### 行 0：idle（发呆）— 6 帧

**条带尺寸**：1152 × 208 px（6 × 192）
**内容**：猫咪安静站立，轻微呼吸起伏 + 眨眼，6 帧间有微小变化

### 行 1：running-right（向右走）— 8 帧

**条带尺寸**：1536 × 208 px（8 × 192）
**内容**：猫咪向右行走的踏步循环，腿和身体有走路动态

### 行 2：running-left（向左走）— 8 帧

**条带尺寸**：1536 × 208 px（8 × 192）
**内容**：猫咪向左行走。可以镜像 running-right 生成（如果角色是对称的）

### 行 3：waving（挥手）— 4 帧

**条带尺寸**：768 × 208 px（4 × 192）
**内容**：猫咪抬起一只爪子打招呼：放下→抬起→挥动→放下

### 行 4：jumping（跳跃）— 5 帧

**条带尺寸**：960 × 208 px（5 × 192）
**内容**：猫咪跳跃：下蹲→起跳→空中→下落→落地

### 行 5：failed（失败/难过）— 8 帧

**条带尺寸**：1536 × 208 px（8 × 192）
**内容**：猫咪垂头丧气，耳朵耷拉，眼睛变眯眯眼或泪眼（可加附着的小泪滴）

### 行 6：waiting（等待）— 6 帧

**条带尺寸**：1152 × 208 px（6 × 192）
**内容**：猫咪期待地望着上方/前方，像在等主人投喂

### 行 7：running（工作/思考）— 6 帧

**条带尺寸**：1152 × 208 px（6 × 192）
**内容**：猫咪专注思考——歪头、抬眼、轻轻晃动。注意：这行不是脚跑步，是脑力工作！

### 行 8：review（检查）— 6 帧

**条带尺寸**：1152 × 208 px（6 × 192）
**内容**：猫咪眯眼审视，身体微微前倾，像在仔细看什么东西

---

## 用 ComfyUI 生图的建议

### 需要的工作流节点

```
LoadImage (base + layout guide)
    ↓
LoadCheckpoint (SDXL 或 Flux)
    ↓
CLIPTextEncode (prompt 文本)
    ↓
IPAdapter / ReferenceOnly (把 base 图作为风格/身份参考)
    ↓
ControlNet Canny/Lineart (把 layout guide 作为结构约束)
    ↓
KSampler → VAEDecode → SaveImage
```

### 关键技巧

1. **IPAdapter 或 IP-Adapter Face ID**：把 base 图作为参考，锁定角色外观一致性
2. **ControlNet Canny**：把 layout guide 的边缘图输入 ControlNet，约束帧的位置
3. **低 denoise**（0.6-0.75）：保留 layout guide 的结构同时有足够创意
4. **每次生成都用同一张 base 图**：确保 9 行角色一致

### 如果没有 IPAdapter

用 **img2img + 手动 prompt 描述外观** 替代：
- 每行 prompt 里写清楚：橘色短毛猫、圆脸、绿眼睛、白色肚皮...
- 把 base 图作为 img2img 输入
- 多次尝试直到角色外观一致

---

## 生图完成后

1. 把图片放到对应位置：
   ```
   hatch-output/decoded/base.png        # base
   hatch-output/decoded/idle.png        # 6帧条带
   hatch-output/decoded/running-right.png
   ...等 9 个
   ```

2. 更新 job 状态（或用脚本批量处理）：
   编辑 `hatch-output/imagegen-jobs.json`，把完成行的 `status` 改为 `"complete"`

3. 运行拼图流水线：
   ```bash
   cd /Users/nora.zhang/Desktop/Desktop_pet
   python3 hatch-pet/scripts/extract_strip_frames.py \
     --decoded-dir hatch-output/decoded \
     --output-dir hatch-output/frames \
     --states all --method auto

   python3 hatch-pet/scripts/compose_atlas.py \
     --frames-root hatch-output/frames \
     --output hatch-output/final/spritesheet.png \
     --webp-output hatch-output/final/spritesheet.webp

   python3 hatch-pet/scripts/validate_atlas.py \
     hatch-output/final/spritesheet.webp \
     --json-out hatch-output/final/validation.json

   python3 hatch-pet/scripts/make_contact_sheet.py \
     hatch-output/final/spritesheet.webp \
     --output hatch-output/qa/contact-sheet.png
   ```

4. 验证通过后，精灵图放在 `hatch-output/final/spritesheet.webp`，可以直接被桌面宠物播放器使用。
