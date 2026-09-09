import type { PlayerInfo, RoomDefinition } from '@multiplayer-agent-sdk/core';

export type Suit = 'S' | 'H' | 'D' | 'C';

/** rank: 2-14, where 11=J, 12=Q, 13=K, 14=A. */
export interface Card {
  rank: number;
  suit: Suit;
}

export interface WarState {
  hands: Record<string, Card[]>;
  table: Record<string, Card>;
  roundWinner: string | null;
  wins: Record<string, number>;
  status: 'waiting' | 'playing' | 'finished';
  overallWinner: string | null;
  /**
   * Increments once per resolved round (win or tie). Exists so a client can
   * tell "a round just resolved" apart from "the other player's single flip
   * landed on the table" — both are broadcast as sync messages, and without
   * a monotonic marker a client waiting on "the next sync" can catch the
   * wrong one. See examples/card-game/play.mjs.
   */
  roundsResolved: number;
}

export type WarAction = { type: 'flip' };

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle. Not cryptographically secure — fine for a casual card game. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * A deliberately simplified 2-player "War": no war-chain-on-tie mechanic
 * (a tied flip just discards both cards) because the v1 adapter interface
 * broadcasts one shared TState to every client with no per-player private
 * view — see adr/0001-adapter-interface.md, "Non-goals (MVP)". Both
 * players' full hands are visible to both players in this reference.
 */
export const roomDefinition: RoomDefinition<WarState, WarAction> = {
  options: { maxPlayers: 2 },

  createState(): WarState {
    return {
      hands: {},
      table: {},
      roundWinner: null,
      wins: {},
      status: 'waiting',
      overallWinner: null,
      roundsResolved: 0,
    };
  },

  onJoin(state: WarState, player: PlayerInfo): WarState {
    const hands: Record<string, Card[]> = { ...state.hands, [player.id]: [] };
    const wins: Record<string, number> = { ...state.wins, [player.id]: 0 };

    const playerIds = Object.keys(hands);
    let status = state.status;

    if (playerIds.length === 2) {
      const deck = shuffle(createDeck());
      const [idA, idB] = playerIds;
      hands[idA] = deck.slice(0, 26);
      hands[idB] = deck.slice(26);
      status = 'playing';
    }

    return { ...state, hands, wins, status };
  },

  onLeave(state: WarState, player: PlayerInfo): WarState {
    if (state.status !== 'playing') return state;

    const remainingIds = Object.keys(state.hands).filter((id) => id !== player.id);
    const overallWinner = remainingIds.length === 1 ? remainingIds[0] : null;

    return { ...state, status: 'finished', overallWinner };
  },

  onAction(state: WarState, action: WarAction, player: PlayerInfo): WarState {
    if (action.type !== 'flip') return state;

    if (state.status !== 'playing') {
      throw new Error('Round is not active');
    }
    if (state.table[player.id]) {
      throw new Error('You already flipped this round');
    }
    const hand = state.hands[player.id];
    if (!hand || hand.length === 0) {
      throw new Error('No cards left to flip');
    }

    const flippedCard = hand[0]!;
    const hands: Record<string, Card[]> = { ...state.hands, [player.id]: hand.slice(1) };
    const table: Record<string, Card> = { ...state.table, [player.id]: flippedCard };

    const playerIds = Object.keys(hands);
    if (Object.keys(table).length < playerIds.length) {
      // Waiting on the other player to flip.
      return { ...state, hands, table };
    }

    // Both players have flipped: resolve the round.
    const [idA, idB] = playerIds;
    const cardA = table[idA]!;
    const cardB = table[idB]!;
    const wins = { ...state.wins };
    let roundWinner: string | null;

    if (cardA.rank > cardB.rank) {
      roundWinner = idA;
      hands[idA] = [...hands[idA]!, cardA, cardB];
      wins[idA] = (wins[idA] ?? 0) + 1;
    } else if (cardB.rank > cardA.rank) {
      roundWinner = idB;
      hands[idB] = [...hands[idB]!, cardB, cardA];
      wins[idB] = (wins[idB] ?? 0) + 1;
    } else {
      // Tie: both cards are discarded (documented simplification, no war-chain).
      roundWinner = null;
    }

    let status: WarState['status'] = 'playing';
    let overallWinner: string | null = null;
    const aEmpty = hands[idA]!.length === 0;
    const bEmpty = hands[idB]!.length === 0;

    if (aEmpty || bEmpty) {
      status = 'finished';
      overallWinner = aEmpty && bEmpty ? null : aEmpty ? idB : idA;
    }

    return {
      ...state,
      hands,
      table: {},
      roundWinner,
      wins,
      status,
      overallWinner,
      roundsResolved: state.roundsResolved + 1,
    };
  },
};
