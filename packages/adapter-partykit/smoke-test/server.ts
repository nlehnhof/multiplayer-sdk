import type { RoomDefinition } from '@multiplayer-agent-sdk/core';
import { createPartyKitServer } from '../src/server.js';

interface CounterState {
  count: number;
}

type CounterAction = { type: 'increment' } | { type: 'decrement' };

const definition: RoomDefinition<CounterState, CounterAction> = {
  createState: () => ({ count: 0 }),
  onJoin: (state) => state,
  onLeave: (state) => state,
  onAction: (state, action) => {
    if (action.type === 'increment') return { count: state.count + 1 };
    if (action.type === 'decrement') return { count: state.count - 1 };
    return state;
  },
};

export default createPartyKitServer(definition);
