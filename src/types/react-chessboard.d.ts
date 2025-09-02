declare module 'react-chessboard' {
    import * as React from 'react';
  
    export interface ChessboardProps {
      position?: string;
      onPieceDrop?: (from: string, to: string) => boolean | void;
      boardWidth?: number;
    }
  
    export const Chessboard: React.FC<ChessboardProps>;
  }
  