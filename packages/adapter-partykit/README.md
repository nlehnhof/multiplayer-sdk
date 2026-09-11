# @multiplayer-agent-sdk/adapter-partykit

PartyKit backend adapter (see `/adr/0001-adapter-interface.md` for the interface this implements).

## Hibernation

A PartyKit room runs on a hibernating Durable Object: PartyKit can tear down and reconstruct the server instance between any two events, keeping only the open WebSocket connections and `room.storage` alive. This adapter persists your `RoomDefinition`'s state (and the connection-to-player-id mapping) to `room.storage` after every join/leave/action, and restores it in `onStart` — which PartyKit guarantees runs before the first event, including after a wake — so a hibernate/wake cycle (which will happen during any real game with a gap between moves) is invisible to players. See [ADR 0003](../../adr/0003-durable-state-persistence.md) for the full rationale; this was a real, silently-losing-the-whole-game bug before it was fixed, not a hypothetical.

You don't need to do anything to get this — it's automatic for any `RoomDefinition` passed to `createPartyKitServer`.

## Smoke test

The unit tests (`npm test`) mock PartyKit's `Room`/`Connection`/`PartySocket` to verify wiring logic in isolation. The smoke test instead runs a real `partykit dev` server and connects two real WebSocket clients, to verify the adapter against the actual backend end-to-end.

```bash
# terminal 1, from packages/adapter-partykit
npm run build       # from repo root first, so the client can import the built package
npm run smoke:server

# terminal 2, from packages/adapter-partykit
npm run smoke:client
```

Expected output ends with `✅ smoke test passed`. Ctrl+C the server afterward.
