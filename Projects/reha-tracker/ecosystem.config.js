// PM2 Konfiguration – Reha Tracker
// Port und Name sind hier fest gesperrt – NIEMALS ändern ohne APPS.md zu prüfen
module.exports = {
  apps: [
    {
      name: 'reha-tracker',
      script: 'server.js',
      cwd: '/home/timo_hahn/Timos_CC_Projekte/Projects/reha-tracker',
      env: {
        PORT: 3002,
        NODE_ENV: 'production'
      }
    }
  ]
};
