import React from 'react';
import { Rocket, Target, ArrowUp } from 'lucide-react';

interface ActionButtonsProps {
  onFire: () => void;
  onAscend: () => void;
  onDescend: () => void;
  canFire?: boolean;
  canAscend?: boolean;
  canDescend?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onFire,
  onAscend,
  onDescend,
  canFire = true,
  canAscend = true,
  canDescend = true
}) => {
  return (
    <div className="absolute top-8 right-8 flex flex-col gap-2 z-30 pointer-events-auto">
      {/* DESCEND Button */}
      <button
        onClick={onDescend}
        disabled={!canDescend}
        className={`
          flex items-center gap-2 px-4 py-2 rounded border-2 transition-all
          ${canDescend 
            ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.6)] active:scale-95' 
            : 'bg-slate-800/50 border-slate-600 text-slate-500 cursor-not-allowed opacity-50'}
          shadow-lg
        `}
      >
        <Rocket size={16} className="rotate-180" />
        <span className="text-xs font-bold uppercase tracking-wider">DESCE</span>
      </button>

      {/* FIRE Button */}
      <button
        onClick={onFire}
        disabled={!canFire}
        className={`
          flex items-center gap-2 px-4 py-2 rounded border-2 transition-all
          ${canFire 
            ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 hover:bg-yellow-500/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.6)] active:scale-95' 
            : 'bg-slate-800/50 border-slate-600 text-slate-500 cursor-not-allowed opacity-50'}
          shadow-lg
        `}
      >
        <Target size={16} />
        <span className="text-xs font-bold uppercase tracking-wider">FIRE</span>
      </button>

      {/* ASCEND Button */}
      <button
        onClick={onAscend}
        disabled={!canAscend}
        className={`
          flex items-center gap-2 px-4 py-2 rounded border-2 transition-all
          ${canAscend 
            ? 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.6)] active:scale-95' 
            : 'bg-slate-800/50 border-slate-600 text-slate-500 cursor-not-allowed opacity-50'}
          shadow-lg
        `}
      >
        <ArrowUp size={16} />
        <span className="text-xs font-bold uppercase tracking-wider">ASCEN</span>
      </button>
    </div>
  );
};

