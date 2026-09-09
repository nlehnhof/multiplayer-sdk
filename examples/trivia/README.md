# trivia-example

A multi-round trivia game built on `@multiplayer-agent-sdk/core` and the PartyKit adapter
(`@multiplayer-agent-sdk/adapter-partykit`). It demonstrates a `RoomDefinition` with:

- Multiple sequential rounds (`questionIndex` walking through a fixed question bank).
- A phase state machine (`answering` -> `reveal` -> `answering` ... -> `finished`).
- Server-authoritative scoring: points are only awarded once every current player has
  submitted an answer for the round, and only the reducer (`onAction`) ever mutates scores.
- Players joining mid-game (a late joiner is added to `players`/`scores` immediately but
  simply missed any earlier rounds' points).

See `src/questions.ts` for the question bank and `src/room.ts` for the `RoomDefinition`
(state shape, `onJoin`/`onLeave`/`onAction`).

## Known limitation: answers are visible before reveal

The v1 adapter interface (`adr/0001-adapter-interface.md`) broadcasts one identical
`TState` object to every connected client — there is no per-player private view (see
that ADR's ["Non-goals (MVP)"](../../adr/0001-adapter-interface.md#non-goals-mvp)
section). That means a submitted answer is technically present in `state.answers` as
soon as any client submits it, not just once `phase` flips to `'reveal'`. A well-behaved
UI for this game should simply not render other players' entries in `answers` until
`phase === 'reveal'` — but a modified/malicious client could inspect the raw state and
see answers early. This is a known MVP limitation of the adapter interface, not something
this example works around.

## Running the tests

```bash
npm install        # from the repo root, once
cd examples/trivia
npx vitest run      # unit tests against RoomEngine (packages/core)
npx tsc --noEmit    # typecheck
```

## Running the smoke test (real PartyKit server, real WebSocket clients)

The smoke test spins up a real `partykit dev` server and drives it with two real
`connectPartyKitClient` connections that play through all 5 questions, always answering
correctly, and assert both players end with a perfect score and `phase: 'finished'`.

```bash
# from examples/trivia
npm run build         # compiles src/questions.ts to dist/ so play.mjs (plain Node/ESM)
                       # can import the same question bank the room definition uses

# terminal 1
npm run smoke:server  # partykit dev party/server.ts --port 2002

# terminal 2
npm run smoke:play    # node play.mjs
```

Expected output ends with `✅ trivia play-through passed: both players scored perfectly
and reached "finished".` Ctrl+C the server afterward.
