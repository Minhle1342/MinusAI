# 🏗️ Kiến trúc Hệ thống — MinusAI

Tài liệu này mô tả chi tiết cấu trúc, luồng dữ liệu và các pattern kỹ thuật của dự án **MinusAI**. Đây là một công cụ tạo video AI tự động, biến văn bản/kịch bản thành video hoàn chỉnh trực tiếp trên trình duyệt.

---

## 📂 1. Cấu trúc Thư mục (Directory Tree)

```text
Ma_Nguon_AI_Video/
├── public/                 # Frontend (Tĩnh)
│   ├── index.html          # Giao diện chính (UI)
│   ├── style.css           # Styling (Modern Dark Mode)
│   ├── app.js              # Controller chính (Logic điều phối)
│   └── renderer.js         # Engine đồ họa (Canvas-based)
├── server.js               # Backend (Node.js/Express)
├── config.json             # Cấu hình API Keys (Local)
├── package.json            # Dependencies & Scripts
├── .env                    # Biến môi trường
├── UPDATE.md               # Tài liệu nâng cấp & Prompt AI
└── hướng dẫn.txt           # Hướng dẫn sử dụng nhanh
```

---

## 🎨 2. Thành phần Hệ thống

### 🟢 Frontend (Client-side)
Ứng dụng chạy hoàn toàn trên trình duyệt, sử dụng HTML5 Canvas để render video.
- **index.html**: Sử dụng `Lucide Icons` cho giao diện. Chứa `canvas` 1280x720 và các bảng điều khiển (Generate, Audio, Settings).
- **style.css**: Thiết kế hiện đại, responsive, sử dụng các biến CSS (`--primary`, `--bg-dark`) và hiệu ứng glassmorphism.
- **app.js (The Orchestrator)**:
    - Quản lý trạng thái (`isRunning`, `currentScript`, `videoBlob`).
    - Giao tiếp với Server API (`/api/generate-script`, `/api/tts`).
    - Điều phối âm thanh: Hỗ trợ ElevenLabs (Premium) và Google Translate (Free).
    - Recording: Sử dụng `MediaRecorder` để ghi lại `MediaStream` từ Canvas + Audio Destination thành file `.webm`.
- **renderer.js (The Engine)**:
    - Sử dụng `requestAnimationFrame` để tạo loop 60fps.
    - Hệ thống Particle (hạt) tạo hiệu ứng động.
    - Xử lý các "Scene" (cảnh): Background, Title, Animation (slide-up, zoom-in, typewriter...).
    - Hỗ trợ các theme: `tech`, `space`, `nature`, `abstract`, `minimal`.

### 🔵 Backend (Server-side)
Đóng vai trò là Proxy và Persistence layer.
- **Framework**: Express.js.
- **Endpoints**:
    - `POST /api/config`: Lưu API Key vào `config.json`.
    - `POST /api/generate-script`: Proxy đến Gemini AI (Google) để tạo kịch bản JSON.
    - `POST /api/tts`: Proxy đến ElevenLabs API.
    - `GET /api/tts-free`: Proxy đến Google Translate TTS (có xử lý chunking văn bản dài).
    - `GET /api/voices`: Lấy danh sách giọng đọc từ ElevenLabs.

### 💾 Data Layer
- **Persistence**: `config.json` lưu trữ Gemini API Key và ElevenLabs API Key tại local.
- **Runtime State**: Dữ liệu kịch bản (JSON) được giữ trong bộ nhớ của `app.js` sau khi Gemini phản hồi.
- **Media**: Video sau khi tạo được giữ dưới dạng `Blob` URL trên trình duyệt để người dùng tải về.

---

## 🛠️ 3. Các Pattern Quan trọng

### 🔄 Luồng tạo Video (Pipeline)
1. **Input**: Người dùng nhập prompt → `app.js` gửi đến `/api/generate-script`.
2. **Brain**: Gemini phản hồi kịch bản dạng JSON (với các trường: `videoTitle`, `scenes`, `narration`, `accentColor`...).
3. **Synthesis**:
    - `app.js` lặp qua từng scene.
    - Gọi API TTS để lấy Audio.
    - `renderer.js` bắt đầu vẽ scene lên canvas.
4. **Recording**: `MediaRecorder` bắt luồng từ canvas và audio để tạo file video thực tế.

### 🧩 Component Pattern
Dự án không dùng framework (React/Vue), nhưng tổ chức code theo hướng modular:
- **UI Interaction**: Tách biệt trong các event listener của `app.js`.
- **Visual Logic**: Đóng gói hoàn toàn trong class `VideoRenderer`.

### 🛡️ Security & Config
- Sử dụng `.env` hoặc `config.json` để quản lý Keys.
- Key được che khuất (`masked`) khi trả về frontend (`...` ở cuối).

---

## 🚀 4. Hướng phát triển (Roadmap)
Dựa trên file `UPDATE.md`, hệ thống đang hướng tới:
- **Nâng cấp JSON Schema**: Thêm `renderMode` (3D, Glitch, Hand-drawn), `cameraMotion`, và `overlayEffects`.
- **Renderer phức tạp**: Chuyển từ vẽ text đơn giản sang các visual elements (chart, stat-counter, 3d-objects giả lập).

---

## 📝 5. Lưu ý cho AI Developer
- Khi sửa logic vẽ, hãy tập trung vào `renderer.js`.
- Khi sửa logic gọi API hoặc luồng recording, hãy tập trung vào `app.js`.
- Đảm bảo kịch bản JSON từ Gemini khớp với schema mà `VideoRenderer` mong đợi.
- Không sử dụng thư viện ngoài cho renderer (Giữ nguyên Vanilla Canvas API).
