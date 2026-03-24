// Worker-Prozess – wird separat gestartet
// Verarbeitet Deployment-Jobs aus der Redis-Queue
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log('Starte Deployment-Worker...');

// Worker laden (registriert sich automatisch bei BullMQ)
require('./services/worker');
