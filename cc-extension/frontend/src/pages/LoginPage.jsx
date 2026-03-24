// Login-Seite: Registrierung und Einloggen
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../services/api';
import './LoginPage.css';

export default function LoginPage() {
    const { login } = useAuth();
    const [isRegister, setIsRegister] = useState(false); // Zwischen Login und Registrierung wechseln
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault(); // Seite nicht neu laden
        setError('');
        setLoading(true);

        try {
            // Registrieren oder einloggen
            const data = isRegister
                ? await apiRegister(email, password)
                : await apiLogin(email, password);

            // Token speichern → User ist jetzt eingeloggt
            login(data.token, data.email);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <span>🤖</span>
                    <h1>CC Extension</h1>
                    <p>Dein persönlicher AI Developer Agent</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <label>E-Mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="deine@email.de"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="input-group">
                        <label>Passwort</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mindestens 8 Zeichen"
                            required
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? '...' : isRegister ? 'Registrieren' : 'Einloggen'}
                    </button>
                </form>

                <button
                    className="toggle-mode"
                    onClick={() => { setIsRegister(!isRegister); setError(''); }}
                >
                    {isRegister
                        ? 'Bereits registriert? Einloggen'
                        : 'Noch kein Konto? Registrieren'}
                </button>
            </div>
        </div>
    );
}
