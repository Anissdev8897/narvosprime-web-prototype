import React, { useState } from 'react';
import { RPIdentity } from '../types';
import { X, User, BookOpen, AlertCircle } from 'lucide-react';

interface RPIdentityCreationProps {
  onComplete: (identity: RPIdentity) => void;
  onCancel?: () => void;
}

export const RPIdentityCreation: React.FC<RPIdentityCreationProps> = ({ onComplete, onCancel }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState(25);
  const [backstory, setBackstory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName.trim()) {
      setError('Le prénom est requis');
      return;
    }
    if (!lastName.trim()) {
      setError('Le nom est requis');
      return;
    }
    if (age < 18 || age > 150) {
      setError('L\'âge doit être entre 18 et 150 ans');
      return;
    }
    if (backstory.trim().length < 50) {
      setError('L\'histoire personnelle doit contenir au moins 50 caractères');
      return;
    }

    const identity: RPIdentity = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      age,
      backstory: backstory.trim(),
      createdAt: Date.now()
    };

    onComplete(identity);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 backdrop-blur-md z-50">
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-blue-500 rounded-lg p-8 relative">
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        )}

        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="text-blue-400" size={32} />
          <div>
            <h2 className="text-3xl font-black text-white">Création d'Identité RP</h2>
            <p className="text-slate-400 text-sm font-mono">Votre identité dans l'univers de Narvos Prime</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prénom et Nom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">
                <User size={16} className="inline mr-2" />
                Prénom *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: Kael"
                maxLength={30}
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-2">
                Nom *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: Vexaris"
                maxLength={30}
              />
            </div>
          </div>

          {/* Âge */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">
              Âge *
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(Math.max(18, Math.min(150, parseInt(e.target.value) || 18)))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              min={18}
              max={150}
            />
            <p className="text-slate-500 text-xs mt-1">Entre 18 et 150 ans</p>
          </div>

          {/* Histoire personnelle */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">
              Histoire Personnelle (RP) *
            </label>
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none"
              rows={8}
              placeholder="Racontez votre histoire, votre passé, vos motivations... (minimum 50 caractères)"
              maxLength={2000}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-slate-500 text-xs">
                {backstory.length} / 2000 caractères (minimum 50)
              </p>
              {backstory.length < 50 && (
                <p className="text-yellow-500 text-xs">
                  {50 - backstory.length} caractères restants
                </p>
              )}
            </div>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="text-red-400" size={20} />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Avertissement */}
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              <strong>⚠️ Important :</strong> Cette identité sera permanente et visible par les gardiens de faction. 
              Assurez-vous que votre histoire RP est cohérente avec l'univers du jeu.
            </p>
          </div>

          {/* Boutons */}
          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Créer l'Identité
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

