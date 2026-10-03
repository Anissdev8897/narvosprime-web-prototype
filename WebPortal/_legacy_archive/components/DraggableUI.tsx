import React, { useState, useRef, useEffect } from 'react';

interface DraggableUIProps {
  children: React.ReactNode;
  position: { x: number; y: number };
  onPositionChange: (x: number, y: number) => void;
  enabled?: boolean;
  className?: string;
  defaultPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const DraggableUI: React.FC<DraggableUIProps> = ({
  children,
  position,
  onPositionChange,
  enabled = false,
  className = '',
  defaultPosition = 'top-left'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enabled) return;
    if (e.button !== 0) return; // Seulement clic gauche
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    if (!isDragging || !enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Limiter aux bords de l'écran
      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 0);
      
      onPositionChange(
        Math.max(0, Math.min(maxX, newX)),
        Math.max(0, Math.min(maxY, newY))
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, enabled, onPositionChange]);

  // Calculer la position par défaut si position est à 0,0
  const getDefaultStyle = (): React.CSSProperties => {
    if (position.x !== 0 || position.y !== 0) {
      return {
        left: `${position.x}px`,
        top: `${position.y}px`
      };
    }

    // Position par défaut selon defaultPosition
    switch (defaultPosition) {
      case 'top-right':
        return { right: '32px', top: '32px' };
      case 'bottom-left':
        return { left: '32px', bottom: '32px' };
      case 'bottom-right':
        return { right: '32px', bottom: '32px' };
      case 'top-left':
      default:
        return { left: '32px', top: '32px' };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`absolute ${enabled ? 'cursor-move' : ''} ${className}`}
      style={getDefaultStyle()}
      onMouseDown={handleMouseDown}
    >
      {enabled && (
        <div className="absolute -top-6 left-0 text-[10px] text-yellow-400 font-mono bg-black/50 px-2 py-1 rounded border border-yellow-500/50">
          [DRAG MODE] Press TAB to exit
        </div>
      )}
      {children}
    </div>
  );
};

