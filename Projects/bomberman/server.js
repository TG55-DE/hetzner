'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;
const HOST = '127.0.0.1';

// Statische Dateien aus dem public-Ordner ausliefern
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true
}));

// Fallback: immer index.html zurückgeben (für PWA-Routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Bomberman-Server läuft auf http://${HOST}:${PORT}`);
});
