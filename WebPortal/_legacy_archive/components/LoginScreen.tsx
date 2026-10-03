
import React, { useState, useEffect } from 'react';
import { User, Lock, Play, Settings, HelpCircle, ShieldAlert, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { audioService } from '../services/audioService';

interface LoginScreenProps {
    onLogin: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'ERROR' | 'SUCCESS', message: string } | null>(null);
    const [musicStarted, setMusicStarted] = useState(false);

    // Démarrer la musique de login au montage
    useEffect(() => {
        const timer = setTimeout(() => {
            audioService.playLoginMusic();
            setMusicStarted(true);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleUserInteraction = () => {
        if (!musicStarted) {
            audioService.playLoginMusic();
            setMusicStarted(true);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedback(null);

        if (username.length > 2) {
            setIsLoading(true);

            try {
                const result = await databaseService.login(username, password);

                if (result.success) {
                    setFeedback({ type: 'SUCCESS', message: 'Connexion réussie ! Préparation...' });
                    setTimeout(() => {
                        onLogin(username);
                    }, 500);
                } else {
                    setFeedback({ type: 'ERROR', message: result.message || 'Échec de la connexion.' });
                    setIsLoading(false);
                }
            } catch (err: any) {
                setFeedback({ type: 'ERROR', message: 'Erreur technique de connexion.' });
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden select-none" onClick={handleUserInteraction}>
            {/* Background Image - NARVOS PRIME Launcher Art */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-[20000ms] scale-110 animate-slow-pan"
                style={{
                    backgroundImage: `url('/textures/launcher/uploaded_image_0_1767472596705.jpg')`,
                    filter: 'brightness(0.7) contrast(1.1) saturate(1.2)'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-purple-900/30 to-cyan-900/20"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/80"></div>
            </div>

            {/* Icons décoratifs */}
            <div className="absolute top-20 left-20 w-24 h-24 animate-float-slow">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 opacity-50 blur-sm animate-pulse"
                    style={{ boxShadow: '0 0 60px 20px rgba(6, 182, 212, 0.4)' }}></div>
            </div>

            {/* Logo NARVOS PRIME */}
            <div className="absolute top-16 flex flex-col items-center gap-2 animate-fade-in-down z-10">
                <div className="relative">
                    <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-cyan-400 to-cyan-600 uppercase italic tracking-tighter">
                        NARVOS
                    </h1>
                </div>
                <h2 className="text-5xl font-black text-white/80 uppercase tracking-[0.6em] -mt-3">
                    PRIME
                </h2>
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
                                className="w-full bg-slate-950/70 border border-cyan-500/30 rounded-lg py-4 px-4 text-white text-lg focus:outline-none focus:border-cyan-400 transition-all"
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
                                className="w-full bg-slate-950/70 border border-cyan-500/30 rounded-lg py-4 px-4 text-white text-lg focus:outline-none focus:border-cyan-400 transition-all"
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
                <div className="bg-slate-950/80 px-6 py-4 rounded-xl border border-yellow-500/50 flex items-center gap-4">
                    <ShieldAlert className="text-yellow-500" size={24} />
                    <div>
                        <div className="text-yellow-400 font-black text-sm uppercase">Pack Fondateur</div>
                        <div className="text-xs text-white/40">Contenu exclusif disponible</div>
                    </div>
                </div>
            </div>

            {/* Version Badge */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/30 font-mono tracking-widest">
                VER. 1.0.0-NARVOS_PROTOTYPE
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
