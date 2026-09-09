# Multiplayer Agent SDK

Add real-time multiplayer to a game your AI coding agent already built, without hand-rolling WebSocket sync or standing up your own server.

Write one backend-agnostic `RoomDefinition` — your game's rules, as plain functions — and run it on [PartyKit](https://www.partykit.io/) (the default, free-tier backend) via a thin adapter. Built to be used *by* an AI coding agent (Claude Code, Cursor, or anything with an MCP client), for the "vibe coder" building a small 2-6 player card game, trivia night, or party game for friends.

```bash
npm install @multiplayer-agent-sdk/core @multiplayer-agent-sdk/adapter-partykit
```

```ts
// room.ts — your game's rules, no networking code
import type { RoomDefinition } from '@multiplayer-agent-sdk/core';

interface CounterState { count: number }
type CounterAction = { type: 'increment' } | { type: 'decrement' };

export const counterRoom: RoomDefinition<CounterState, CounterAction> = {
  createState: () => ({ count: 0 }),
  onJoin: (state) => state,
  onLeave: (state) => state,
  onAction: (state, action) =>
    action.type === 'increment' ? { count: state.count + 1 } : { count: state.count - 1 },
};
```

```ts
// party/server.ts — deployed to PartyKit
import { createPartyKitServer } from '@multiplayer-agent-sdk/adapter-partykit';
import { counterRoom } from '../room.js';

export default createPartyKitServer(counterRoom);
```

```ts
// your game's client
import { connectPartyKitClient } from '@multiplayer-agent-sdk/adapter-partykit';

const room = connectPartyKitClient({ host: '127.0.0.1:1999', roomId: 'my-room', player: { id: 'p1' } });
room.onStateChange((state) => render(state));
room.send({ type: 'increment' });
```

Hidden information (a card game's opponent hands, a trivia game's unrevealed answers) is one function away — see [Per-player views](#per-player-views) below.

## Packages

| Package | What it is |
|---|---|
| [`@multiplayer-agent-sdk/core`](packages/core) | Backend-agnostic types (`RoomDefinition`, `MultiplayerAdapter`) and the `RoomEngine` player-bookkeeping helper. |
| [`@multiplayer-agent-sdk/adapter-partykit`](packages/adapter-partykit) | The default backend adapter, wrapping [PartyKit](https://www.partykit.io/). |
| [`@multiplayer-agent-sdk/mcp-server`](packages/mcp-server) | An MCP server that hands a coding agent grounded, accurate SDK guidance instead of it guessing the API. |
| [`plugin-claude-code`](packages/plugin-claude-code) | Claude Code plugin/skill manifest for this SDK. |
| [`plugin-cursor`](packages/plugin-cursor) | Cursor rule for this SDK. |

Colyseus and Supabase Realtime adapters are planned (the interface is designed for them — see the ADRs below) but not built yet.

## Reference games

Three complete, tested examples in [`examples/`](examples), each with unit tests and a live smoke test against a real `partykit dev` server:

- [`tic-tac-toe`](examples/tic-tac-toe) — the simplest case: fully public state, turn order, win detection.
- [`card-game`](examples/card-game) — a 2-player War variant demonstrating hidden hands (per-player views).
- [`trivia`](examples/trivia) — multi-round scoring with information revealed in phases (answers hidden until everyone's answered).

## Per-player views

By default every client sees the same state. Add `toClientView(state, viewerId)` to your `RoomDefinition` to give each player a different projection — hide an opponent's cards, reveal answers only after everyone's answered, and so on. See [`examples/card-game/src/room.ts`](examples/card-game/src/room.ts) and [`examples/trivia/src/room.ts`](examples/trivia/src/room.ts) for two worked patterns.

## Architecture

The adapter interface and its design decisions are recorded as ADRs:
- [ADR 0001 — Backend Adapter Interface](adr/0001-adapter-interface.md)
- [ADR 0002 — Per-Player State Views](adr/0002-per-player-views.md)

[`CLAUDE.md`](CLAUDE.md) is the working contract for this repo (scope, conventions, build order) if you're picking up development here.

## Status

MVP: core SDK, PartyKit adapter, MCP server, both plugin manifests, and all three reference games are built, tested, and reviewed. Not yet published to npm or submitted to the Claude Code / Cursor marketplaces — see [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md).

## License

MIT — see [LICENSE](LICENSE).
