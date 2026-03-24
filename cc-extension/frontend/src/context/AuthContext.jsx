// Auth-Kontext: Verwaltet den Login-Status der gesamten App
// Alle Seiten können darüber prüfen ob der User eingeloggt ist
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [email, setEmail] = useState(localStorage.getItem('email'));

    // Beim Einloggen: Token im localStorage (iPhone-Speicher) sichern
    function login(newToken, userEmail) {
        localStorage.setItem('token', newToken);
        localStorage.setItem('email', userEmail);
        setToken(newToken);
        setEmail(userEmail);
    }

    // Beim Ausloggen: Alles löschen
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('email');
        setToken(null);
        setEmail(null);
    }

    return (
        <AuthContext.Provider value={{ token, email, login, logout, isLoggedIn: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

// Hilfsfunktion für andere Komponenten: useAuth() statt useContext(AuthContext)
export function useAuth() {
    return useContext(AuthContext);
}
