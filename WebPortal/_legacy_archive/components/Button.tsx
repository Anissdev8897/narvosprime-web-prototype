import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({ children, onClick, isActive = false, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`
        px-8 py-3 text-lg font-bold uppercase tracking-widest transition-all duration-200 border-2
        ${isActive 
          ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' 
          : 'bg-transparent text-gray-400 border-gray-700 hover:border-white hover:text-white hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]'}
        ${className}
      `}
    >
      {isActive && <span className="mr-2">{'>'}</span>}
      {children}
    </button>
  );
};