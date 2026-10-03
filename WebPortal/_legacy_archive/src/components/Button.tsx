import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'icon';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyle = "font-bold text-shadow-sm uppercase transition-all duration-100 flex items-center justify-center relative";
  
  const variants = {
    primary: "bg-gradient-to-b from-lime-300 to-lime-500 border-2 border-stone-900 text-stone-900 hover:brightness-110 active:translate-y-0.5 shadow-[0_4px_0_rgb(28,25,23)] rounded-sm px-6 py-3 text-lg",
    secondary: "bg-gradient-to-b from-stone-600 to-stone-800 border-2 border-stone-950 text-white hover:brightness-110 active:translate-y-0.5 shadow-[0_4px_0_rgb(12,10,9)] rounded-sm px-4 py-2 text-sm",
    icon: "bg-stone-800 border border-stone-600 text-white hover:bg-stone-700 p-1 rounded"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {/* Gloss effect */}
      {variant === 'primary' && (
        <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/40 to-transparent pointer-events-none"></div>
      )}
      {children}
    </button>
  );
};