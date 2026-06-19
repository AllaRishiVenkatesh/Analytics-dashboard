const Event = require('../models/Event');

const MAX_EVENTS_PER_REQUEST = 100;

function numberOrUndefined(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function safePathFromUrl(url) {
  try {
    return new URL(url).pathname;
  } catch (e) {
    return undefined;
  }
}

/**
 * Whitelists and coerces an incoming event payload. Returns null if the
 * event is missing required fields or has an unrecognized type, so a single
 * malformed event in a batch can't poison the whole insert.
 */
function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { sessionId, type, url, timestamp } = raw;
  if (!sessionId || !type || !url || !timestamp) return null;
  if (!Event.EVENT_TYPES.includes(type)) return null;

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) return null;

  return {
    sessionId: String(sessionId).slice(0, 128),
    type,
    url: String(url).slice(0, 2048),
    path: raw.path ? String(raw.path).slice(0, 512) : safePathFromUrl(url),
    referrer: raw.referrer ? String(raw.referrer).slice(0, 2048) : null,
    timestamp: parsedTimestamp,
    x: numberOrUndefined(raw.x),
    y: numberOrUndefined(raw.y),
    xPercent: numberOrUndefined(raw.xPercent),
    yPercent: numberOrUndefined(raw.yPercent),
    viewportWidth: numberOrUndefined(raw.viewportWidth),
    viewportHeight: numberOrUndefined(raw.viewportHeight),
    docWidth: numberOrUndefined(raw.docWidth),
    docHeight: numberOrUndefined(raw.docHeight),
    targetTag: raw.targetTag ? String(raw.targetTag).slice(0, 50) : undefined,
    targetId: raw.targetId ? String(raw.targetId).slice(0, 200) : undefined,
    targetClass: raw.targetClass ? String(raw.targetClass).slice(0, 300) : undefined,
    targetText: raw.targetText ? String(raw.targetText).slice(0, 200) : undefined,
    userAgent: raw.userAgent ? String(raw.userAgent).slice(0, 500) : undefined
  };
}

/**
 * POST /api/events
 * Accepts either a single event object or { events: [...] } for batched
 * delivery (the tracker always sends batches).
 */
async function ingestEvents(req, res, next) {
  try {
    const body = req.body || {};
    const rawEvents = Array.isArray(body.events) ? body.events : [body];

    if (rawEvents.length === 0) {
      return res.status(400).json({ error: 'No events provided' });
    }
    if (rawEvents.length > MAX_EVENTS_PER_REQUEST) {
      return res.status(413).json({ error: `Too many events in one request (max ${MAX_EVENTS_PER_REQUEST})` });
    }

    const docs = rawEvents.map(normalizeEvent).filter(Boolean);

    if (docs.length === 0) {
      return res.status(400).json({ error: 'No valid events in payload' });
    }

    await Event.insertMany(docs, { ordered: false });

    return res.status(201).json({ received: rawEvents.length, stored: docs.length });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/sessions
 * One row per sessionId with aggregate counts, newest activity first.
 */
async function listSessions(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $group: {
          _id: '$sessionId',
          eventCount: { $sum: 1 },
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' },
          pages: { $addToSet: '$path' },
          clickCount: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
          pageViewCount: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
          userAgent: { $first: '$userAgent' }
        }
      },
      { $sort: { lastSeen: -1 } }
    ];

    const [sessions, totalResult] = await Promise.all([
      Event.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
      Event.aggregate([...pipeline, { $count: 'total' }])
    ]);

    const total = totalResult[0] ? totalResult[0].total : 0;

    const formatted = sessions.map((s) => ({
      sessionId: s._id,
      eventCount: s.eventCount,
      clickCount: s.clickCount,
      pageViewCount: s.pageViewCount,
      pagesVisited: s.pages.filter(Boolean).length,
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen,
      durationMs: new Date(s.lastSeen) - new Date(s.firstSeen),
      userAgent: s.userAgent || null
    }));

    return res.json({ sessions: formatted, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/sessions/:sessionId/events
 * Full ordered event timeline for one session (the "user journey").
 */
async function getSessionEvents(req, res, next) {
  try {
    const { sessionId } = req.params;
    const events = await Event.find({ sessionId }).sort({ timestamp: 1 }).lean();

    if (events.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({ sessionId, count: events.length, events });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/heatmap?path=/some-page
 * Click coordinates for one page, most recent first, capped to keep the
 * payload (and the rendered DOM) reasonable.
 */
async function getHeatmapData(req, res, next) {
  try {
    const { path: pagePath } = req.query;
    if (!pagePath) {
      return res.status(400).json({ error: 'Query param "path" is required' });
    }

    const clicks = await Event.find({ path: pagePath, type: 'click' })
      .select('x y xPercent yPercent viewportWidth viewportHeight docWidth docHeight timestamp targetTag targetText -_id')
      .sort({ timestamp: -1 })
      .limit(5000)
      .lean();

    return res.json({ path: pagePath, count: clicks.length, clicks });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/pages
 * Distinct page paths that have any tracked activity, used to populate the
 * heatmap page selector.
 */
async function listPages(req, res, next) {
  try {
    const pages = await Event.aggregate([
      { $match: { path: { $ne: null } } },
      {
        $group: {
          _id: '$path',
          totalEvents: { $sum: 1 },
          clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
          pageViews: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } }
        }
      },
      { $sort: { totalEvents: -1 } }
    ]);

    return res.json({
      pages: pages.map((p) => ({
        path: p._id,
        totalEvents: p.totalEvents,
        clicks: p.clicks,
        pageViews: p.pageViews
      }))
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { ingestEvents, listSessions, getSessionEvents, getHeatmapData, listPages };
