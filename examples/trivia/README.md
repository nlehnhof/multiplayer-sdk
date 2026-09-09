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

## Answers are private until reveal

`RoomDefinition.toClientView` (see `src/room.ts`) gives each client a `TriviaView`, not
the raw `TriviaState`: `answeredPlayerIds` publicly shows *who* has answered the current
question (so a UI can say "waiting on 2 more players"), but `answers` only contains your
own submission while `phase === 'answering'` — everyone else's choice is withheld until
the round moves to `'reveal'`, at which point `answers` contains everyone's. `scores` and
`players` are always public. See
[`adr/0002-per-player-views.md`](../../adr/0002-per-player-views.md), which this example
was one of two motivating cases for (alongside `examples/card-game`'s hidden hands).

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
