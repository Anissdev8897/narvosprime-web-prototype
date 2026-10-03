import React, { useState } from 'react';
import { User, UserCheck } from 'lucide-react';
import { Faction, Gender } from '../types';
import { FACTION_COLORS } from '../constants';

interface GenderSelectionProps {
  faction: Faction;
  onSelect: (gender: Gender) => void;
}

export const GenderSelection: React.FC<GenderSelectionProps> = ({ faction, onSelect }) => {
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const factionColor = FACTION_COLORS[faction] || '#3b82f6';

  const handleConfirm = () => {
    if (selectedGender) {
      onSelect(selectedGender);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur z-50">
      <div className="w-[600px] bg-slate-900 border-2 rounded-lg shadow-2xl overflow-hidden" style={{ borderColor: factionColor }}>
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-900 border-b-2" style={{ borderColor: factionColor }}>
          <h2 className="text-3xl font-black text-white tracking-widest">SELECT YOUR IDENTITY</h2>
          <p className="text-sm text-slate-400 mt-2 font-mono">Choose your character model before deployment</p>
        </div>

        {/* Gender Selection */}
        <div className="p-8">
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Male Option */}
            <button
              onClick={() => setSelectedGender(Gender.MALE)}
              className={`p-8 border-2 rounded-lg transition-all ${selectedGender === Gender.MALE
                  ? 'border-blue-500 bg-blue-900/20 scale-105'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                }`}
              style={selectedGender === Gender.MALE ? { borderColor: factionColor, backgroundColor: `${factionColor}20` } : {}}
            >
              <div className="flex flex-col items-center gap-4">
                <div className={`p-6 rounded-full ${selectedGender === Gender.MALE ? 'bg-blue-600' : 'bg-slate-700'}`} style={selectedGender === Gender.MALE ? { backgroundColor: factionColor } : {}}>
                  <User size={48} className="text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">MALE</h3>
                  <p className="text-xs text-slate-400">Homme</p>
                </div>
                {selectedGender === Gender.MALE && (
                  <UserCheck size={24} className="text-blue-400" style={{ color: factionColor }} />
                )}
              </div>
            </button>

            {/* Female Option */}
            <button
              onClick={() => setSelectedGender(Gender.FEMALE)}
              className={`p-8 border-2 rounded-lg transition-all ${selectedGender === Gender.FEMALE
                  ? 'border-blue-500 bg-blue-900/20 scale-105'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                }`}
              style={selectedGender === Gender.FEMALE ? { borderColor: factionColor, backgroundColor: `${factionColor}20` } : {}}
            >
              <div className="flex flex-col items-center gap-4">
                <div className={`p-6 rounded-full ${selectedGender === Gender.FEMALE ? 'bg-blue-600' : 'bg-slate-700'}`} style={selectedGender === Gender.FEMALE ? { backgroundColor: factionColor } : {}}>
                  <User size={48} className="text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">FEMALE</h3>
                  <p className="text-xs text-slate-400">Femme</p>
                </div>
                {selectedGender === Gender.FEMALE && (
                  <UserCheck size={24} className="text-blue-400" style={{ color: factionColor }} />
                )}
              </div>
            </button>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={!selectedGender}
            className={`w-full py-4 font-bold text-lg rounded transition-all ${selectedGender
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            style={selectedGender ? { backgroundColor: factionColor } : {}}
          >
            {selectedGender ? 'CONFIRM SELECTION' : 'SELECT A GENDER'}
          </button>
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center font-mono">
            This choice cannot be changed after deployment
          </p>
        </div>
      </div>
    </div>
  );
};

