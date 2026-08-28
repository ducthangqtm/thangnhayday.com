/**
 * Thắng Nhảy Dây - Bio Link & Affiliate Store Frontend Script
 * - Dynamic data fetch from data/products.json
 * - Interactive filter tabs & smooth transitions
 * - 1-Click Copy STK / MoMo with Toast feedback
 * - Accordion / Modal Donate & QR preview
 * - Dark / Light theme switcher
 * - Web Share API integration
 */

// Fallback products dataset (in case running via file:// protocol or offline)
const DEFAULT_PRODUCTS = [
  {
    "id": "day-nhay-beaded",
    "title": "Dây Nhảy Hạt Beaded (Bản Cho Người Mới & Freestyle)",
    "badge": "Khuyên dùng cho Newbie",
    "category": "beaded",
    "price": "~120.000₫",
    "original_price": "160.000₫",
    "rating": "4.9",
    "sold_count": "1.2k+",
    "image": "images/uploads/day-nhay-beaded.jpg",
    "description": "Cảm giác dây cực rõ tay, không bị xoắn rối khi tập, độ đầm chuẩn xác cho người mới bắt đầu và tập các trick biểu diễn nhảy dây.",
    "shopee_url": "https://shopee.vn",
    "tiktok_url": "https://www.tiktok.com"
  },
  {
    "id": "day-nhay-speed",
    "title": "Dây Nhảy Tốc Độ Cáp Thép (Đốt Mỡ & Double Unders)",
    "badge": "Tốc độ cao • Đốt mỡ",
    "category": "speed",
    "price": "~89.000₫",
    "original_price": "130.000₫",
    "rating": "5.0",
    "sold_count": "890+",
    "image": "images/uploads/day-nhay-speed.jpg",
    "description": "Cáp bọc PVC siêu bền, trục xoay 360° vòng bi kép mượt mà không cản lực. Tối ưu cho bài tập HIIT cardio, nhảy kép, nhảy ba tốc độ cao.",
    "shopee_url": "https://shopee.vn",
    "tiktok_url": "https://www.tiktok.com"
  },
  {
    "id": "day-nhay-weighted",
    "title": "Dây Nhảy Nặng Tăng Cơ Tay & Vai (Weighted Rope)",
    "badge": "Tăng thể lực • Khỏe vai",
    "category": "weighted",
    "price": "~190.000₫",
    "original_price": "250.000₫",
    "rating": "4.9",
    "sold_count": "450+",
    "image": "images/uploads/day-nhay-weighted.jpg",
    "description": "Dây bện chịu lực 9mm kháng mòn cao, đốt calo gấp 2 lần bình thường, hỗ trợ siết cơ bắp tay, vai và lưng trên cực kỳ rõ rệt.",
    "shopee_url": "https://shopee.vn",
    "tiktok_url": "https://www.tiktok.com"
  },
  {
    "id": "tham-nhay",
    "title": "Thảm Nhảy Dây Giảm Chấn Tiêu Âm (Tập Chung Cư)",
    "badge": "Bảo vệ đầu gối • Tiêu âm",
    "category": "mat",
    "price": "~160.000₫",
    "original_price": "220.000₫",
    "rating": "4.9",
    "sold_count": "670+",
    "image": "images/uploads/tham-nhay.jpg",
    "description": "Chất liệu TPE đúc đặc đàn hồi cao, cách âm tuyệt đối không làm phiền tầng dưới, giảm 80% áp lực phản hồi lên khớp gối và cổ chân.",
    "shopee_url": "https://shopee.vn",
    "tiktok_url": "https://www.tiktok.com"
  }
];

let allProducts = [...DEFAULT_PRODUCTS];
let activeCategory = 'all';

// DOM Elements
const productsListEl = document.getElementById('products-list');
const toastEl = document.getElementById('toast');
const toastTextEl = document.getElementById('toast-text');
const btnShare = document.getElementById('btn-share');

/**
 * Mở popup Modal MoMo Cafe
 */
