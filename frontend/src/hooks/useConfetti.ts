import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  const fireConfetti = useCallback((variant: 'success' | 'integrity' | 'export' = 'success') => {
    const configs: Record<string, confetti.Options> = {
      success: {
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#16a34a', '#4ade80', '#86efac'],
        ticks: 120,
      },
      integrity: {
        particleCount: 60,
        spread: 50,
        origin: { y: 0.5 },
        colors: ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa'],
        ticks: 100,
      },
      export: {
        particleCount: 100,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#6366f1', '#22c55e'],
        ticks: 150,
        gravity: 0.8,
      },
    };
    confetti(configs[variant]);
  }, []);

  return { fireConfetti };
}
