import type { RoomDefinition } from '@multiplayer-agent-sdk/core';

export type Cell = 'X' | 'O' | null;
export type Symbol = 'X' | 'O';

export interface TicTacToeState {
  /** 9 cells, index 0-8, row-major (0-2 top row, 3-5 middle, 6-8 bottom). */
  board: Cell[];
  /** Whose symbol may move next. */
  turn: Symbol;
  /** Player id -> assigned symbol. First joiner gets 'X', second gets 'O'. */
  symbols: Record<string, Symbol>;
  status: 'playing' | 'won' | 'draw';
  /** Player id of the winner, set when status is 'won'. */
  winner: string | null;
}

export type TicTacToeAction = { type: 'mark'; cell: number };

const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function findWinningSymbol(board: Cell[]): Symbol | null {
  for (const [a, b, c] of WIN_LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return mark;
    }
  }
  return null;
}

function otherPlayerId(state: TicTacToeState, leavingPlayerId: string): string | null {
  const other = Object.keys(state.symbols).find((id) => id !== leavingPlayerId);
  return other ?? null;
}

/**
 * Reference RoomDefinition for a 2-player tic-tac-toe game. No hidden
 * information here (unlike a card game) — the full board is always visible
 * to both players, so this example is mainly about turn order + win
 * detection rather than per-player state filtering.
 */
export const ticTacToeRoom: RoomDefinition<TicTacToeState, TicTacToeAction> = {
  options: { maxPlayers: 2 },

  createState: () => ({
    board: Array<Cell>(9).fill(null),
    turn: 'X',
    symbols: {},
    status: 'playing',
    winner: null,
  }),

  onJoin: (state, player) => {
    const assignedCount = Object.keys(state.symbols).length;
    const symbol: Symbol = assignedCount === 0 ? 'X' : 'O';
    return {
      ...state,
      symbols: { ...state.symbols, [player.id]: symbol },
    };
  },

  onLeave: (state, player) => {
    if (state.status !== 'playing') return state;
    const winner = otherPlayerId(state, player.id);
    return {
      ...state,
      status: 'won',
      winner,
    };
  },

  onAction: (state, action, player) => {
    if (state.status !== 'playing') {
      throw new Error('Game is already over');
    }

    const symbol = state.symbols[player.id];
    if (!symbol) {
      throw new Error(`Player ${player.id} has no assigned symbol`);
    }
    if (symbol !== state.turn) {
      throw new Error(`It is not ${player.id}'s turn`);
    }

    const { cell } = action;
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
      throw new Error(`Invalid cell: ${cell}`);
    }
    if (state.board[cell] !== null) {
      throw new Error(`Cell ${cell} is already occupied`);
    }

    const board = [...state.board];
    board[cell] = symbol;

    const winningSymbol = findWinningSymbol(board);
    if (winningSymbol) {
      return {
        ...state,
        board,
        status: 'won',
        winner: player.id,
      };
    }

    if (board.every((mark) => mark !== null)) {
      return {
        ...state,
        board,
        status: 'draw',
      };
    }

    return {
      ...state,
      board,
      turn: symbol === 'X' ? 'O' : 'X',
    };
  },
};
