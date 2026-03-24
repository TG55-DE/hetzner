// Authentifizierungs-Middleware
// Prüft bei jeder geschützten Route ob ein gültiges JWT-Token vorhanden ist
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    // Token aus dem Authorization-Header lesen (Format: "Bearer TOKEN")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Kein Token – bitte einloggen' });
    }

    try {
        // Token entschlüsseln und prüfen
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // User-Infos an den Request hängen
        next(); // Weiter zur eigentlichen Route
    } catch (err) {
        return res.status(403).json({ error: 'Token ungültig oder abgelaufen' });
    }
}

module.exports = authMiddleware;
