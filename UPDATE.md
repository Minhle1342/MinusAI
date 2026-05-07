Đây là Agent Prompt hoàn chỉnh để giao cho AI nâng cấp toàn bộ logic:

# AGENT TASK: Nâng cấp Video AI Engine

## BỐI CẢNH DỰ ÁN
Đây là ứng dụng tạo video AI tự động chạy trên browser. Stack gồm:
- `index.html` — Giao diện với canvas 1280×720, panel điều khiển, audio settings
- `app.js` — Logic chính: gọi Gemini API, điều phối rendering, xử lý audio (Google TTS + ElevenLabs), record MediaStream
- `renderer.js` — Engine vẽ lên canvas từng scene

Giao diện hiện tại có sẵn:
- Input: videoPrompt (textarea), videoStyle (select), animStyleSelect (select), freeLangSelect, speechRate, voiceSelect (ElevenLabs)
- Canvas 1280×720 (#videoCanvas)
- Progress bar (#progressSection, #progressBar, #progressLabel, #progressPct)
- Play/Stop button (#playStopBtn), Download (#downloadLink)
- Settings modal: Gemini API key, ElevenLabs API key
- Tabs: Free TTS / ElevenLabs

## VẤN ĐỀ CẦN GIẢI QUYẾT
Script JSON cũ chỉ có các field đơn giản (animationStyle, backgroundTheme, accentColor).
Script JSON mới phức tạp hơn nhiều — cần nâng cấp toàn bộ renderer.js và app.js để xử lý.

---

## CẤU TRÚC JSON MỚI (đây là contract bất biến — không được thay đổi)

```json
{
  "videoTitle": "string",
  "style": "cinematic | educational | promotional | documentary | motivational | thriller | inspirational",
  "totalDuration": number,
  "globalTheme": {
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "mood": "intense | calm | playful | mysterious | energetic | nostalgic | urgent",
    "fontStyle": "bold-impact | elegant-serif | techy-mono | handwritten | condensed-dramatic",
    "transitionStyle": "cut | crossfade | whip-pan | glitch-wipe | dissolve | zoom-wipe"
  },
  "scenes": [
    {
      "id": number,
      "sceneTitle": "string (max 5 words)",
      "narration": "string",
      "estimatedDuration": number,
      "renderMode": "2d | 3d | handdrawn | whiteboard | particle | liquid | glitch | mixed",
      "background": {
        "type": "gradient | mesh-gradient | animated-particles | noise-field | solid | grid | aurora",
        "theme": "tech | space | nature | abstract | corporate | minimal | dark-cyber | warm-analog",
        "colors": ["#hex1", "#hex2"],
        "animated": boolean
      },
      "headlineText": "string",
      "subText": "string | null",
      "textAnimation": "typewriter | word-by-word | char-scatter | liquid-fill | glitch-reveal | hand-draw-text | split-reveal | magnetic-snap | countdown",
      "visualElements": [
        {
          "type": "text | shape | icon | stat-counter | chart-bar | timeline | 3d-object | illustration | progress-ring | floating-card",
          "content": "string",
          "position": "center | top | bottom | left | right | top-left | top-right | bottom-left | bottom-right | floating",
          "size": "small | medium | large | fullscreen",
          "entryAnimation": "fade | slide-up | slide-left | zoom-in | bounce | spin-in | draw-in | glitch-in | particle-assemble",
          "exitAnimation": "fade | slide-out | zoom-out | disintegrate | glitch-out | none",
          "delay": number,
          "loop": boolean
        }
      ],
      "camera": {
        "motion": "static | orbit | dolly-in | dolly-out | pan-left | pan-right | tilt-up | crane-up | shake | spiral",
        "speed": "slow | medium | fast",
        "fov": number
      },
      "overlayEffects": ["particles-float | scanlines | vignette | bloom | chromatic-aberration | film-grain | light-leaks | rain | snow | dust | bokeh | lens-flare"],
      "accentColor": "#hex",
      "hookType": "shocking-stat | open-question | bold-claim | dramatic-countdown | mystery-reveal | pain-point | viral-pattern-interrupt | none"
    }
  ]
}
```

---

## NHIỆM VỤ CỤ THỂ

### TASK 1 — Cập nhật Gemini prompt trong `app.js`
Thay toàn bộ system prompt cũ bằng prompt mới dưới đây.
Lưu ý: khi user chọn animStyleSelect !== "ai", inject thêm dòng:
`"Override rule: force textAnimation = '{selectedValue}' for ALL scenes."`
vào cuối prompt trước khi gửi API.

[CHÈN TOÀN BỘ PROMPT MỚI VÀO ĐÂY — đã được định nghĩa ở phần trên]

---

### TASK 2 — Viết lại `renderer.js` hoàn toàn

File renderer.js phải export một class hoặc object `VideoRenderer` với interface:

```javascript
const renderer = new VideoRenderer(canvas); // canvas là HTMLCanvasElement 1280×720
renderer.renderScene(scene, globalTheme, onComplete); 
// scene: object scene từ JSON
// globalTheme: object globalTheme từ JSON  
// onComplete: callback() khi scene kết thúc

renderer.stop(); // dừng scene hiện tại ngay lập tức
renderer.clear(); // xóa canvas về trạng thái trống
```

#### 2A. Background Engine
Implement `drawBackground(ctx, background, globalTheme, timestamp)`:
- `gradient`: vẽ linear/radial gradient từ background.colors
- `mesh-gradient`: vẽ nhiều radial gradient chồng nhau, animated nếu background.animated = true
- `animated-particles`: spawn ~80 particle nhỏ bay random trên background
- `noise-field`: dùng Perlin-like noise (viết thuần JS, không dùng thư viện) tạo texture lớp màu chuyển động chậm
- `solid`: fillRect màu đơn background.colors[0]
- `grid`: vẽ lưới kẻ ô vuông mờ trên nền tối (cyberpunk style)
- `aurora`: animate nhiều wave sin() màu pastel overlap nhau

#### 2B. renderMode Engine
Mỗi renderMode phải tạo cảm giác KHÁC NHAU rõ ràng:

**`2d`**: Motion graphics thuần canvas — shapes, flat illustration, bold colors
  - Dùng Canvas 2D API
  - Hiệu ứng: drop shadow, gradient fills, animated shapes geometry

**`3d`**: Giả lập 3D bằng Canvas 2D (KHÔNG dùng Three.js — browser artifact không load CDN)
  - Implement isometric projection hoặc perspective transform thuần toán học
  - Camera motion: dolly-in → scale scene từ 80% lên 120%; orbit → rotate các element quanh trục Y; shake → oscillate translate X/Y
  - Depth layers: background element nhỏ hơn, foreground element lớn hơn

**`handdrawn`**: SVG stroke animation style trên canvas
  - Vẽ các path với nét không hoàn hảo (jitter ±2px random trên từng điểm)
  - Animate stroke từ dashoffset 100% → 0% (draw-in effect)
  - Màu mực đậm, nền giấy (warm white hoặc kraft paper tone)

**`whiteboard`**: Giống handdrawn nhưng:
  - Nền trắng tinh
  - Nét bút marker (strokeWidth 3-5px, màu xanh dương hoặc đen)
  - Âm thanh "squeaky" không cần implement — chỉ visual
  - Text xuất hiện từng chữ như đang viết tay

**`particle`**: Particle system là NHÂN VẬT CHÍNH
  - Spawn 200-500 particle
  - Particle tạo hình chữ, shape, hoặc pattern tùy content
  - Implement particle-text: tính toán pixel của text rồi map particle vào vị trí đó
  - Animate: vỡ ra → tập hợp → giữ hình → vỡ ra lại

**`liquid`**: Fluid/blob morphing
  - Vẽ các blob hình tròn méo mó dùng bezier curves
  - Animate control points của bezier theo sin/cos với phase khác nhau
  - Colors gradient pha trộn giữa accentColor và background

**`glitch`**: Digital corruption dominant
  - Vẽ scene bình thường, sau đó apply:
    a. RGB channel split: vẽ lại scene với offset +5px red, -5px blue
    b. Horizontal scanline tears: random slice canvas và shift ngang
    c. Random rectangular noise patches
  - Glitch xảy ra burst 3-5 lần trong scene, không liên tục

**`mixed`**: Combine 2 modes
  - Parse renderMode nếu có dạng "2d+particle" hoặc đọc từ visualElements
  - Render background mode trước, foreground mode sau

#### 2C. textAnimation Engine
Implement `animateText(ctx, text, x, y, animation, style, duration)`:

- `typewriter`: reveal từng ký tự, cursor nhấp nháy ở cuối
- `word-by-word`: fade in từng word theo sequence
- `char-scatter`: các ký tự bay từ random position về đúng chỗ
- `liquid-fill`: text outline trước, sau đó fill dần lên từ dưới như đổ nước
- `glitch-reveal`: text xuất hiện kèm glitch noise, stabilize dần
- `hand-draw-text`: stroke path từng ký tự (dùng font outline approximation)
- `split-reveal`: text bị chia đôi ngang, 2 nửa trượt vào nhau
- `magnetic-snap`: các chữ bay vào từ nhiều hướng, "snap" vào vị trí với bounce nhỏ
- `countdown`: số đếm ngược (chỉ dùng khi hookType = dramatic-countdown)

#### 2D. visualElements Engine
Implement `renderVisualElement(ctx, element, sceneProgress, accentColor)`:

- `stat-counter`: số đếm từ 0 đến target value trong element.content (parse số từ string)
- `chart-bar`: vẽ bar chart đơn giản, bars grow từ 0 lên animated
- `timeline`: vẽ horizontal timeline với dots và labels
- `progress-ring`: SVG-style ring trên canvas, fill theo sceneProgress
- `floating-card`: rectangle với shadow và bo góc, nội dung text bên trong
- `shape`: hình học (circle/rect/hexagon/star) — parse từ content
- `illustration`: fallback — vẽ placeholder icon phù hợp với content keyword
- `3d-object`: dùng isometric rendering giả 3D

Position mapping lên canvas 1280×720:
- `center`: cx=640, cy=360
- `top`: cx=640, cy=120
- `bottom`: cx=640, cy=600
- `left`: cx=200, cy=360
- `right`: cx=1080, cy=360
- `top-left`: cx=200, cy=120
- `top-right`: cx=1080, cy=120
- `bottom-left`: cx=200, cy=600
- `bottom-right`: cx=1080, cy=600
- `floating`: cx và cy random seed dựa trên element index

#### 2E. overlayEffects Engine
Implement `applyOverlay(ctx, effects, timestamp, canvas)` — LUÔN chạy CUỐI CÙNG sau tất cả render:

- `vignette`: radial gradient đen mờ từ rìa vào (opacity 0.6)
- `scanlines`: vẽ horizontal lines mỏng opacity 0.08 cách nhau 3px
- `film-grain`: noise pixel random thay đổi mỗi frame (opacity 0.04)
- `chromatic-aberration`: getImageData rồi shift red channel +2px, blue -2px
- `bloom`: vẽ lại bright areas với gaussian blur approximation (box blur 3 pass)
- `particles-float`: spawn 30 particle nhỏ nổi lên chậm từ dưới
- `light-leaks`: vẽ gradient streak chéo góc opacity 0.15, animated
- `rain`: vẽ lines ngắn nghiêng animated rơi từ trên xuống
- `snow`: particle tròn nhỏ rơi chậm, drift ngang nhẹ
- `dust`: particle rất nhỏ, bay lung tung chậm
- `bokeh`: circles mờ to nhỏ khác nhau, drift chậm
- `lens-flare`: star burst pattern từ một điểm sáng

#### 2F. Transition Engine
Implement `applyTransition(ctx, type, progress, prevFrame, nextFrame)`:
(progress: 0.0 → 1.0)

- `cut`: instant switch khi progress > 0.5
- `crossfade`: alpha blend giữa 2 frame
- `whip-pan`: blur + translate X nhanh
- `glitch-wipe`: glitch effect kết hợp wipe từ trái sang phải
- `dissolve`: pixel-level dissolve (noise threshold tăng dần)
- `zoom-wipe`: scale up frame cũ đến đầy màn hình rồi reveal frame mới

---

### TASK 3 — Cập nhật `app.js` logic điều phối

#### 3A. Scene loop
for each scene in script.scenes:

renderer.renderScene(scene, globalTheme, callback)  ← bắt đầu vẽ canvas
Đồng thời: synthesize audio cho scene.narration
Đợi audio ready → play audio
Đợi estimatedDuration seconds
Apply transition sang scene tiếp theo (globalTheme.transitionStyle)
callback khi xong


#### 3B. hookType handling trong scene 1
Khi scene[0].hookType !== "none", trước khi render scene bình thường:
- `dramatic-countdown`: render số đếm 3→2→1 (mỗi số 0.8 giây) với animation scale + flash
- `shocking-stat`: flash số/stat lớn trên nền đen 1 giây trước khi scene vào
- `mystery-reveal`: màn hình đen, text xuất hiện từng từ chậm rãi
- Các hookType khác: không cần pre-animation đặc biệt, narration đủ

#### 3C. Progress tracking
progressPct = (currentSceneIndex / totalScenes) * 100
progressLabel = Đang tạo cảnh ${currentSceneIndex + 1}/${totalScenes}: "${scene.sceneTitle}"

#### 3D. Giữ nguyên toàn bộ audio logic hiện tại
- Free TTS: Web Speech API với freeLangSelect và speechRate
- ElevenLabs: fetch POST /v1/text-to-speech/{voiceId} với API key từ settings
- Audio và video phải sync: video chờ audio play xong hoặc chạy song song tùy estimatedDuration

---

## RÀNG BUỘC KỸ THUẬT

1. **KHÔNG dùng thư viện ngoài** (không Three.js, không GSAP, không p5.js). Thuần Canvas 2D API + vanilla JS.
2. **requestAnimationFrame** cho tất cả animation — không dùng setInterval/setTimeout cho render loop.
3. **Performance**: mỗi frame render phải xong trong <16ms (60fps target). Nếu effect nặng (chromatic-aberration, bloom), chỉ apply mỗi 3 frame.
4. **Font**: dùng system fonts. fontStyle mapping:
   - `bold-impact`: `"Impact, Arial Black, sans-serif"`
   - `elegant-serif`: `"Georgia, 'Times New Roman', serif"`
   - `techy-mono`: `"'Courier New', Courier, monospace"`
   - `handwritten`: `"'Comic Sans MS', cursive"` (fallback tốt nhất không có CDN)
   - `condensed-dramatic`: `"Arial Narrow, Arial, sans-serif"`
5. **Graceful fallback**: nếu JSON từ AI thiếu field nào, dùng default an toàn. Không crash.
6. **Memory**: clear animation frame IDs trước khi start scene mới. Không leak.
7. **Canvas record**: giữ nguyên MediaRecorder logic để download .webm

---

## OUTPUT YÊU CẦU

Viết lại hoàn toàn 2 file:
1. `renderer.js` — Toàn bộ engine rendering
2. `app.js` — Toàn bộ logic điều phối (giữ nguyên UI event handlers, chỉ nâng cấp render pipeline)

Mỗi function phải có comment 1 dòng giải thích nhiệm vụ.
Tổ chức code theo sections rõ ràng với separator comment:
`// ══════════════════════════ SECTION NAME ══════════════════════════`