function openDonateModal() {
  const modal = document.getElementById('donate-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Đóng popup Modal MoMo Cafe
 */
function closeDonateModal() {
  const modal = document.getElementById('donate-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDonateModal();
});

/**
 * Mở App MoMo trực tiếp (Deep link)
 */
function openMomoApp() {
  window.location.href = 'momo://';
  showToast('Đang mở ứng dụng MoMo... ⚡');
}

/**
 * Initialize Application
 */
async function initApp() {
  initClipboardButtons();
  initShareButton();
  await loadProductsData();
}

/**
 * Fetch products dynamically from data/products.json
 */
async function loadProductsData() {
  try {
    const res = await fetch('./data/products.json?v=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        allProducts = data.items;
      }
    }
  } catch (err) {
    console.info('Using local products fallback:', err);
  } finally {
    renderProducts();
  }
}

/**
 * Render product cards in 2-column layout with single MUA NGAY button
 */
function renderProducts() {
  if (!productsListEl) return;

  if (allProducts.length === 0) {
    productsListEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 20px;">
        <p class="empty-title">Chưa có sản phẩm nào</p>
      </div>
    `;
    return;
  }

  productsListEl.innerHTML = allProducts.map((product, index) => {
    const imgSrc = product.image || 'images/uploads/day-nhay-beaded.jpg';
    const targetUrl = product.shopee_url || product.tiktok_url || 'https://shopee.vn';

    return `
      <article class="product-card" data-category="${escapeHtml(product.category || 'other')}" style="animation-delay: ${index * 0.08}s">
        <div class="card-media">
          <img src="${escapeHtml(imgSrc)}" 
               alt="${escapeHtml(product.title)}" 
               class="product-img" 
               width="300" 
               height="300" 
               loading="lazy" 
               referrerpolicy="no-referrer"
               onerror="this.src='images/uploads/day-nhay-beaded.jpg'">
        </div>

        <div class="card-body">
          <h3 class="product-name">${escapeHtml(product.title)}</h3>
          <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer sponsored" class="btn-buy-now" title="Mua ${escapeHtml(product.title)}">
            <i class="fa-solid fa-cart-shopping"></i>
            <span>MUA NGAY</span>
          </a>
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Update badge classes based on category
 */
function getBadgeClass(cat) {
  switch (cat) {
    case 'speed': return 'speed';
    case 'weighted': return 'weighted';
    case 'mat': return 'mat';
    default: return 'recommended';
  }
}

/**
 * Copy to Clipboard with Toast Feedback
 */
function initClipboardButtons() {
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-btn');
    if (!copyBtn) return;

    const textToCopy = copyBtn.getAttribute('data-copy');
    if (!textToCopy) return;

    copyTextToClipboard(textToCopy, copyBtn);
  });
}

function copyTextToClipboard(text, btnElement) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      onCopySuccess(btnElement, text);
    }).catch(() => {
      fallbackCopy(text, btnElement);
    });
  } else {
    fallbackCopy(text, btnElement);
  }
}

function fallbackCopy(text, btnElement) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    onCopySuccess(btnElement, text);
  } catch (err) {
    showToast('❌ Không thể sao chép tự động');
  }
  document.body.removeChild(textarea);
}

function onCopySuccess(btnElement, text) {
  if (btnElement) {
    const origHtml = btnElement.innerHTML;
    btnElement.classList.add('copied');
    btnElement.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Đã chép</span>
    `;

    setTimeout(() => {
      btnElement.classList.remove('copied');
      btnElement.innerHTML = origHtml;
    }, 2000);
  }

  showToast(`✓ Đã sao chép: ${text}`);
}

/**
 * Toast Notification Banner
 */
let toastTimeout;
function showToast(msg) {
  if (!toastEl || !toastTextEl) return;

  toastTextEl.textContent = msg;
  toastEl.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2500);
}

/**
 * Web Share API or Copy Page Link
 */
function initShareButton() {
  if (!btnShare) return;

  btnShare.addEventListener('click', async () => {
    const shareData = {
      title: 'Thắng Nhảy Dây - Bio Link & Dây Nhảy Chuẩn',
      text: 'Chia sẻ hành trình 100 ngày nhảy dây giảm bụng, giảm mỡ & cải thiện sức khỏe mỗi ngày!',
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyPageUrl();
        }
      }
    } else {
      copyPageUrl();
    }
  });
}

function copyPageUrl() {
  copyTextToClipboard(window.location.href, null);
  showToast('✓ Đã sao chép link Bio thangnhayday.com');
}

/**
 * Helper: Escape HTML string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
