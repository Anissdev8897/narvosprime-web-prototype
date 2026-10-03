
import { useEffect, useRef } from 'react';
import { GlobalSettings } from '../../types';

export const normalizeKey = (key: string): string => {
    if (key === ' ') return ' ';
    if (key.length === 1) return key.toLowerCase();
    const map: Record<string, string> = {
        'Escape': 'escape',
        'Control': 'control',
        'Shift': 'shift',
        'Enter': 'enter',
        'Tab': 'tab',
        'ArrowUp': 'arrowup',
        'ArrowDown': 'arrowdown',
        'ArrowLeft': 'arrowleft',
        'ArrowRight': 'arrowright'
    };
    return map[key] || key.toLowerCase();
};

interface UseGameInputProps {
    settings: GlobalSettings;
    isPaused: boolean;
    showFullSettings: boolean;
    onToggleMap: () => void;
    onToggleMenu: () => void;
    onInteract?: () => void;
}

export const useGameInput = ({
    settings,
    isPaused,
    showFullSettings,
    onToggleMap,
    onToggleMenu,
    onInteract
}: UseGameInputProps) => {
    const keysRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = normalizeKey(event.key);
            keysRef.current.add(key);

            // Menu (Escape)
            if (key === 'escape') {
                onToggleMenu();
                event.preventDefault();
                return;
            }

            // Map Toggle (M)
            if (key === 'm' && !isPaused && !showFullSettings) {
                onToggleMap();
                event.preventDefault();
                return;
            }

            // Interact (E)
            if (key === 'e' && !isPaused && !showFullSettings) {
                if (onInteract) onInteract();
                event.preventDefault();
                return;
            }

            // Shortcuts Sorts (1-9)
            if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(key)) {
                // TODO: Dispatcher l'événement de sélection de sort
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            const key = normalizeKey(event.key);
            keysRef.current.delete(key);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isPaused, showFullSettings]);

    return { keysRef };
};
