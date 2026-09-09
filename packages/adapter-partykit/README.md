# @multiplayer-agent-sdk/adapter-partykit

PartyKit backend adapter (see `/adr/0001-adapter-interface.md` for the interface this implements).

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
