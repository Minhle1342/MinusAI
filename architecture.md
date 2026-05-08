# Kiến Trúc Hệ Thống

## 1. Tổng Quan
Dự án "Tạo Video Tự Động" (MinusAI) là một công cụ web-based hỗ trợ tự động hoá quá trình tạo video chuyên nghiệp thông qua kịch bản từ AI. Hệ thống sử dụng mô hình ngôn ngữ lớn (Gemini 2.5 Flash) để tự động sinh kịch bản cấu trúc (JSON), kết hợp với ElevenLabs hoặc Google TTS cho giọng đọc, và sử dụng công nghệ Vanilla HTML5 Canvas để render hoạt ảnh trực tiếp trên trình duyệt mà không cần các phần mềm dựng phim truyền thống.

## 2. Cấu Trúc Thư Mục
Dự án được cấu trúc theo mô hình Client-Server cơ bản chạy chung trên một Node.js backend.

```
.
├── server.js              # File entry point của backend (Express.js)
├── config.json            # Lưu trữ cấu hình nhạy cảm (API Keys)
├── package.json           # Khai báo metadata và dependencies của Node.js
├── .env                   # Chứa các biến môi trường cấu hình (fallback)
└── public/                # Thư mục chứa toàn bộ mã nguồn Frontend
    ├── index.html         # Giao diện chính của ứng dụng
    ├── style.css          # File style tổng của hệ thống
    ├── app.js             # Logic xử lý giao diện, gọi API và quản lý state
    └── renderer.js        # Core engine dùng Canvas API để render video
```

## 3. Các Trang & Luồng Chính
Ứng dụng được thiết kế theo dạng Single Page Application (SPA), mọi tương tác đều diễn ra trên một trang duy nhất.

| Trang | File HTML | Mô tả chức năng | JS liên quan |
| :--- | :--- | :--- | :--- |
| **Trang chủ** | `public/index.html` | Layout chính chia 2 cột: Bảng điều khiển (trái) và Khu vực xem trước Video/Canvas (phải). Bao gồm cả các modal cài đặt. | `app.js` (UI logic), `renderer.js` (Video Canvas) |

## 4. Hệ Thống CSS
- **File chính:** `public/style.css`
- **Tổ chức:** 
  - Là Vanilla CSS (thuần), không sử dụng framework (như Tailwind hay Bootstrap).
  - Sử dụng CSS Variables (Custom Properties) ở `:root` để định nghĩa hệ thống Design Tokens (Màu sắc `bg-base`, `text-primary`, `accent-start`, Typography, Radius, Shadow).
  - Áp dụng các utility classes cơ bản kết hợp với các component classes (`.btn`, `.form-group`, `.panel`).
  - Thiết kế mang phong cách Modern, Glassmorphism, Dark mode.

## 5. JavaScript
Kiến trúc Frontend JS thuần, không dùng framework (React/Vue/Angular).

- **`public/app.js` (Controller/State Manager):**
  - Khai báo DOM references.
  - Quản lý trạng thái nội bộ (`isRunning`, `currentScript`, `isPreviewMode`).
  - Lấy dữ liệu từ form, nối prompt và gọi Backend APIs (`/api/generate-script`, `/api/tts`).
  - Xử lý Web Audio API cho luồng phát âm thanh.
- **`public/renderer.js` (Canvas Rendering Engine):**
  - `VideoRenderer`: Class chính phụ trách vòng lặp render (`requestAnimationFrame`), xử lý hiệu ứng nền, hiệu ứng chữ (`typewriter`, `slide-up`, v.v.), vẽ hạt (particles), xử lý filter (`renderMode`: glitch, neon, retro).
  - `VisualElementRenderer`: Class xử lý vẽ các phần tử dữ liệu trực quan (`stat-counter`, `progress-bar`, `chart`) trên Canvas, tự động canh chỉnh (align) chống lấp chữ và tự động chạy animation (ease-out).

## 6. Giao Tiếp Dữ Liệu
- **Giao thức:** Sử dụng `fetch` API kết hợp JSON.
- **State Management:** Lưu trong các biến global JS ở `app.js`.
- **Lưu trữ tĩnh:** 
  - Không dùng LocalStorage/SessionStorage.
  - Key cấu hình được gửi lên backend thông qua `/api/config` và backend lưu ra file `config.json` ở phía server.

