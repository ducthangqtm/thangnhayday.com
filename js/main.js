document.addEventListener('DOMContentLoaded', () => {
  const catContainer = document.querySelector('.category-tabs');
  const productsContainer = document.getElementById('productsGrid');

  let activeCategory = 'Tất cả';

  // 1. Setup category tab click listeners
  function bindCategoryButtons() {
    const catButtons = document.querySelectorAll('.cat-btn');
    const productItems = document.querySelectorAll('.product-item');

    catButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.getAttribute('data-category');

        catButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        productItems.forEach(item => {
          const itemCat = item.getAttribute('data-category');
          if (activeCategory === 'Tất cả' || itemCat === activeCategory) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  bindCategoryButtons();

  // 2. Fetch fresh products from data/products.json (Dynamic synchronization)
  fetch('data/products.json?v=' + Date.now(), { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (data && Array.isArray(data.products) && data.products.length > 0) {
        renderDynamicContent(data);
      }
    })
    .catch(() => {
      // Keep static pre-rendered HTML if offline or local file protocol
    });

  function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function renderDynamicContent(data) {
    const categories = ['Tất cả', ...(data.categories || ['Nhảy Dây', 'Tập Tại Nhà', 'Phụ Kiện'])];
    const products = data.products.sort((a, b) => (a.order || 999) - (b.order || 999));

    // Render category tabs
    if (catContainer) {
      catContainer.innerHTML = categories.map(cat => `
        <button type="button" class="cat-btn ${cat === activeCategory ? 'active' : ''}" data-category="${escapeHTML(cat)}">
          ${escapeHTML(cat)}
        </button>
      `).join('');
    }

    // Render products
    if (productsContainer) {
      productsContainer.innerHTML = products.map(p => {
        const shopeeUrl = (p.shopeeUrl || p.affiliate_url || '').trim();
        const tiktokUrl = (p.tiktokUrl || '').trim();
        const hasShopee = Boolean(shopeeUrl);
        const hasTiktok = Boolean(tiktokUrl);

        let actionMarkup = '';
        if (hasShopee && hasTiktok) {
          actionMarkup = `
            <div class="btn-dual-wrap">
              <a href="${escapeHTML(shopeeUrl)}" target="_blank" rel="noopener noreferrer" class="btn-shopee" title="Shopee">
                <span>SHOPEE</span>
              </a>
              <a href="${escapeHTML(tiktokUrl)}" target="_blank" rel="noopener noreferrer" class="btn-tiktok" title="TikTok Shop">
                <span>TIKTOK</span>
              </a>
            </div>
          `;
        } else if (hasShopee) {
          actionMarkup = `
            <a href="${escapeHTML(shopeeUrl)}" target="_blank" rel="noopener noreferrer" class="btn-shopee full" title="Mua trên Shopee">
              <span>XEM GIÁ SHOPEE</span>
            </a>
          `;
        } else if (hasTiktok) {
          actionMarkup = `
            <a href="${escapeHTML(tiktokUrl)}" target="_blank" rel="noopener noreferrer" class="btn-tiktok full" style="width:100%;font-size:0.7rem;padding:0.5rem;" title="Mua trên TikTok">
              <span>XEM TRÊN TIKTOK</span>
            </a>
          `;
        } else {
          actionMarkup = `
            <div style="font-size:0.65rem;color:#64748b;font-style:italic;text-align:center;padding:0.25rem;">Đang cập nhật link</div>
          `;
        }

        const isVisible = activeCategory === 'Tất cả' || p.category === activeCategory;

        return `
          <div class="product-item" data-category="${escapeHTML(p.category)}" style="display: ${isVisible ? 'flex' : 'none'};">
            <div class="product-img-box">
              <img src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.name)}" class="product-img" loading="lazy" onerror="this.src='assets/logo-tit.svg'" />
              ${p.badge ? `<span class="product-tag">${escapeHTML(p.badge)}</span>` : ''}
            </div>
            <div class="product-body">
              <div>
                <p class="product-category-label">${escapeHTML(p.category || '')}</p>
                <h3 class="product-title" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</h3>
              </div>
              ${actionMarkup}
            </div>
          </div>
        `;
      }).join('');
    }

    bindCategoryButtons();
  }

  // 3. Donate Modal
  const donateModal = document.getElementById('donateModal');
  const donateOpenBtns = document.querySelectorAll('.open-donate-trigger, #openDonateBtn, [href="#donate"]');
  const donateCloseBtn = document.getElementById('closeDonateBtn');

  function openDonateModal(e) {
    if (e) e.preventDefault();
    if (donateModal) donateModal.classList.add('active');
  }

  function closeDonateModal() {
    if (donateModal) donateModal.classList.remove('active');
  }

  donateOpenBtns.forEach(btn => btn.addEventListener('click', openDonateModal));
  if (donateCloseBtn) donateCloseBtn.addEventListener('click', closeDonateModal);

  if (donateModal) {
    donateModal.addEventListener('click', (e) => {
      if (e.target === donateModal) closeDonateModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDonateModal();
  });

  if (window.location.hash === '#donate') {
    openDonateModal();
  }

  // 4. Share Button & Toast
  const shareBtn = document.getElementById('sharePageBtn');
  const shareUrl = 'https://thangnhayday.com';

  function showToast(message) {
    const oldToast = document.querySelector('.toast-msg');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Thắng Nhảy Dây | Bio Link',
            url: shareUrl
          });
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast('✓ Đã sao chép link thangnhayday.com!');
        } catch (_) {
          showToast('✓ thangnhayday.com');
        }
      }
    });
  }
});
