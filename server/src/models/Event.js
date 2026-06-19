const mongoose = require('mongoose');

const EVENT_TYPES = ['page_view', 'click'];

const eventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    type: { type: String, enum: EVENT_TYPES, required: true, index: true },
    url: { type: String, required: true },
    path: { type: String, index: true },
    referrer: { type: String, default: null },
    timestamp: { type: Date, required: true, index: true },

    // Click-only fields. Stored both as raw pixels and as percentages of the
    // document's scroll size, so the heatmap can plot accurately regardless
    // of the viewport the click happened on.
    x: { type: Number },
    y: { type: Number },
    xPercent: { type: Number },
    yPercent: { type: Number },

    viewportWidth: Number,
    viewportHeight: Number,
    docWidth: Number,
    docHeight: Number,

    targetTag: String,
    targetId: String,
    targetClass: String,
    targetText: String,
    userAgent: String
  },
  { timestamps: true }
);

// Sessions view: events for one session, in order.
eventSchema.index({ sessionId: 1, timestamp: 1 });
// Heatmap view: clicks for one page.
eventSchema.index({ path: 1, type: 1 });

module.exports = mongoose.model('Event', eventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
