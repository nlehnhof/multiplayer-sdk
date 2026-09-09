import type { RoomDefinition } from '@multiplayer-agent-sdk/core';
import { questions } from './questions.js';

export interface TriviaState {
  questionIndex: number;
  phase: 'answering' | 'reveal' | 'finished';
  /** playerId -> choiceIndex submitted for the current question. */
  answers: Record<string, number>;
  /** playerId -> total correct answers so far. */
  scores: Record<string, number>;
  players: string[];
}

export type TriviaAction = { type: 'answer'; choiceIndex: number } | { type: 'next' };

/**
 * What a client actually receives (ADR 0002): whether the *other* players
 * have answered is public (builds suspense — "waiting on 2 more players"),
 * but what they answered is private until `phase` leaves 'answering'. Your
 * own answer is always visible to you.
 */
export interface TriviaView {
  questionIndex: number;
  phase: TriviaState['phase'];
  /** Player ids who have submitted an answer to the current question. */
  answeredPlayerIds: string[];
  /** Choice values — only for the viewer's own id while phase is 'answering'; everyone's once revealed. */
  answers: Record<string, number>;
  scores: Record<string, number>;
  players: string[];
}

/**
 * Multi-round trivia game. Server-authoritative: the reducer is the only
 * place scores change. See `toClientView` below for what's public vs.
 * private, and adr/0002-per-player-views.md.
 */
export const roomDefinition: RoomDefinition<TriviaState, TriviaAction, unknown, TriviaView> = {
  createState: () => ({
    questionIndex: 0,
    phase: 'answering',
    answers: {},
    scores: {},
    players: [],
  }),

  onJoin: (state, player) => {
    const players = state.players.includes(player.id)
      ? state.players
      : [...state.players, player.id];
    const scores =
      player.id in state.scores ? state.scores : { ...state.scores, [player.id]: 0 };
    return { ...state, players, scores };
  },

  onLeave: (state, player) => ({
    ...state,
    players: state.players.filter((id) => id !== player.id),
  }),

  onAction: (state, action, player) => {
    if (action.type === 'answer') {
      if (state.phase !== 'answering') {
        throw new Error('Cannot submit an answer outside the answering phase');
      }
      if (player.id in state.answers) {
        throw new Error('Player has already answered this question');
      }

      const answers = { ...state.answers, [player.id]: action.choiceIndex };
      const everyoneAnswered = state.players.every((id) => id in answers);
      if (!everyoneAnswered) {
        return { ...state, answers };
      }

      const correctIndex = questions[state.questionIndex].correctIndex;
      const scores = { ...state.scores };
      for (const id of state.players) {
        if (answers[id] === correctIndex) {
          scores[id] = (scores[id] ?? 0) + 1;
        }
      }
      return { ...state, answers, scores, phase: 'reveal' };
    }

    // action.type === 'next'
    if (state.phase !== 'reveal') {
      throw new Error('Cannot advance to the next question outside the reveal phase');
    }
    const nextIndex = state.questionIndex + 1;
    if (nextIndex < questions.length) {
      return { ...state, questionIndex: nextIndex, answers: {}, phase: 'answering' };
    }
    return { ...state, phase: 'finished' };
  },

  toClientView(state: TriviaState, viewerId: string): TriviaView {
    const revealed = state.phase !== 'answering';
    const answers: Record<string, number> = {};
    for (const [id, choice] of Object.entries(state.answers)) {
      if (revealed || id === viewerId) answers[id] = choice;
    }
    return {
      questionIndex: state.questionIndex,
      phase: state.phase,
      answeredPlayerIds: Object.keys(state.answers),
      answers,
      scores: state.scores,
      players: state.players,
    };
  },
};
