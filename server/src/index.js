require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const eventsRouter = require('./routes/events');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/causalfunnel_analytics';

const app = express();

// CSP/COEP are disabled because this app intentionally serves demo pages
// that get embedded in an iframe by the dashboard's heatmap view.
// frameguard is disabled because the dashboard (a different origin in dev)
// intentionally iframes the demo pages for the heatmap overlay.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, frameguard: false }));
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(morgan('dev'));

// Serve the tracker script and demo storefront so the dashboard can load
// them directly (and the tracker can be embedded in the demo pages by path).
app.use('/tracker', express.static(path.join(__dirname, '../../tracker')));
app.use('/demo', express.static(path.join(__dirname, '../../demo')));

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api', eventsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await connectDB(MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
  }
}

start();
