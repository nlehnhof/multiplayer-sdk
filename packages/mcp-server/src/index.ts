#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Status of a backend adapter package. "available" means the package is
 * published and implements `MultiplayerAdapter` today; "planned" means it's
 * named in the target repo structure (see CLAUDE.md) but not built yet.
 */
export interface AdapterInfo {
  name: string;
  package: string;
  status: 'available' | 'planned';
}

/**
 * Backing data for the `list_adapters` tool. Kept as a plain, exported
 * function (rather than inlined in the tool registration) so it's
 * unit-testable without spinning up an MCP client/transport.
 */
export function listAdapters(): AdapterInfo[] {
  return [
    {
      name: 'partykit',
      package: '@multiplayer-agent-sdk/adapter-partykit',
      status: 'available',
    },
    {
      name: 'colyseus',
      package: '@multiplayer-agent-sdk/adapter-colyseus',
      status: 'planned',
    },
    {
      name: 'supabase',
      package: '@multiplayer-agent-sdk/adapter-supabase',
      status: 'planned',
    },
  ];
}

/**
 * Backing data for the `get_room_definition_guide` tool. Returns markdown
 * documenting the frozen `RoomDefinition`/`PlayerInfo`/`RoomOptions` contract
 * (see adr/0001-adapter-interface.md, adr/0002-per-player-views.md, and
 * packages/core/src/types.ts — copied verbatim below, not paraphrased) plus
 * a minimal worked example, so a coding agent can write a `RoomDefinition`
 * without guessing the shape. Keep this in sync whenever the core types or
 * an ADR changes the contract — this tool exists specifically so an agent
 * never has to guess, so a stale guide defeats its purpose.
 */
export function getRoomDefinitionGuide(): string {
  return `# RoomDefinition guide

The Multiplayer Agent SDK is built around a server-authoritative
action/reducer model. A game author (or an agent) writes exactly one
\`RoomDefinition\` per game — backend-agnostic, never importing an adapter —
and a \`MultiplayerAdapter\` (e.g. PartyKit) turns it into a deployable
server and a client connection API.

## Core types (\`@multiplayer-agent-sdk/core\`)

\`\`\`typescript
export interface PlayerInfo<TMeta = unknown> {
  id: string;
  meta?: TMeta;
  connectedAt: number;
}

export interface RoomOptions {
  /** Reject joins once this many players are present. */
  maxPlayers?: number;
  /** Adapters may tear the room down after this much inactivity. */
  idleTimeoutMs?: number;
}

/**
 * Backend-agnostic game logic. Written once per game; never imports an adapter.
 * All hooks are pure: given state + input, return the next state (throw to reject).
 */
export interface RoomDefinition<TState, TAction, TMeta = unknown, TView = TState> {
  createState(): TState;
  onJoin(state: TState, player: PlayerInfo<TMeta>): TState;
  onLeave(state: TState, player: PlayerInfo<TMeta>): TState;
  onAction(state: TState, action: TAction, player: PlayerInfo<TMeta>): TState;
  options?: RoomOptions;
  /**
   * Optional per-player projection of the authoritative state, computed
   * fresh every time state is broadcast. Omit it for a fully-public game —
   * the adapter then sends the raw TState to everyone. Required for any
   * game with hidden information (a card game's opponent hands, a trivia
   * game's not-yet-revealed answers) — without it, every connected client
   * sees the exact same state, including things other players shouldn't.
   */
  toClientView?(state: TState, viewerId: string): TView;
}
\`\`\`

\`TState\` and \`TAction\` **must be JSON-serializable** — no functions, class
instances, \`Map\`/\`Set\`. This is required for every backend adapter,
including the (post-MVP) Supabase adapter.

## Hiding information per player

By default every client gets the identical state — fine for a fully-public
game (tic-tac-toe), wrong for almost anything else. Add \`toClientView\` to
redact per viewer:

\`\`\`typescript
// A card game: show your own hand, only a count for everyone else's.
toClientView: (state, viewerId) => ({
  myHand: state.hands[viewerId],
  handCounts: Object.fromEntries(
    Object.entries(state.hands).map(([id, hand]) => [id, hand.length])
  ),
}),
\`\`\`

\`\`\`typescript
// A trivia game: hide answer values until everyone's answered, but let
// everyone see WHO has answered (for a "waiting on 2 more" UI).
toClientView: (state, viewerId) => ({
  answeredPlayerIds: Object.keys(state.answers),
  answers: state.phase === 'answering'
    ? { [viewerId]: state.answers[viewerId] }
    : state.answers,
}),
\`\`\`

## Minimal example: a counter room

\`\`\`typescript
import type { PlayerInfo, RoomDefinition } from '@multiplayer-agent-sdk/core';

interface CounterState {
  count: number;
  players: string[];
}

type CounterAction = { type: 'increment' } | { type: 'decrement' };

export function counterDefinition(): RoomDefinition<CounterState, CounterAction> {
  return {
    options: { maxPlayers: 4 },
    createState: () => ({ count: 0, players: [] }),
    onJoin: (state, player: PlayerInfo) => ({
      ...state,
      players: [...state.players, player.id],
    }),
    onLeave: (state, player: PlayerInfo) => ({
      ...state,
      players: state.players.filter((id) => id !== player.id),
    }),
    onAction: (state, action) => {
      if (action.type === 'increment') return { ...state, count: state.count + 1 };
      if (action.type === 'decrement') return { ...state, count: state.count - 1 };
      return state;
    },
  };
}
\`\`\`

## Wiring it up

For the PartyKit backend (the only available adapter at MVP), pass your
\`RoomDefinition\` to \`createPartyKitServer\` from
\`@multiplayer-agent-sdk/adapter-partykit\` to get a deployable PartyKit
\`Party.Server\` class, and connect to it from the client with
\`connectPartyKitClient\` from the same package — see that package's README
for the exact call shape.
`;
}

const server = new McpServer({
  name: 'multiplayer-agent-sdk-mcp',
  version: '0.1.0',
});

server.registerTool(
  'list_adapters',
  {
    title: 'List backend adapters',
    description:
      'List the Multiplayer Agent SDK backend adapters and whether each is available now or planned post-MVP.',
  },
  () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listAdapters(), null, 2),
      },
    ],
  })
);

server.registerTool(
  'get_room_definition_guide',
  {
    title: 'Get RoomDefinition guide',
    description:
      "Get the authoritative RoomDefinition/PlayerInfo/RoomOptions contract and a minimal worked example, so an agent can write a game's RoomDefinition without guessing the SDK's API.",
  },
  () => ({
    content: [
      {
        type: 'text',
        text: getRoomDefinitionGuide(),
      },
    ],
  })
);

/**
 * Only connect the stdio transport when this module is run directly
 * (`node dist/index.js`), not when it's imported (e.g. by tests).
 */
function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (isMain()) {
  main().catch((err) => {
    console.error('multiplayer-agent-sdk-mcp failed to start:', err);
    process.exit(1);
  });
}
