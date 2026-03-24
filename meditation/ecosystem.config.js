// PM2 Konfiguration – Meditation App
// Port und Name sind hier fest gesperrt – NIEMALS ändern ohne APPS.md zu prüfen
module.exports = {
  apps: [
    {
      name: 'meditation-app',
      script: 'server.js',
      cwd: '/home/timo_hahn/Timos_CC_Projekte/meditation',
      env: {
        PORT: 3001,
        NODE_ENV: 'production'
      }
    }
  ]
};
