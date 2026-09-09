# Multiplayer Agent SDK — Build Plan

*Based on: spacex-eval verdict = Pivot, source: "Half Baked" newsletter, Sept 8 2026 ("💡 Multiplayer Games")*

## Idea being built
This is the **pivoted** version, not the original "hosted platform + arcade" pitch. A free, open-source SDK/skill that lets an AI coding agent (Claude Code, Cursor, Windsurf, etc.) bolt real-time multiplayer onto a game a vibe coder just built — wrapping an existing realtime backend instead of owning infrastructure, with no arcade/discovery layer at MVP.

## Who we're selling to / ICP
- **Primary ICP:** solo hobbyist "vibe coders" — non-professional builders using Claude Code/Cursor/Replit/Lovable/Bolt to build small games (2-6 players: card games, party games, trivia, .io-style casual games) for friends or a niche online audience. Technical enough to run a CLI/agent but not to hand-roll WebSocket sync.
- **Secondary ICP:** indie/solo game devs already using JS/TS who want AI-assisted networking code instead of learning Colyseus/Nakama from scratch — slightly more technical, higher willingness to pay.
- **Not the ICP:** studios building competitive/anti-cheat-sensitive multiplayer (latency/security needs exceed what a wrapped commodity backend offers) — don't chase this segment early.

## Where we'd sell it (distribution)
- **Primary channel: agent-native distribution.** Ship as an MCP (Model Context Protocol) server + a Claude Code "Skill"/plugin and a Cursor rule — listed in the official Claude Code plugin directory (github.com/anthropics/claude-plugins-official) and community marketplaces (claudemarketplaces.com, buildwithclaude.com), plus Cursor's Marketplace (cursor.com/marketplace) and cursor.directory.
- **Secondary channel: npm.** A plain `npm install` package works even for agents/tools without a native plugin system (Windsurf, Bolt, v0, Replit) — the SDK has to work standalone, the plugin wrapper is just discovery.
- **Growth channel: the community that seeded this idea.** The newsletter thread (Riley Brown, Alex Finn) is itself a distribution surface — vibe-coding creators on X with large followings who post "build X with AI" tutorials are the exact audience; a demo video is more effective than any paid ad here.

## Platform & stack
- **Format:** npm package + MCP server + thin plugin manifests for Claude Code/Cursor — not a hosted app. Meets builders inside the tool they're already in; zero installation friction beyond `npm install` or "add this MCP server."
- **Stack:** TypeScript SDK; wraps **PartyKit** (now Cloudflare-owned, free tier via Cloudflare account) as the default backend, with an adapter interface so Supabase Realtime or Colyseus Cloud can be swapped in. No owned servers, no database beyond ephemeral room state. Main risk isn't cost (all three backends are cheap/free at hobby scale) — it's API stability if PartyKit's terms shift now that it's inside Cloudflare.

## Market competitors
- **Realtime infra we wrap, not compete with:** PartyKit/Cloudflare (free personal tier, free if self-hosted on your own Cloudflare account), Colyseus Cloud ($15/mo+, unlimited CCU/bandwidth on paid tier, free self-host), Supabase Realtime (bundled into the $25/mo Pro plan), Nakama (Heroic Labs), Photon Engine — all mature, all still require hand-written integration code today.
- **Direct competitive risk:** none of the above currently ship an "agent-native" integration layer designed for LLM coding agents to consume — that's the actual white space. The real competitive threat is one of these incumbents (especially Cloudflare/PartyKit, given the acquisition) shipping their own agent-skill/MCP wrapper, which would be trivial for them and could obsolete this product overnight.
- **Adjacent/aspirational competitor:** the original "Half Baked" idea itself (a hosted platform + arcade) — if someone builds that version and it gets traction, it could absorb this SDK as a feature rather than the SDK absorbing them.

## Budget (solo, bootstrapped)
*Assumes a solo builder, part-time capacity, no outside funding.*

**Cost to MVP:** Worst: $400 / 8 weeks (paid Colyseus Cloud tier for testing + video production for launch demo). Probable: $50 / 3 weeks (free tiers throughout, own time only). Best: $0 / 10 days (entirely on free tiers, no paid tools).

**Monthly recurring at MVP scale:**
- PartyKit/Cloudflare hosting (dev + demo rooms): $0 (free tier)
- npm/GitHub hosting: $0
- Domain + docs site: ~$12/mo
- Optional Colyseus Cloud tier for load-testing: $15/mo

**Monthly recurring at ~500 active integrations:** still roughly $0-30/mo — the backend cost is paid by the *end user's* PartyKit/Colyseus/Supabase account, not by you. This is the core economic advantage of the pivot: you never absorb usage-based infra cost.

## ROI
- **Revenue model:** free/open-source core (drives adoption + credibility), paid tier for a hosted "one-click multiplayer" cloud add-on (managed lobbies, persistent rooms, analytics) at $9-19/mo per project, or a one-time "pro integration pack" ($29) for advanced game types (turn-based state machines, spectator mode).
- **Breakeven:** ~$30/mo probable cost ÷ $15/mo average paid tier ≈ **2 paying customers** covers hosting; real breakeven on time invested needs ~50-100 paying customers at $15/mo (~$750-1,500 MRR) to be worth continued part-time effort.
- **Payback timeframe:** Worst: 12+ months (open-source gets used but nobody upgrades to paid). Probable: 4-6 months (assumes ~5% of free users convert once a paid tier ships, driven by one viral creator demo). Best: 6-8 weeks (a single well-placed Riley Brown/Alex Finn-style post drives a spike of installs).
- **Why:** the free core has near-zero carrying cost because it never touches paid infra itself, so unlike the original platform idea this can sit at zero revenue indefinitely without bleeding cash — the downside is capped, but so is the upside unless a paid layer gets built and marketed deliberately.

## AI builds vs. you build
**AI can build:** the TypeScript SDK and adapter interfaces for each backend; the MCP server and Claude Code/Cursor plugin manifests; example game integrations (tic-tac-toe, card game, trivia) as reference implementations; docs site and README; the CI/test suite.

**You have to do yourself:** get listed in the official Claude Code plugin directory (a real PR/review process with Anthropic's repo maintainers) and Cursor's Marketplace (their submission process); reach out to Riley Brown/Alex Finn or similar creators for a demo/shoutout — that's a relationship, not code; decide and test real pricing with actual users rather than guessing; if usage grows, negotiate any rate-limit exceptions directly with PartyKit/Cloudflare or Colyseus support.

## Rollout
1. **Prove the hard part** — one working end-to-end demo: an agent (Claude Code) adds multiplayer to an existing local-state game using only the skill's docs, no hand-holding.
2. **Ship the free core** — publish npm package + MCP server + 3 reference game integrations; submit to Claude Code and Cursor marketplaces.
3. **Get one visible use case** — get a vibe-coding creator to build and post a multiplayer game using it; this is the validation that agent-integration actually works for a stranger, not just you.
4. **Layer in the paid tier** — only after organic installs show real repeat usage, build the hosted "one-click" add-on and test pricing.

## This week
- [ ] Build the tic-tac-toe reference integration end-to-end against PartyKit's free tier to prove the sync pattern works
- [ ] Draft the MCP server skeleton and confirm it loads correctly in Claude Code and Cursor
- [ ] Read Anthropic's `claude-plugins-official` contribution guidelines to know what a submission requires before you're ready to submit
- [ ] Record a 60-90 second demo video of an agent adding multiplayer to a game live
- [ ] Reply to or reference the original Riley Brown/Alex Finn thread with the working demo to test whether that audience bites
