// PM2 Ecosystem-Konfiguration
// Startet Backend und Worker als separate, überwachte Prozesse
// Verwendung: pm2 start ecosystem.config.js

module.exports = {
    apps: [
        {
            // ---- Backend-Server ----
            name: 'cc-extension-backend',
            script: 'src/index.js',
            cwd: '/home/timo_hahn/Timos_CC_Projekte/Projects/cc-extension/backend',

            // Automatisch neustarten wenn der Prozess abstürzt
            autorestart: true,
            watch: false, // Kein Datei-Watching in Produktion

            // Speicher-Limit: Neustart wenn mehr als 500MB verbraucht werden
            max_memory_restart: '500M',

            // Umgebungsvariablen – PORT ist hier fest gesperrt (APPS.md: Port 3000)
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },

            // Logs in den logs-Ordner schreiben
            output: '/home/timo_hahn/Timos_CC_Projekte/logs/backend.log',
            error:  '/home/timo_hahn/Timos_CC_Projekte/logs/backend-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',

            // Wartezeit zwischen Neustarts
            restart_delay: 3000,
        },
        {
            // ---- Deployment-Worker ----
            name: 'cc-extension-worker',
            script: 'src/worker-process.js',
            cwd: '/home/timo_hahn/Timos_CC_Projekte/Projects/cc-extension/backend',

            autorestart: true,
            watch: false,
            max_memory_restart: '500M',

            env: {
                NODE_ENV: 'production',
            },

            output: '/home/timo_hahn/Timos_CC_Projekte/logs/worker.log',
            error:  '/home/timo_hahn/Timos_CC_Projekte/logs/worker-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',

            restart_delay: 3000,
        },
    ],
};
