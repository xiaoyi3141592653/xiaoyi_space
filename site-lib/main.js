/* ================================================================
   main.js — 主题切换 · 搜索 · 阅读模式 · 移动端菜单 · 初始化
   ================================================================ */

// ---------- Theme ----------
function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme') || 'light';
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeBtn(next);
}

function updateThemeBtn(theme) {
  var btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ---------- Reading Mode ----------
function toggleReading() {
  document.body.classList.toggle('reading-mode');
  var btn = document.getElementById('reading-btn');
  if (btn) {
    btn.textContent = document.body.classList.contains('reading-mode') ? '📰' : '📖';
  }
}

// ---------- Search ----------
function toggleSearch() {
  var panel = document.getElementById('search-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    document.getElementById('search-input').focus();
  }
}

function doSearch(query) {
  var container = document.getElementById('search-results');
  if (!query || query.length < 1) {
    container.innerHTML = '';
    return;
  }
  var q = query.toLowerCase();
  var posts = typeof SEARCH_DATA !== 'undefined' ? SEARCH_DATA : (typeof ALL_POSTS !== 'undefined' ? ALL_POSTS : []);
  var matches = [];
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var nameMatch = p.name.toLowerCase().indexOf(q) !== -1;
    var titleMatch = p.title.toLowerCase().indexOf(q) !== -1;
    var content = p.content || '';
    var contentLower = content.toLowerCase();
    var contentIdx = contentLower.indexOf(q);
    if (nameMatch || titleMatch || contentIdx !== -1) {
      var snippet = '';
      if (contentIdx !== -1) {
        var start = Math.max(0, contentIdx - 20);
        var end = Math.min(content.length, contentIdx + q.length + 40);
        snippet = (start > 0 ? '...' : '') +
                  content.substring(start, end).replace(/\n/g, ' ') +
                  (end < content.length ? '...' : '');
      }
      matches.push({ name: p.name, title: p.title, snippet: snippet });
    }
  }
  if (matches.length === 0) {
    container.innerHTML = '<div style="padding:8px 14px;color:var(--text-muted);font-size:.9em">无结果</div>';
    return;
  }
  var escapeRegex = function(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var highlightRe = new RegExp('(' + escapeRegex(query) + ')', 'gi');
  var esc = function(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var highlight = function(s) { return esc(s).replace(highlightRe, '<mark class="search-hl">$1</mark>'); };
  container.innerHTML = matches.slice(0, 20).map(function(m) {
    var href = encodeURI(m.name) + '.html';
    var html = '<a href="' + href + '"><span class="search-title">' + highlight(m.title) + '</span>';
    if (m.snippet) {
      html += '<span class="search-snippet">' + highlight(m.snippet) + '</span>';
    }
    html += '</a>';
    return html;
  }).join('');
}

// ---------- Mobile Sidebar ----------
var overlay = null;

function ensureOverlay() {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = function() { closeSidebar(); };
    document.body.appendChild(overlay);
  }
}

function openSidebar() {
  var sb = document.getElementById('sidebar-left');
  ensureOverlay();
  // Force reflow so transition triggers when going from display:none -> visible
  overlay.style.display = 'block';
  void overlay.offsetHeight;
  sb.classList.add('open');
  overlay.classList.add('open');
}

function closeSidebar() {
  var sb = document.getElementById('sidebar-left');
  sb.classList.remove('open');
  if (overlay) {
    overlay.classList.remove('open');
    // Hide overlay after transition
    setTimeout(function() {
      if (!sb.classList.contains('open')) overlay.style.display = 'none';
    }, 300);
  }
}

function toggleSidebar() {
  var sb = document.getElementById('sidebar-left');
  if (sb.classList.contains('open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

// ---------- Touch Swipe for Sidebar ----------
(function() {
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartTime = 0;
  var minSwipeDist = 50;
  var maxSwipeTime = 400; // ms
  var isEdgeSwipe = false;
  var isSidebarSwipe = false;

  function getEdgeSwipeWidth() {
    return Math.max(25, Math.floor(window.innerWidth / 3));
  }

  document.addEventListener('touchstart', function(e) {
    var touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();

    var sb = document.getElementById('sidebar-left');
    isEdgeSwipe = (touchStartX <= getEdgeSwipeWidth() && !sb.classList.contains('open'));
    isSidebarSwipe = sb.classList.contains('open');
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    var touch = e.changedTouches[0];
    var dx = touch.clientX - touchStartX;
    var dy = touch.clientY - touchStartY;
    var dt = Date.now() - touchStartTime;

    // Only trigger if horizontal movement dominates and within time limit
    if (dt > maxSwipeTime || Math.abs(dy) > Math.abs(dx)) return;

    // Right swipe from left edge -> open
    if (isEdgeSwipe && dx > minSwipeDist) {
      openSidebar();
      return;
    }

    // Left swipe while sidebar open -> close
    if (isSidebarSwipe && dx < -minSwipeDist) {
      closeSidebar();
      return;
    }
  }, { passive: true });
})();

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', function() {
  // Theme button state
  var theme = document.documentElement.getAttribute('data-theme') || 'light';
  updateThemeBtn(theme);

  // highlight.js
  if (typeof hljs !== 'undefined') {
    document.querySelectorAll('pre code').forEach(function(block) {
      if (!block.classList.contains('language-mermaid')) {
        hljs.highlightElement(block);
      }
    });
  }

  // KaTeX auto-render
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }

  // Mermaid
  if (typeof mermaid !== 'undefined') {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    mermaid.initialize({
      startOnLoad: true,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'strict'
    });
  }

  // Scroll sidebar to active item
  var activeItem = document.querySelector('.nav-list .nav-item.active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  // Close search on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var panel = document.getElementById('search-panel');
      if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
      }
      closeSidebar();
    }
  });
});
