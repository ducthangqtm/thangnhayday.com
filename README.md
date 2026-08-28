# 🏃‍♂️ Thắng Nhảy Dây - Bio Link & Trang Đồ Tập Tại Nhà (thangnhayday.com)

[![Website](https://img.shields.io/badge/Website-thangnhayday.com-f59e0b?style=for-the-badge&logo=google-chrome&logoColor=white)](https://thangnhayday.com)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> Website chính thức và trang Bio Link của **Thắng Nhảy Dây** (`thangnhayday.com`). Nơi chia sẻ hành trình 100 ngày nhảy dây giảm mỡ, rèn luyện thể lực và tổng hợp các món đồ tập thể thao tại nhà chất lượng mà Thắng đang sử dụng.

---

## 🌟 Tính Năng Nổi Bật

- **📱 Giao diện Mobile-First Siêu Đẹp:** Thiết kế theo phong cách Dark Mode thể thao hiện đại, hiệu ứng viền phát sáng (Glow Accent), phông chữ **Roboto** chuẩn YouTube.
- **🏷️ Phân Loại Môn Tập Thông Minh (Equal-Width Tabs):** 4 tab chính chia đều 100% thanh bấm:
  - **Nhảy Dây** (Dây nhảy tốc độ, dây đếm số, thảm nhảy, đai bảo vệ, đồ cho con...)
  - **Kéo Xà** (Xà đơn gắn cửa, dây kháng lực trợ lực...)
  - **Chống Đẩy** (Dụng cụ hít đất, bảng hít đất đa năng...)
  - **Chạy Bộ** (Giày chạy, tất thể thao, bình nước...)
- **🛒 Khối Sản Phẩm 2 Cột Chuẩn Affiliate:** Thẻ sản phẩm tối ưu tỷ lệ click với nút **"MUA NGAY"** dẫn trực tiếp đến link Shopee / Tiếp thị liên kết.
- **☕ Modal Mời Cafe (MoMo Donate):** Cửa sổ Popup quét mã VietQR MoMo sang xịn, hỗ trợ bấm mở nhanh app MoMo hoặc tải ảnh mã QR về máy.
- **⚡ Trang Quản Trị Tích Hợp (`/admin`):**
  - Quản lý toàn bộ Môn tập (Tabs), Nhóm mục (Categories) và Sản phẩm (Products).
  - Tự động đồng bộ và lưu trữ trực tiếp lên GitHub thông qua **GitHub REST API** mà không cần backend server phức tạp.
- **🚀 Chuẩn SEO & Tốc Độ:** 
  - Đầy đủ thẻ Meta Title, Description, OpenGraph, Twitter Card và Schema.org JSON-LD.
  - Bộ Favicon chuẩn hiển thị Google Search & trình duyệt (`favicon.ico`, `favicon.png`, `apple-touch-icon.png`).
  - File `sitemap.xml`, `robots.txt` và `_headers` tối ưu hóa bộ nhớ đệm cache trên Cloudflare Pages.

---

## 📂 Cấu Trúc Dự Án

```text
thangnhayday.com/
├── admin/
│   ├── config.yml          # Cấu hình CMS
│   └── index.html          # Trang quản trị sản phẩm & danh mục (Admin Panel)
├── data/
│   └── products.json       # Dữ liệu Môn tập, Nhóm mục & Sản phẩm (JSON)
├── images/
│   ├── avatar.jpg          # Ảnh đại diện cá nhân Thắng Nhảy Dây
│   └── qr-donate.jpg       # Mã MoMo VietQR ủng hộ cafe
├── .gitignore              # Danh sách file loại trừ khỏi Git
├── _headers                # Tối ưu Cache-Control & Security Headers cho Cloudflare
├── 404.html                # Trang thông báo lỗi 404 tùy chỉnh thể thao
├── app.js                  # Logic hiển thị sản phẩm động, tabs, modal donate & share
├── apple-touch-icon.png    # Icon ứng dụng trên iOS / Android (180x180)
├── favicon.ico             # Biểu tượng tab trình duyệt
├── favicon.png             # Icon chuẩn Google Search (192x192)
├── index.html              # Trang chủ Biolink chính
├── manifest.json           # Cấu hình PWA (Add to Home Screen)
├── README.md               # Tài liệu giới thiệu dự án
├── robots.txt              # Chỉ dẫn bot tìm kiếm & bảo vệ /admin/
├── sitemap.xml             # Bản đồ trang web cho Google Search
├── style.css               # Toàn bộ mã nguồn CSS giao diện Dark Mode
└── wrangler.json           # Cấu hình Cloudflare Pages CLI
```

---

## 💻 Hướng Dẫn Chạy Thử Tại Local (Local Development)

Dự án sử dụng thuần **HTML5, CSS3, JavaScript** nên không cần cài đặt môi trường phức tạp:

1. **Clone repository:**
   ```bash
   git clone https://github.com/ducthangqtm/thangnhayday.com.git
   cd thangnhayday.com
   ```

2. **Chạy Local Server (Khuyên dùng Live Server hoặc HTTP Server):**
   ```bash
   # Cách 1: Sử dụng npx serve
   npx serve .

   # Cách 2: Sử dụng Python
   python -m http.server 8000
   ```

3. Mở trình duyệt tại: `http://localhost:8000`

---

## ☁️ Triển Khai (Deployment)

Dự án được kết nối tự động với **Cloudflare Pages**:
- Mỗi khi có commit mới được push lên nhánh `main`, Cloudflare Pages sẽ tự động kích hoạt tiến trình triển khai toàn cầu trong vòng vài chục giây.
- Tên miền chính: [https://thangnhayday.com](https://thangnhayday.com)

---

## 👤 Tác Giả & Bản Quyền

- **Tác giả:** [Nguyễn Đức Thắng](https://thangnd.io.vn) (@thangnhayday)
- **Kênh mạng xã hội:**
  - 📘 Facebook: [fb.com/thangnhayday](https://www.facebook.com/thangnhayday)
  - 🎬 YouTube: [youtube.com/@thangnhayday](https://www.youtube.com/@thangnhayday)
  - 🎵 TikTok: [tiktok.com/@thangnhayday](https://www.tiktok.com/@thangnhayday)

---
*Stay Active • Jump Everyday • Burn Calories* 💪🔥
