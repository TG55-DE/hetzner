// Haupt-App: Routing und Authentifizierungsschutz
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AppsPage from './pages/AppsPage';
import SettingsPage from './pages/SettingsPage';

// Schützt Routen: Nicht-eingeloggte User werden zur Login-Seite weitergeleitet
function ProtectedRoute({ children }) {
    const { isLoggedIn } = useAuth();
    return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
    const { isLoggedIn } = useAuth();
    // Gewähltes Modell wird hier gespeichert und an alle Seiten weitergegeben
    const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');

    return (
        <Routes>
            {/* Login-Seite: Eingeloggte User werden zum Chat weitergeleitet */}
            <Route
                path="/login"
                element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />}
            />

            {/* Geschützte Seiten */}
            <Route path="/" element={
                <ProtectedRoute>
                    <ChatPage selectedModel={selectedModel} />
                </ProtectedRoute>
            } />
            <Route path="/apps" element={
                <ProtectedRoute>
                    <AppsPage />
                </ProtectedRoute>
            } />
            <Route path="/settings" element={
                <ProtectedRoute>
                    <SettingsPage selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
                </ProtectedRoute>
            } />

            {/* Unbekannte Routen → zum Chat */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}
