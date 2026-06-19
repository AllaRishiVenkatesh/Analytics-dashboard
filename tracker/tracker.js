/**
 * CFAnalytics — minimal client-side event tracker.
 *
 * Drop this on any page:
 *   <script src="/tracker/tracker.js" data-endpoint="https://your-api.com/api/events"></script>
 *
 * It auto-initializes on load, tracks a page_view immediately, listens for
 * clicks for the lifetime of the page, batches events in memory, and flushes
 * them on an interval and on page exit (via sendBeacon so nothing is lost
 * when the tab closes mid-request).
 */
(function (window, document) {
  'use strict';

  var DEFAULT_ENDPOINT = '/api/events';
  var SESSION_KEY = 'cf_session_id';
  var SESSION_TS_KEY = 'cf_session_last_active';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // idle sessions roll over after 30 min, like GA
  var FLUSH_INTERVAL_MS = 5000;
  var MAX_BATCH_SIZE = 20;

  function generateId() {
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function getSessionId() {
    try {
      var now = Date.now();
      var stored = window.localStorage.getItem(SESSION_KEY);
      var lastActive = parseInt(window.localStorage.getItem(SESSION_TS_KEY), 10);
      if (!stored || !lastActive || (now - lastActive) > SESSION_TIMEOUT_MS) {
        stored = generateId();
        window.localStorage.setItem(SESSION_KEY, stored);
      }
      window.localStorage.setItem(SESSION_TS_KEY, String(now));
      return stored;
    } catch (e) {
      // localStorage can throw in private-browsing/blocked-storage contexts.
      if (!window.__cfFallbackSession) {
        window.__cfFallbackSession = generateId();
      }
      return window.__cfFallbackSession;
    }
  }

  function CFAnalytics(options) {
    options = options || {};
    this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
    this.queue = [];
    this.sessionId = getSessionId();
    this._bindLifecycleFlush();
    this._scheduleFlush();
  }

  CFAnalytics.prototype._baseEvent = function (type) {
    return {
      sessionId: this.sessionId,
      type: type,
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      docWidth: document.documentElement.scrollWidth,
      docHeight: document.documentElement.scrollHeight,
      userAgent: navigator.userAgent
    };
  };

  CFAnalytics.prototype.track = function (type, extra) {
    var evt = this._baseEvent(type);
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) {
          evt[key] = extra[key];
        }
      }
    }
    this.queue.push(evt);
    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flush(false);
    }
  };

  CFAnalytics.prototype.trackPageView = function () {
    this.track('page_view');
  };

  CFAnalytics.prototype.trackClick = function (e) {
    var target = e.target;
    var docEl = document.documentElement;
    var pageX = e.pageX != null ? e.pageX : (e.clientX + (window.pageXOffset || docEl.scrollLeft));
    var pageY = e.pageY != null ? e.pageY : (e.clientY + (window.pageYOffset || docEl.scrollTop));
    var docWidth = docEl.scrollWidth || 1;
    var docHeight = docEl.scrollHeight || 1;

    this.track('click', {
      x: pageX,
      y: pageY,
      // Percentage coordinates make the heatmap viewport-independent: a click
      // at 50% width on a phone and 50% width on a desktop plot to the same
      // relative spot, which raw pixels alone can't give you.
      xPercent: +(pageX / docWidth * 100).toFixed(2),
      yPercent: +(pageY / docHeight * 100).toFixed(2),
      targetTag: target && target.tagName ? target.tagName.toLowerCase() : null,
      targetId: target && target.id ? target.id : null,
      targetClass: target && typeof target.className === 'string' ? target.className : null,
      targetText: target && target.innerText ? target.innerText.trim().slice(0, 60) : null
    });
  };

  CFAnalytics.prototype.flush = function (useBeacon) {
    if (this.queue.length === 0) return;
    var events = this.queue.splice(0, this.queue.length);
    var payload = JSON.stringify({ events: events });

    if (useBeacon && navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      var delivered = navigator.sendBeacon(this.endpoint, blob);
      if (delivered) return;
      // fall through to fetch if the browser rejected the beacon (e.g. payload too large)
    }

    fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(function () {
      // Best-effort delivery: a tracking failure should never break the host page.
    });
  };

  CFAnalytics.prototype._scheduleFlush = function () {
    var self = this;
    window.setInterval(function () {
      self.flush(false);
    }, FLUSH_INTERVAL_MS);
  };

  CFAnalytics.prototype._bindLifecycleFlush = function () {
    var self = this;

    document.addEventListener('click', function (e) {
      self.trackClick(e);
    }, true);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        self.flush(true);
      }
    });

    window.addEventListener('pagehide', function () {
      self.flush(true);
    });
  };

  function init(options) {
    var instance = new CFAnalytics(options);
    instance.trackPageView();
    window.cfAnalytics = instance;
    return instance;
  }

  window.CFAnalytics = { init: init };

  // Auto-init from the script tag's own attributes, GA-snippet style, unless
  // the page opts out with data-auto-init="false" and calls CFAnalytics.init() itself.
  var currentScript = document.currentScript;
  if (currentScript && currentScript.getAttribute('data-auto-init') !== 'false') {
    var endpointAttr = currentScript.getAttribute('data-endpoint');
    init(endpointAttr ? { endpoint: endpointAttr } : {});
  }
})(window, document);
