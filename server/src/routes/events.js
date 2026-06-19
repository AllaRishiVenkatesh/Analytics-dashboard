const express = require('express');
const {
  ingestEvents,
  listSessions,
  getSessionEvents,
  getHeatmapData,
  listPages
} = require('../controllers/eventsController');

const router = express.Router();

router.post('/events', ingestEvents);
router.get('/sessions', listSessions);
router.get('/sessions/:sessionId/events', getSessionEvents);
router.get('/heatmap', getHeatmapData);
router.get('/pages', listPages);

module.exports = router;
