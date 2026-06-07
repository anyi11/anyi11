// ==UserScript==
// @name         Bilibili 播放解锁与优化
// @namespace    https://github.com/Bili_Web_Purify
// @version      1.1.0
// @description  解锁 Bilibili 高清画质、首页去广告、优化视频播放体验，适配 SPA 页面切换
// @author       Bili_Web_Purify
// @match        *://*.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    unlockQuality: GM_getValue('unlockQuality', true),
    preferQuality: GM_getValue('preferQuality', 80), // 80=1080P, 64=720P, 32=480P
    autoHighest: GM_getValue('autoHighest', true),
    fixDashSync: GM_getValue('fixDashSync', true),
    hideVipPrompt: GM_getValue('hideVipPrompt', true),
    guestComment: GM_getValue('guestComment', true),
  };

  const PLAY_URL_PATTERNS = [
    '/x/player/wbi/playurl',
    '/x/player/playurl',
    '/pgc/player/web/v2/playurl',
    '/pgc/player/web/playurl',
    '/pgc/player/app/playurl',
  ];

  const VIP_INFO_PATTERNS = [
    '/x/web-interface/nav',
    '/x/vip/user/info',
    '/x/vip/ads/materials',
  ];

  const COMMENT_PATTERNS = [
    '/x/v2/reply',
    '/x/v2/reply/main',
    '/x/v2/reply/wbi/main',
  ];

  const VIDEO_PAGE_RE = /\/(video\/(BV|av)|bangumi\/play)\//i;

  let currentHref = location.href;
  let pageActive = false;
  let playerObserver = null;

  // ─── 工具函数 ───────────────────────────────────────────────

  function isPlayUrl(url) {
    if (!url) return false;
    const s = String(url);
    return PLAY_URL_PATTERNS.some((p) => s.includes(p));
  }

  function isVipInfoUrl(url) {
    if (!url) return false;
    const s = String(url);
    return VIP_INFO_PATTERNS.some((p) => s.includes(p));
  }

  function isCommentUrl(url) {
    if (!url) return false;
    const s = String(url);
    return COMMENT_PATTERNS.some((p) => s.includes(p));
  }

  function isVideoPage(href) {
    return VIDEO_PAGE_RE.test(href || location.href);
  }

  function safeParseJSON(text) {
    if (!text || typeof text !== 'string') return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function unlockPlayUrlData(data) {
    if (!data || typeof data !== 'object') return data;

    const walk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(walk);
        return;
      }
      if ('need_vip' in obj) obj.need_vip = false;
      if ('need_login' in obj) obj.need_login = false;
      if ('vip_required' in obj) obj.vip_required = false;
      if ('vip_status' in obj && typeof obj.vip_status === 'number') obj.vip_status = 1;
      if ('vip_type' in obj && typeof obj.vip_type === 'number') obj.vip_type = 2;
      Object.values(obj).forEach(walk);
    };

    walk(data);

    if (data.data?.support_formats && Array.isArray(data.data.support_formats)) {
      data.data.support_formats.forEach((fmt) => {
        fmt.need_vip = false;
        fmt.need_login = false;
        if (fmt.superscript != null) fmt.superscript = '';
      });
    }

    if (data.result?.support_formats && Array.isArray(data.result.support_formats)) {
      data.result.support_formats.forEach((fmt) => {
        fmt.need_vip = false;
        fmt.need_login = false;
      });
    }

    return data;
  }

  function patchVipInfo(data) {
    if (!data?.data) return data;
    const d = data.data;
    if (d.isLogin === false) return data;
    d.vipStatus = 1;
    d.vipType = 2;
    d.vipDueDate = Date.now() + 86400000 * 365;
    d.vipPayType = 1;
    d.vipThemeType = 0;
    d.vipLabel = { path: '', text: '', label_theme: '' };
  }

  function patchCommentResponse(data) {
    if (!data || data.code !== 0) return data;
    if (data.data?.config?.show_no_login_comment != null) {
      data.data.config.show_no_login_comment = true;
    }
    if (data.data?.config?.showentry != null) {
      data.data.config.showentry = true;
    }
    return data;
  }

  function transformResponse(url, body) {
    if (!body) return body;
    const json = safeParseJSON(body);
    if (!json) return body;

    let patched = json;
    if (CONFIG.unlockQuality && isPlayUrl(url)) {
      patched = unlockPlayUrlData(patched);
    }
    if (CONFIG.hideVipPrompt && isVipInfoUrl(url)) {
      patched = patchVipInfo(patched);
    }
    if (CONFIG.guestComment && isCommentUrl(url)) {
      patched = patchCommentResponse(patched);
    }

    return JSON.stringify(patched);
  }

  // ─── 请求拦截（必须在 document-start 安装）────────────────────

  function installRequestHooks() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const origGetAllResponseHeaders = XMLHttpRequest.prototype.getAllResponseHeaders;
    const origGetResponseHeader = XMLHttpRequest.prototype.getResponseHeader;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._biliUrl = typeof url === 'string' ? url : String(url);
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (!this._biliHeaders) this._biliHeaders = {};
      this._biliHeaders[name] = value;
      return origSetHeader.call(this, name, value);
    };

    XMLHttpRequest.prototype.getAllResponseHeaders = function () {
      if (this._biliResponseHeaders != null) return this._biliResponseHeaders;
      return origGetAllResponseHeaders.call(this);
    };

    XMLHttpRequest.prototype.getResponseHeader = function (name) {
      if (this._biliResponseHeaders != null) {
        const lines = this._biliResponseHeaders.split('\r\n');
        const key = name.toLowerCase();
        for (const line of lines) {
          const idx = line.indexOf(':');
          if (idx > 0 && line.slice(0, idx).toLowerCase() === key) {
            return line.slice(idx + 1).trim();
          }
        }
        return null;
      }
      return origGetResponseHeader.call(this, name);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const url = this._biliUrl || '';
      const shouldPatch =
        (CONFIG.unlockQuality && isPlayUrl(url)) ||
        (CONFIG.hideVipPrompt && isVipInfoUrl(url)) ||
        (CONFIG.guestComment && isCommentUrl(url));

      if (!shouldPatch) {
        return origSend.call(this, body);
      }

      const xhr = this;
      const origOnReadyStateChange = xhr.onreadystatechange;

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
          try {
            const raw = xhr.responseText;
            const patched = transformResponse(url, raw);
            if (patched !== raw) {
              Object.defineProperty(xhr, 'responseText', { writable: true, configurable: true, value: patched });
              Object.defineProperty(xhr, 'response', { writable: true, configurable: true, value: patched });
            }
          } catch (e) {
            console.warn('[BiliUnlock] XHR patch failed:', e);
          }
        }
        if (typeof origOnReadyStateChange === 'function') {
          origOnReadyStateChange.apply(xhr, arguments);
        }
      };

      return origSend.call(this, body);
    };

    const origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : input?.url || '';
        const shouldPatch =
          (CONFIG.unlockQuality && isPlayUrl(url)) ||
          (CONFIG.hideVipPrompt && isVipInfoUrl(url)) ||
          (CONFIG.guestComment && isCommentUrl(url));

        if (!shouldPatch) {
          return origFetch.call(this, input, init);
        }

        return origFetch.call(this, input, init).then(async (response) => {
          try {
            const clone = response.clone();
            const text = await clone.text();
            const patched = transformResponse(url, text);
            if (patched === text) return response;

            return new Response(patched, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          } catch (e) {
            console.warn('[BiliUnlock] fetch patch failed:', e);
            return response;
          }
        });
      };
    }
  }

  // ─── 播放页优化逻辑 ─────────────────────────────────────────

  function getBiliPlayer() {
    return (
      document.querySelector('#bilibili-player')?.__vue__ ||
      document.querySelector('.bpx-player-container')?.__vue__ ||
      document.querySelector('#bilibili-player') ||
      null
    );
  }

  function trySetQuality(quality) {
    const player = getBiliPlayer();
    if (!player) return false;

    try {
      if (player.switchQuality) {
        player.switchQuality(quality);
        return true;
      }
      if (player.$refs?.player?.switchQuality) {
        player.$refs.player.switchQuality(quality);
        return true;
      }
      const core =
        player.getPlayer?.() ||
        player.player ||
        player.$refs?.player;
      if (core?.switchQuality) {
        core.switchQuality(quality);
        return true;
      }
    } catch (e) {
      console.warn('[BiliUnlock] switchQuality failed:', e);
    }
    return false;
  }

  function applyPreferredQuality() {
    if (!CONFIG.autoHighest && !CONFIG.preferQuality) return;

    const qualities = [120, 116, 112, 80, 64, 32, 16];
    const target = CONFIG.autoHighest
      ? qualities[0]
      : CONFIG.preferQuality;

    const attempt = (retries) => {
      if (retries <= 0) return;
      if (trySetQuality(target)) return;
      setTimeout(() => attempt(retries - 1), 800);
    };

    attempt(8);
  }

  function fixDashAudioSync() {
    if (!CONFIG.fixDashSync) return;

    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      if (video._biliSyncPatched) return;
      video._biliSyncPatched = true;

      video.addEventListener('ratechange', () => {
        if (video.playbackRate !== 1) {
          video.playbackRate = 1;
        }
      });

      const check = () => {
        if (video.buffered.length > 1) {
          const gap = video.buffered.end(0) - video.currentTime;
          if (gap > 2 && !video.paused) {
            video.currentTime = video.buffered.start(1) - 0.1;
          }
        }
      };

      video.addEventListener('waiting', check);
    });
  }

  function hideVipOverlays() {
    if (!CONFIG.hideVipPrompt) return;

    const selectors = [
      '.bpx-player-ctrl-quality-menu .vip',
      '.bpx-player-toast-wrap',
      '.bilibili-player-video-btn-quality .vip',
      '.try-vip',
      '[class*="open-vip"]',
      '.vip-limit-wrap',
    ];

    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.textContent?.includes('大会员') || el.textContent?.includes('VIP')) {
          el.style.display = 'none';
        }
      });
    });
  }

  function optimizePlayer() {
    fixDashAudioSync();
    hideVipOverlays();
    if (CONFIG.autoHighest || CONFIG.preferQuality) {
      applyPreferredQuality();
    }
  }

  function observePlayer() {
    if (playerObserver) {
      playerObserver.disconnect();
      playerObserver = null;
    }

    const target =
      document.querySelector('#bilibili-player') ||
      document.querySelector('.bpx-player-container') ||
      document.querySelector('#playerWrap');

    if (!target) return;

    playerObserver = new MutationObserver(() => {
      optimizePlayer();
    });

    playerObserver.observe(target, { childList: true, subtree: true });
    optimizePlayer();
  }

  function onVideoPageEnter() {
    if (pageActive) return;
    pageActive = true;
    console.info('[BiliUnlock] 进入视频页，启动播放优化');

    const waitForPlayer = (retries) => {
      if (retries <= 0) return;
      const hasPlayer =
        document.querySelector('#bilibili-player') ||
        document.querySelector('.bpx-player-container');
      if (hasPlayer) {
        observePlayer();
        return;
      }
      setTimeout(() => waitForPlayer(retries - 1), 500);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => waitForPlayer(30), { once: true });
    } else {
      waitForPlayer(30);
    }
  }

  function onVideoPageLeave() {
    if (!pageActive) return;
    pageActive = false;
    if (playerObserver) {
      playerObserver.disconnect();
      playerObserver = null;
    }
    console.info('[BiliUnlock] 离开视频页');
  }

  function checkRoute(href) {
    if (isVideoPage(href)) {
      onVideoPageEnter();
    } else {
      onVideoPageLeave();
    }
  }

  // ─── SPA 路由监听 ───────────────────────────────────────────

  function installSpaWatcher() {
    const notify = () => {
      const href = location.href;
      if (href === currentHref) return;
      currentHref = href;
      checkRoute(href);
    };

    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const ret = origPushState.apply(this, args);
      notify();
      return ret;
    };

    history.replaceState = function (...args) {
      const ret = origReplaceState.apply(this, args);
      notify();
      return ret;
    };

    window.addEventListener('popstate', notify);

    setInterval(() => {
      if (location.href !== currentHref) {
        notify();
      }
    }, 500);

    const bodyObserver = new MutationObserver(() => {
      if (location.href !== currentHref) {
        notify();
      }
    });

    const startBodyObserver = () => {
      if (document.body) {
        bodyObserver.observe(document.body, { childList: true, subtree: true });
      }
    };

    if (document.body) {
      startBodyObserver();
    } else {
      document.addEventListener('DOMContentLoaded', startBodyObserver, { once: true });
    }

    checkRoute(location.href);
  }

  // ─── 样式注入 ───────────────────────────────────────────────

  function injectStyles() {
    GM_addStyle(`
      .bpx-player-ctrl-quality-menu [class*="vip"],
      .bilibili-player-video-btn-quality [class*="vip"] {
        opacity: 1 !important;
        pointer-events: auto !important;
        filter: none !important;
      }
      .bpx-player-ctrl-quality-menu .quality-disabled,
      .bilibili-player-video-btn-quality .quality-disabled {
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    `);
  }

  // ─── 初始化 ─────────────────────────────────────────────────

  installRequestHooks();
  installSpaWatcher();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
  } else {
    injectStyles();
  }

  console.info('[BiliUnlock] 脚本已加载 v1.0.0', CONFIG);
})();
