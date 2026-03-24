// Einstellungen-Seite: Modell-Auswahl und weitere Optionen
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SettingsPage.css';

// Verfügbare Claude-Modelle
const MODELS = [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: 'Schnell & leistungsstark – Standard' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', desc: 'Stärkste Reasoning-Fähigkeiten' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', desc: 'Besonders schnell & sparsam' },
];

export default function SettingsPage({ selectedModel, setSelectedModel }) {
    const navigate = useNavigate();
    const { email, logout } = useAuth();

    return (
        <div className="settings-page">
            <div className="settings-header">
                <button className="btn-back" onClick={() => navigate('/')}>← Zurück</button>
                <h1>Einstellungen</h1>
            </div>

            <div className="settings-content">
                {/* Modell-Auswahl */}
                <section className="settings-section">
                    <h2>Claude Modell</h2>
                    <div className="model-list">
                        {MODELS.map(model => (
                            <button
                                key={model.id}
                                className={`model-item ${selectedModel === model.id ? 'selected' : ''}`}
                                onClick={() => setSelectedModel(model.id)}
                            >
                                <div className="model-name">{model.name}</div>
                                <div className="model-desc">{model.desc}</div>
                                {selectedModel === model.id && <span className="model-check">✓</span>}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Konto */}
                <section className="settings-section">
                    <h2>Konto</h2>
                    <div className="settings-info">
                        <span>Eingeloggt als:</span>
                        <strong>{email}</strong>
                    </div>
                    <button className="btn-danger" onClick={logout}>
                        Ausloggen
                    </button>
                </section>
            </div>
        </div>
    );
}
