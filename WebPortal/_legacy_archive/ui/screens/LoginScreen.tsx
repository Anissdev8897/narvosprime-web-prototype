/**
 * 🔐 NARVOS PRIME - LOGIN SCREEN (CLIENT)
 * Écran de connexion sécurisé.
 * N'envoie que les credentials au serveur, pas de logique locale.
 */

import React, { useState } from 'react';
import { User, Lock, Loader2, CheckCircle2, AlertCircle, Settings, Volume2, VolumeX } from 'lucide-react';
import { getSocket, initSocket } from '../../net/socket';
import { audioManager } from '../../src/utils/AudioManager';

interface LoginScreenProps {
    onLogin: (username: string, playerId: string) => void;
    serverUrl?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
    onLogin,
    serverUrl = 'ws://localhost:8080'
}) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [mv, setMv] = useState(audioManager.getMusicVolume());
    const [sv, setSv] = useState(audioManager.getSfxVolume());
    const [feedback, setFeedback] = useState<{ type: 'ERROR' | 'SUCCESS', message: string } | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        audioManager.playButtonClick();
        setFeedback(null);

        if (username.length < 3) {
            setFeedback({ type: 'ERROR', message: 'Nom d\'utilisateur trop court (min 3 caractères)' });
            return;
        }

        if (password.length < 4) {
            setFeedback({ type: 'ERROR', message: 'Mot de passe trop court (min 4 caractères)' });
            return;
        }

        setIsConnecting(true);

        try {
            // Initialiser la connexion WebSocket
            const socket = initSocket({
                url: serverUrl,
                onConnect: () => console.log('[Login] Connected to server'),
                onDisconnect: () => console.log('[Login] Disconnected'),
                onError: () => setFeedback({ type: 'ERROR', message: 'Impossible de se connecter au serveur' })
            });

            await socket.connect();
            setIsConnecting(false);
            setIsLoading(true);

            // Envoyer les credentials au serveur (le serveur valide tout)
            const result = await socket.login(username, password);

            if (result.success && result.playerId) {
                setFeedback({ type: 'SUCCESS', message: 'Connexion réussie !' });
                setTimeout(() => {
                    onLogin(username, result.playerId!);
                }, 500);
            } else {
                setFeedback({ type: 'ERROR', message: 'Identifiants incorrects' });
                setIsLoading(false);
            }

        } catch (error: any) {
            console.error('[Login] Error:', error);
            setFeedback({ type: 'ERROR', message: 'Erreur de connexion au serveur' });
            setIsConnecting(false);
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden select-none">
            {/* Background */}
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url('/textures/launcher/uploaded_image_0_1767472596705.jpg')`,
                    filter: 'brightness(0.7) contrast(1.1) saturate(1.2)'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-purple-900/30 to-cyan-900/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/80" />
            </div>

            {/* Logo */}
            <div className="absolute top-16 flex flex-col items-center gap-2 z-10">
                <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-cyan-400 to-cyan-600 uppercase italic tracking-tighter">
                    NARVOS
                </h1>
                <h2 className="text-5xl font-black text-white/80 uppercase tracking-[0.6em] -mt-3">
                    PRIME
                </h2>
            </div>

            {/* Login Panel */}
            <div className="relative w-full max-w-lg mt-32 z-10">
                <div
                    className="relative p-8 rounded-2xl overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0.9) 50%, rgba(6, 182, 212, 0.1) 100%)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        boxShadow: '0 0 40px rgba(6, 182, 212, 0.2)'
                    }}
                >
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Username */}
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
                                disabled={isLoading || isConnecting}
                            />
                        </div>

                        {/* Password */}
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
                                disabled={isLoading || isConnecting}
                            />
                        </div>

                        {/* Feedback */}
                        {feedback && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${feedback.type === 'ERROR'
                                ? 'bg-red-500/20 border border-red-500/50 text-red-300'
                                : 'bg-green-500/20 border border-green-500/50 text-green-300'
                                }`}>
                                {feedback.type === 'ERROR'
                                    ? <AlertCircle size={16} />
                                    : <CheckCircle2 size={16} />
                                }
                                <span className="text-sm">{feedback.message}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || isConnecting}
                            className="w-full py-4 rounded-lg font-bold text-lg uppercase tracking-widest 
                                       bg-gradient-to-r from-cyan-600 to-cyan-500 text-white
                                       hover:from-cyan-500 hover:to-cyan-400 
                                       disabled:opacity-50 disabled:cursor-not-allowed
                                       transition-all shadow-lg shadow-cyan-500/30"
                        >
                            {isConnecting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={20} className="animate-spin" />
                                    Connexion au serveur...
                                </span>
                            ) : isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={20} className="animate-spin" />
                                    Authentification...
                                </span>
                            ) : (
                                'Se Connecter'
                            )}
                        </button>
                    </form>

                    {/* Server Status */}
                    <div className="mt-4 text-center text-xs text-slate-500">
                        Serveur: {serverUrl}
                    </div>
                </div>
            </div>

            {/* Settings Button */}
            <div className="absolute top-4 right-4 z-50">
                <button
                    onClick={() => {
                        audioManager.playButtonClick();
                        setShowSettings(!showSettings);
                    }}
                    className="p-3 bg-slate-900/50 border border-cyan-500/30 rounded-full text-cyan-400 hover:bg-cyan-500/20 transition-all shadow-lg"
                >
                    <Settings size={24} className={showSettings ? 'animate-spin-slow' : ''} />
                </button>
            </div>

            {/* Settings Overlay */}
            {showSettings && (
                <div className="absolute top-20 right-4 z-50 w-64 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/40 p-6 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300">
                    <h3 className="text-cyan-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Volume2 size={16} /> Réglages Son
                    </h3>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                                <span>Musique</span>
                                <span className="text-cyan-400">{Math.round(mv * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.01" value={mv}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setMv(v);
                                    audioManager.setMusicVolume(v);
                                }}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                                <span>Effets</span>
                                <span className="text-purple-400">{Math.round(sv * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.01" value={sv}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setSv(v);
                                    audioManager.setSfxVolume(v);
                                }}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full py-2 bg-cyan-700/50 hover:bg-cyan-600/50 text-cyan-100 text-xs font-bold uppercase tracking-widest rounded transition-all mt-4"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}

            {/* Version */}
            <div className="absolute bottom-4 right-4 text-slate-600 text-xs">
                v1.0.0 - Architecture Sécurisée
            </div>
        </div>
    );
};

export default LoginScreen;
