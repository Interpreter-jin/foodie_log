// app.js — FoodieLog 공통 유틸리티

// ── Firebase 초기화 ─────────────────────────────────────────────────────────
let _auth, _db, _storage;

async function initFirebase() {
  if (_auth) return { auth: _auth, db: _db, storage: _storage };

  const config = await fetch('/api/firebase-config').then(r => r.json());

  // CDN에서 Firebase 모듈 로드 (ESM)
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
          createUserWithEmailAndPassword, signInWithEmailAndPassword,
          updateProfile, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const { getFirestore } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const { getStorage } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');

  const app = initializeApp(config);
  _auth = getAuth(app);
  _db = getFirestore(app);
  _storage = getStorage(app);

  window._firebaseAuth = _auth;
  window._firebaseSignIn = signInWithPopup;
  window._firebaseGoogleProvider = GoogleAuthProvider;
  window._firebaseCreateUser = createUserWithEmailAndPassword;
  window._firebaseSignInEmail = signInWithEmailAndPassword;
  window._firebaseUpdateProfile = updateProfile;
  window._firebaseSignOut = signOut;
  window._firebaseOnAuthChanged = onAuthStateChanged;

  return { auth: _auth, db: _db, storage: _storage };
}

// ── 현재 유저 토큰 가져오기 ──────────────────────────────────────────────────
async function getIdToken() {
  const { auth } = await initFirebase();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

// ── API 헬퍼 ────────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const token = await getIdToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  return res.json();
}

// ── 토스트 ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'default') {
  const wrap = document.querySelector('.toast-wrap') || (() => {
    const el = document.createElement('div');
    el.className = 'toast-wrap';
    document.body.appendChild(el);
    return el;
  })();
  const t = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'error' : ''}`;
  t.textContent = msg;
  wrap.innerHTML = '';
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ── 날짜 포맷 ────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return d.toLocaleDateString('ko-KR');
}

// ── 별점 HTML ────────────────────────────────────────────────────────────────
function starsHtml(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="star ${i < rating ? 'filled' : 'empty'}">${i < rating ? '★' : '☆'}</span>`
  ).join('');
}

// ── 이니셜 아바타 ────────────────────────────────────────────────────────────
function avatarHtml(name, photoURL) {
  if (photoURL) return `<img src="${photoURL}" alt="${name}" onerror="this.style.display='none'">`;
  return `<span>${(name || '?').charAt(0).toUpperCase()}</span>`;
}

// ── 카테고리 이모지 ──────────────────────────────────────────────────────────
const CAT_EMOJI = { '한식': '🍚', '중식': '🥢', '양식': '🍝', '퓨전': '🌮', '카페': '☕' };
function catEmoji(cat) { return CAT_EMOJI[cat] || '🍽️'; }

// ── 포스트 카드 렌더링 ───────────────────────────────────────────────────────
function renderPostCard(post) {
  const images = post.imageUrls || [];
  const imagesHtml = images.length > 0 ? (() => {
    const cls = images.length === 1 ? 'one' : images.length === 2 ? 'two' : 'three';
    const shown = images.slice(0, 3);
    const extra = images.length > 3 ? images.length - 3 : 0;
    return `
      <div class="card-images ${cls}">
        ${shown.map((url, i) => `
          <div class="img-item">
            <img src="${url}" alt="음식 사진" loading="lazy">
            ${i === 2 && extra > 0 ? `<div class="img-more">+${extra}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
  })() : '';

  const tagsHtml = (post.tags || []).length > 0
    ? `<div class="tag-row">${post.tags.map(t => `<span class="mention-tag">@${t}</span>`).join('')}</div>`
    : '';

  const content = post.content || '';
  const shortContent = content.length > 80 ? content.slice(0, 80) + '...' : content;

  return `
    <article class="post-card" onclick="location.href='/post/${post.id}'">
      <div class="card-header">
        <div class="avatar">${avatarHtml(post.authorName, post.authorPhoto)}</div>
        <div class="card-meta">
          <div class="card-author">${post.authorName || '익명'}</div>
          <div class="card-time">${timeAgo(post.createdAt)}</div>
        </div>
        <div class="restaurant-badge">
          <span class="cat-badge">${catEmoji(post.category)} ${post.category || ''}</span>
        </div>
      </div>
      <div style="padding:0 14px 6px">
        <div class="restaurant-name">${post.restaurantName || ''}</div>
        <div class="stars-row">
          <div class="stars">${starsHtml(post.rating || 0)}</div>
          <span class="rating-num">${post.rating || 0}.0</span>
        </div>
      </div>
      <div class="info-chips">
        ${post.menu ? `<span class="info-chip"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>${post.menu}</span>` : ''}
        ${post.location ? `<span class="info-chip"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.1 11.5 7.7 12a.5.5 0 0 0 .6 0C12.9 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>${post.location}</span>` : ''}
      </div>
      ${imagesHtml}
      ${content ? `<div class="card-body"><p class="card-content">${shortContent}${content.length > 80 ? ` <span class="read-more">더보기</span>` : ''}</p></div>` : ''}
      ${tagsHtml}
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="action-btn like-btn" data-post-id="${post.id}" data-count="${post.likeCount || 0}" onclick="toggleLike(this)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          <span>${post.likeCount || 0}</span>
        </button>
        <button class="action-btn" onclick="location.href='/post/${post.id}'">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>${post.commentCount || 0}</span>
        </button>
        <button class="action-btn" onclick="sharePost('${post.id}', '${post.restaurantName}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
    </article>`;
}

// ── 좋아요 토글 ─────────────────────────────────────────────────────────────
async function toggleLike(btn) {
  const postId = btn.dataset.postId;
  const token = await getIdToken();
  if (!token) { showToast('로그인이 필요합니다', 'error'); return; }

  const res = await api(`/api/posts/${postId}/like`, { method: 'POST' });
  if (res.success) {
    btn.classList.toggle('liked', res.liked);
    btn.querySelector('span').textContent = res.likeCount;
    btn.querySelector('svg').setAttribute('fill', res.liked ? 'currentColor' : 'none');
  }
}

// ── 공유 ─────────────────────────────────────────────────────────────────────
async function sharePost(postId, name) {
  const url = `${location.origin}/post/${postId}`;
  if (navigator.share) {
    navigator.share({ title: `${name} 맛집 후기`, url });
  } else {
    await navigator.clipboard.writeText(url);
    showToast('링크가 복사되었습니다!');
  }
}

// ── 네비게이션 활성 ──────────────────────────────────────────────────────────
function setActiveNav() {
  const path = location.pathname;
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path && path.startsWith(el.dataset.path));
  });
  const feedItem = document.querySelector('[data-path="/feed"]');
  if (feedItem && path === '/') feedItem.classList.add('active');
}

// ── 유저 네비게이션 업데이트 ─────────────────────────────────────────────────
async function updateNavUser() {
  const { auth } = await initFirebase();
  _firebaseOnAuthChanged(auth, user => {
    const avatarEl = document.getElementById('nav-user-avatar');
    if (!avatarEl) return;
    if (user) {
      if (user.photoURL) {
        avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        avatarEl.textContent = (user.displayName || user.email || '?').charAt(0).toUpperCase();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  updateNavUser();
});