## 7. Backend & API
Sử dụng **Node.js** và **Express.js** (`server.js`). Backend chủ yếu đóng vai trò làm Proxy (để giấu API Key an toàn hơn và tránh CORS issues với các dịch vụ bên thứ 3).

- **Endpoints:**
  - `POST /api/config`: Cập nhật cấu hình (Gemini Key, ElevenLabs Key).
  - `GET /api/config`: Lấy trạng thái config hiện tại (che giấu bớt token).
  - `POST /api/generate-script`: Nhận prompt từ user, ghép System Prompt và gọi API **Gemini 2.5 Flash**. Tự động parse và fallback nếu JSON bị lỗi format.
  - `POST /api/tts`: Gọi API Text-to-Speech của **ElevenLabs**.
  - `GET /api/voices`: Lấy danh sách voice từ ElevenLabs (ưu tiên lọc tiếng Việt).
  - `GET /api/tts-free`: Proxy gọi API dịch vụ TTS miễn phí của Google Translate, nối các đoạn audio buffer.
- **Data Layer:** Lưu trữ dữ liệu cấu hình dưới dạng text thông qua file hệ thống `config.json`.
- **Auth:** Xác thực dựa trên việc lưu trữ cứng (hard-coded) hoặc truyền vào từ UI API Keys, không có tài khoản người dùng (User System).

## 8. Thư Viện & Dependency Bên Ngoài

| Tên thư viện | Mục đích sử dụng | Nơi áp dụng |
| :--- | :--- | :--- |
| **Express.js** | Web Server framework | Backend (`server.js`) |
| **Axios** | HTTP Client thay cho fetch để tiện lợi hơn | Backend (`server.js`) |
| **Cors** | Xử lý Cross-Origin | Backend (`server.js`) |
| **Lucide Icons** | Bộ icon hiển thị UI đẹp, gọn nhẹ | Frontend (CDN trong `<head>`) |
| **Google Fonts** | Font `Inter` và `Space Grotesk` | Frontend (CDN trong `style.css`) |

## 9. Điểm Cần Lưu Ý Khi Phát Triển
- **Coupling ở API Prompt:** Logic thiết kế cấu trúc JSON của script (RenderMode, Elements, Animation) được định nghĩa dưới dạng một khối System Prompt khổng lồ gửi cho Gemini. Khi thêm tính năng mới cho video, bắt buộc phải cập nhật prompt text. Hiện tại một phần nằm ở `server.js` (`VIDEO_SYSTEM_PROMPT`) và phần custom (slider, element types) được nối trực tiếp trong `app.js`.
- **Vanilla Canvas API:** `renderer.js` quản lý state (lưu vị trí, save/restore ctx, clip frame) rất phức tạp. Bất kỳ phép biến đổi (translate) nào cũng phải đi kèm với `ctx.save()` và `ctx.restore()` để không rò rỉ state qua frame tiếp theo.
- **File Size:** File JS/CSS sẽ phình to nếu thêm nhiều tính năng do không sử dụng module bundler (Webpack/Vite).

## 10. Hướng Phát Triển Tiếp Theo (gợi ý từ phân tích code)
- **Kiến trúc Module hoá:** Frontend nên bắt đầu tách file theo module ES6 (`<script type="module">`). Chẳng hạn tách riêng `AudioHandler.js`, `APIHandler.js`, và `UIController.js` khỏi `app.js` đang phình to.
- **Quản lý Prompt động:** System Prompt đang phân tán ở cả `server.js` và `app.js`, chiếm nhiều không gian, có thể lưu thành các file riêng biệt để tải lên linh hoạt thay vì hard-code chuỗi.
- **Xử lý Bundle:** Áp dụng Vite hoặc Webpack để có thể dễ dàng quản lý dependencies thay vì phải tải file qua script tag.
- **Hỗ trợ Asset bên ngoài:** Tích hợp tính năng thêm ảnh/video nền (Image/Video Background) thay vì chỉ sử dụng background vẽ bằng code Canvas. Backend có thể bổ sung API upload file tĩnh bằng `multer`.
