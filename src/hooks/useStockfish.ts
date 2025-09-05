// src/hooks/useStockfish.ts
import { useEffect, useRef } from 'react';

export default function useStockfish(onBestMove: (move: string) => void) {
  const engine = useRef<Worker | null>(null);

  useEffect(() => {
    engine.current = new Worker('https://cdn.jsdelivr.net/npm/stockfish/stockfish.js');

    engine.current.onmessage = (event) => {
      const line = event.data;
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const bestMove = parts[1];
        if (bestMove !== '(none)') {
          onBestMove(bestMove);
        }
      }
    };

    return () => {
      engine.current?.terminate();
    };
  }, []);

  const sendPosition = (fen: string) => {
    engine.current?.postMessage(`position fen ${fen}`);
    engine.current?.postMessage('go depth 12'); // Derinlik artırılabilir
  };

  return { sendPosition };
}
