# Specification: Trang Bio & Tiếp Thị Liên Kết Tích Hợp CMS (thangnhayday.com)

> **Mục tiêu:** Xây dựng trang Bio Link & Affiliate Store đơn trang (Single-Page), tối ưu 100% Mobile-First, tích hợp **Decap CMS (Admin Panel)** để quản lý sản phẩm, upload ảnh trực tiếp từ điện thoại/máy tính mà không cần chỉnh sửa code. Chạy hoàn toàn miễn phí trên **GitHub + Cloudflare Pages**.

---

## 1. Tổng Quan & Kiến Trúc Dự Án

- **Domain:** `thangnhayday.com`
- **Mô hình hoạt động:**
  - **Client (Frontend):** Trang tĩnh siêu nhẹ (HTML5, Modern CSS, Vanilla JS) đọc dữ liệu động từ file `data/products.json`.
  - **Admin Panel (CMS):** Truy cập tại `thangnhayday.com/admin` (Decap CMS) giúp thêm/sửa/xóa sản phẩm, upload hình ảnh trực tiếp lên GitHub qua giao diện trực quan.
  - **Hạ tầng & CI/CD:** Lưu trữ GitHub Repository -> Kích hoạt tự động build & deploy toàn cầu qua Cloudflare Pages.

---

## 2. Cấu Trúc Thư Mục Chuẩn (Static + CMS)

```text
thangnhayday-bio/
├── admin/
│   ├── index.html          # Giao diện Decap CMS Admin (nhúng qua CDN)
│   └── config.yml          # Cấu hình form nhập liệu sản phẩm & OAuth GitHub
├── data/
│   └── products.json       # File JSON lưu danh sách sản phẩm (CMS tự động cập nhật)
├── images/
│   ├── uploads/            # Thư mục chứa ảnh sản phẩm được tải lên từ CMS
│   ├── avatar.jpg          # Ảnh đại diện cá nhân Thắng Nhảy Dây
│   └── qr-donate.jpg       # Mã QR thanh toán / donate
├── index.html              # Trang Bio hiển thị ngoài người dùng
├── style.css               # Giao diện Mobile-First, tối ưu bo góc, dark/light theme
├── app.js                  # Script tự động fetch data/products.json và render ra giao diện
├── _headers                # Header tăng tốc độ cache cho Cloudflare Pages
├── sitemap.xml             # Sitemap SEO
└── robots.txt              # Chỉ dẫn crawler công cụ tìm kiếm
```

---

## 3. Cấu Hình Decap CMS (`admin/config.yml`)

CMS sẽ được thiết lập tự động ghi dữ liệu vào file `data/products.json` và lưu ảnh vào `images/uploads/`:

```yaml
backend:
  name: github
  repo: your-github-username/thangnhayday-bio
  branch: main

media_folder: "images/uploads"
public_folder: "images/uploads"

collections:
  - name: "affiliate_products"
    label: "Danh Sách Sản Phẩm Dây Nhảy"
    files:
      - file: "data/products.json"
        label: "Sản phẩm Tiếp Thị Liên Kết"
        name: "products"
        fields:
          - label: "Danh sách sản phẩm"
            name: "items"
            widget: "list"
            fields:
              - { label: "Tên sản phẩm", name: "title", widget: "string" }
              - { label: "Tag nổi bật (VD: Khuyên dùng cho Newbie)", name: "badge", widget: "string", required: false }
              - { label: "Mức giá tham khảo (VD: 120.000đ)", name: "price", widget: "string" }
              - { label: "Ảnh sản phẩm", name: "image", widget: "image" }
              - { label: "Mô tả ngắn điểm nổi bật", name: "description", widget: "string", required: false }
              - { label: "Link Affiliate Shopee", name: "shopee_url", widget: "string", required: false }
              - { label: "Link Affiliate TikTok Shop", name: "tiktok_url", widget: "string", required: false }
```

---

## 4. Kiến Trúc Giao Diện Người Dùng (Single-Screen Mobile Layout)

Toàn bộ giao diện căn giữa với độ rộng tối đa chuẩn mobile (`max-width: 480px`):

### 4.1. Profile Header
- **Avatar:** Ảnh đại diện bo tròn viền gradient thể thao.
- **Tên hiển thị:** **Thắng Nhảy Dây** (kèm icon tích xanh).
- **Bio:** *Chia sẻ kỹ thuật & dòng dây nhảy chuẩn để đốt mỡ hiệu quả mỗi ngày.*
- **Social Icon Bar:** Các icon bấm nhanh trỏ về: **TikTok, YouTube, Facebook, Zalo**.

### 4.2. Khối Donate / Mời Cà Phê
- Nút bấm Accordion / Modal: `[ ☕ Mời Thắng cốc cà phê / Donate ]`.
- Mở ra: Mã QR chuyển khoản ngân hàng (VietQR) + MoMo + Nút copy số tài khoản nhanh.

### 4.3. Cửa Hàng Sản Phẩm (Được render tự động từ `products.json`)
Mỗi thẻ sản phẩm gồm:
- Ảnh sản phẩm (tải từ thư mục `images/uploads/`).
- Badge phân loại (VD: `[Bán chạy]`, `[Khuyên dùng cho Newbie]`).
- Tên sản phẩm, đánh giá sao (⭐⭐⭐⭐⭐), mô tả ngắn gọn.
- Mức giá tham khảo.
- **Cụm 2 nút bấm Tiếp Thị Liên Kết:**
  - Nút Shopee (`btn-shopee`, nền cam `#EE4D2D`): `[ 🛒 Mua trên Shopee ]`
  - Nút TikTok (`btn-tiktok`, nền đen/hồng `#010101` / `#FE2C55`): `[ 🎵 Mua trên TikTok Shop ]`
  - Thuộc tính bắt buộc: `target="_blank" rel="noopener noreferrer sponsored"`

### 4.4. Footer
- Dòng bản quyền: `© 2026 Thắng Nhảy Dây • thangnhayday.com`
- Link đăng nhập quản trị ẩn nhẹ: `thangnhayday.com/admin`

---

## 5. Quy Trình Vận Hành & Sử Dụng Sau Khi Deploy

1. **Khi muốn thêm / sửa sản phẩm mới:**
   - Dùng điện thoại hoặc máy tính truy cập: `https://thangnhayday.com/admin`.
   - Đăng nhập tài khoản GitHub.
   - Nhập tên sản phẩm, giá, chọn ảnh trực tiếp từ thư viện ảnh máy, dán link Shopee & TikTok Shop.
   - Bấm **Save / Publish**.
2. **Cơ chế cập nhật tự động:**
   - Decap CMS tự tạo 1 commit chứa ảnh và thông tin mới lên GitHub.
   - Cloudflare Pages tự động build lại trang web trong vòng 10-20 giây.
   - Trang `thangnhayday.com` hiển thị ngay sản phẩm mới mà không cần chạm vào bất kỳ dòng code nào.