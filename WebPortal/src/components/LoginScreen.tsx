// Adapted from Ingame/Client/components/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import { User, Lock, ShieldAlert, CheckCircle2, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';

// Service d'authentification WebSocket
import { login as wsLogin, getSocket } from '../services/authService';
import { APP_VERSION } from '../utils/version';

// Fallback pour mode localStorage (création de personnage offline)
const fallbackLogin = async (u: string, p: string) => {
    // En mode navigateur sans serveur, on autorise le mode démo
    localStorage.setItem('narvos_user', JSON.stringify({ username: u, role: 'USER' }));
    return { success: true, message: "Mode Démo (Hors-ligne)", role: 'USER' };
};

// Login avec WebSocket ou fallback Electron/localStorage
const realLogin = async (u: string, p: string) => {
    // 1. Priorité à Electron si disponible
    if (typeof window !== 'undefined' && (window as any).electronAPI?.verifyUser) {
        try {
            console.log('[Login] Tentative via Electron API...');
            const result = await (window as any).electronAPI.verifyUser(u, p);
            if (result.success) {
                const userData = {
                    username: result.user.username,
                    playerId: result.user.id.toString(),
                    role: result.user.role || 'USER',
                    token: 'electron-session'
                };
                localStorage.setItem('narvos_user', JSON.stringify(userData));
                return { success: true, message: result.message, role: result.user.role };
            }
            return { success: false, message: result.message };
        } catch (e) {
            console.error('[Login] Erreur Electron Auth:', e);
        }
    }

    // 2. Tenter la connexion WebSocket (Mode Serveur)
    try {
        const result = await wsLogin(u, p);
        if (result.success) {
            localStorage.setItem('narvos_user', JSON.stringify({
                username: u,
                playerId: result.playerId,
                role: result.role || 'USER',
                token: result.token
            }));
            return { success: true, message: result.message, role: result.role };
        }
        // wsLogin wraps connection errors as {success:false} — fall back to offline
        if (result.message?.includes('connecter') || result.message?.includes('serveur')) {
            console.warn('[Login] Serveur inaccessible, mode hors-ligne');
            return fallbackLogin(u, p);
        }
        return { success: false, message: result.message };
    } catch (e: any) {
        console.warn('[Login] WebSocket indisponible, mode hors-ligne');
        return fallbackLogin(u, p);
    }
};

interface LoginScreenProps {
    onLogin: (username: string, role?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'ERROR' | 'SUCCESS', message: string } | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedback(null);

        if (username.length > 2) {
            setIsLoading(true);
            try {
                // Use REAL login
                const result = await realLogin(username, password);

                if (result.success) {
                    setFeedback({ type: 'SUCCESS', message: result.message });
                    setTimeout(() => {
                        onLogin(username, result.role);
                    }, 500);
                } else {
                    setFeedback({ type: 'ERROR', message: result.message });
                    setIsLoading(false);
                }
            } catch (err: any) {
                setFeedback({ type: 'ERROR', message: 'Erreur technique de connexion.' });
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden select-none">
            {/* Background Image - NARVOS PRIME Launcher Art */}
            <video
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'brightness(0.7) contrast(1.1) saturate(1.2)' }}
                src="/models/launcher/ecrande_connection.mp4"
                autoPlay loop muted playsInline
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-purple-900/30 to-cyan-900/20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/80 pointer-events-none"></div>

            {/* Logo NARVOS PRIME */}
            {/* Logo NARVOS PRIME — animé (intro + flottement + glow), texte en double supprimé */}
            <div className="absolute top-20 flex flex-col items-center z-10">
                <style>{`
                    @keyframes logoIntro { 0% { opacity: 0; transform: translateY(-32px) scale(.82); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
                    @keyframes logoFloat { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-10px) rotate(1.5deg); } }
                    @keyframes logoGlow  { 0%, 100% { filter: drop-shadow(0 0 18px rgba(6,182,212,.45)); } 50% { filter: drop-shadow(0 0 40px rgba(6,182,212,.85)); } }
                `}</style>
                <div className="relative" style={{ animation: "logoIntro 1.2s cubic-bezier(.22,1,.36,1) both" }}>
                    {/* Halo radial pulsant derrière le logo (immersion sci-fi) */}
                    <div
                        className="absolute inset-0 -z-10 blur-3xl"
                        style={{
                            background: "radial-gradient(circle, rgba(6,182,212,.45), rgba(124,77,255,.18) 45%, transparent 70%)",
                            animation: "logoGlow 4s ease-in-out infinite",
                        }}
                    />
                    <img
                        src="/models/launcher/logod_jeux.png"
                        alt="NARVOS PRIME"
                        className="w-80 max-w-[60vw]"
                        style={{ animation: "logoFloat 6s ease-in-out infinite, logoGlow 4s ease-in-out infinite" }}
                    />
                </div>
            </div>

            {/* Login Panel */}
            <div className="relative w-full max-w-lg mt-32 animate-fade-in z-10">
                <div className="relative p-8 rounded-2xl overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0.9) 50%, rgba(6, 182, 212, 0.1) 100%)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        boxShadow: '0 0 40px rgba(6, 182, 212, 0.2)'
                    }}
                >
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-2">
                                <User size={12} /> Identifiant
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-slate-950/70 border border-cyan-500/30 rounded-lg py-4 px-4 text-white text-lg focus:outline-none focus:border-cyan-400 transition-all font-mono"
                                placeholder="Nom de compte"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-2">
                                <Lock size={12} /> Mot de Passe
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-950/70 border border-cyan-500/30 rounded-lg py-4 px-4 text-white text-lg focus:outline-none focus:border-cyan-400 transition-all font-mono"
                                placeholder="••••••••"
                            />
                        </div>

                        {feedback && (
                            <div className={`flex items-center gap-3 p-4 rounded-lg text-sm font-bold animate-fade-in
                                ${feedback.type === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
                            >
                                {feedback.type === 'ERROR' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                {feedback.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || username.length < 3}
                            className={`relative w-full py-5 rounded-lg font-black text-xl uppercase tracking-wider transition-all
                                ${username.length >= 3 ? 'bg-cyan-600 text-white shadow-lg hover:bg-cyan-500' : 'bg-slate-800 text-slate-500'}`}
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <span>Se Connecter</span>}
                        </button>
                    </form>
                </div>
            </div>

            {/* Shop Promo */}
            <div className="absolute bottom-8 right-8 animate-bounce-slow">
                <div className="bg-slate-950/80 px-6 py-4 rounded-xl border border-yellow-500/50 flex items-center gap-4" title="Pack soutien disponible dans la boutique — contenu exclusif pour les fondateurs">
                    <ShieldAlert className="text-yellow-500" size={24} />
                    <div>
                        <div className="text-yellow-400 font-black text-sm uppercase">Pack Fondateur</div>
                        <div className="text-xs text-white/40">Contenu exclusif disponible</div>
                    </div>
                </div>
            </div>

            {/* Version Badge */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/30 font-mono tracking-widest">
                VER. {APP_VERSION}
            </div>

            <style>{`
                @keyframes slow-pan {
                    0% { transform: scale(1.1) translate(0, 0); }
                    50% { transform: scale(1.15) translate(-1%, -1%); }
                    100% { transform: scale(1.1) translate(0, 0); }
                }
                .animate-slow-pan { animation: slow-pan 20s ease-in-out infinite; }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
                @keyframes fade-in-down {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.8s ease-out; }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 1s ease-out both; }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-slow { animation: bounce 3s ease-in-out infinite; }
            `}</style>
        </div>
    );
};
