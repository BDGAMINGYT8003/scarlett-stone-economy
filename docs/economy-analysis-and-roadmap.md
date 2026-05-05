# Economy Bot Codebase Analysis and Competitive Roadmap

_Date reviewed: 2026-05-05_

## Review scope and methodology

- Reviewed every tracked source/configuration path under `src/`, plus the archived reference bot under `archived_dank_memer/`, package metadata, and the existing level-system blueprint.
- Used static command/import inventory, targeted line-by-line reads of command handlers, state mutation utilities, collectors, parsers, cooldown logic, and JSON economy configuration.
- Ran syntax and whitespace checks after adding this document; no runtime behavior was changed by this analysis.
- Researched current public feature positioning for Dank Memer and comparable Discord economy bots on 2026-05-05.

## Codebase map

| Area | Key files | Current responsibility |
| --- | --- | --- |
| Boot and Discord plumbing | `src/index.js`, `src/handlers/commandHandler.js`, `src/handlers/eventHandler.js`, `src/events/interactionCreate.js`, `src/events/ready.js` | Loads environment variables, creates the Discord client, registers command/event modules, dispatches slash commands, button interactions, and modal submissions. |
| Persistence and mutations | `src/utils/db.js` | Creates/migrates SQLite tables for users, inventory, titles, achievements, jobs, command usage, currency logs, and friendships; exposes wallet, bank, premium, god-mode, inventory, stat, XP, and log helpers. |
| Economy input/time helpers | `src/utils/numberParser.js`, `src/utils/timeParser.js` | Normalizes user-entered amounts and admin-entered durations. Recent hardening rejects malformed partial numbers/durations and clamps safe integers. |
| Cooldowns and locks | `src/utils/cooldownManager.js`, `src/utils/lockManager.js` | Implements scheduled reward cooldowns, short duration cooldowns, and per-user temporary interaction locks. |
| Progression and rewards | `src/utils/levelManager.js`, `src/utils/badgeManager.js`, `src/utils/achievementManager.js`, `src/config/levels.json`, `src/config/badges.json`, `src/config/achievements.json` | Grants XP, level rewards, badges, achievements, progress displays, and unlock state. |
| Income commands | `src/commands/Income/*.js` | Implements beg, search, crime, postmemes, work, trivia, fish, hunt, dig, and adventure income loops. |
| Banking and transfers | `src/commands/Banking/*.js`, `src/commands/Economy/friends.js` | Shows wallet/bank, deposits/withdraws, and friend-only coin/item sharing with confirmation flows. |
| Games | `src/commands/Economy/slots.js`, `src/commands/Economy/snakeeyes.js`, `src/commands/Rewards/highlow.js` | Implements gambling/minigame outcomes, payouts, stats, XP, badges, and replay interactions. |
| Inventory and item UX | `src/commands/Economy/inventory.js`, `src/commands/Economy/item.js`, `src/commands/Economy/use.js`, `src/config/items.json` | Displays item ownership/details and handles item usage effects such as bank notes, title unlocks, boosts, and mystery boxes. |
| Utility/profile UX | `src/commands/Utility/*.js`, `src/utils/progressBar.js`, `src/utils/multiplier.js` | Provides help, profile, compare, premium, title, and multiplier displays. |
| Archived reference implementation | `archived_dank_memer/**` | Older prefix-command economy/moderation/fun bot implementation used as a feature reference, not loaded by the current app. |

## Current product strengths

- The bot already has a recognizable Dank-Memer-style loop: wallet/bank, income commands, gambling, item inventory, daily/weekly/monthly rewards, jobs, achievements, badges, titles, multipliers, friends, and progression.
- SQLite schema creation is centralized and command code generally calls helper mutations instead of writing SQL directly.
- The recent parser/state hardening reduced high-impact corruption risks from malformed amounts, stale share confirmations, stale balance modals, and tampered repeat-bet custom IDs.
- The config-driven files make additional items, jobs, rewards, locations, and loot tables easier to tune without changing command logic.

## Recurring issue patterns and risks found

### High priority reliability and economy-integrity risks

1. **Multi-step money/item mutations are not wrapped in explicit SQLite transactions.**
   - Examples include deposit/withdraw, casino bet deduction plus payout/stat logging, friend sharing, and adventure ticket consumption plus reward grants.
   - `better-sqlite3` is synchronous, which helps within one process, but transactions would still protect against partial updates if an exception occurs after the first mutation and before the final mutation/log.
   - Recommendation: add small transaction helpers in `db.js` for transfer, wager settlement, item share, and adventure completion.

2. **Short cooldowns and interaction locks are in-memory only.**
   - Restarting the process clears duration cooldowns and active locks, so users can bypass grind cooldowns after a deploy/crash.
   - Recommendation: persist duration cooldown expiry timestamps in SQLite for economy commands where abuse matters, while keeping the in-memory map as a fast cache.

3. **Scheduled reward reset math uses a fixed UTC-5 offset while comments say Eastern time.**
   - During daylight-saving months, US Eastern is UTC-4; the fixed offset can make daily/weekly/monthly reset UX drift by one hour.
   - Recommendation: use `Intl.DateTimeFormat` with `America/New_York`, store reset instants in UTC, or define the product as fixed UTC explicitly.

4. **Trivia fetching starts network work at import time and leaves a background interval running.**
   - This caused module-load smoke checks to hang until manually terminated and can create noisy failures in offline test environments.
   - Recommendation: lazily start trivia fetching from bot startup or command execution, expose a `stop()` for tests, and make the cache fetch interval configurable.

5. **Database path is process-relative (`economy.db`).**
   - Running commands from a different working directory can create/read a different database.
   - Recommendation: resolve the database path from an environment variable or from the repository/runtime root.

### Medium priority maintainability risks

1. **No automated test suite exists.**
   - `npm test` is currently a placeholder failure, so parser, cooldown, transaction, and command helper regressions are easy to miss.
   - Recommendation: introduce a minimal Node test runner suite for pure utilities first, then mock Discord interactions for command-level checks.

2. **Collectors are implemented independently in many commands.**
   - Pagination/access checks/buttons repeat across help, title, profile, rewards, inventory, games, friends, and adventure.
   - Recommendation: add shared component helper utilities for owner-only collectors, pagination rows, disabled-on-timeout behavior, and modal scoping.

3. **Feature config validation is missing.**
   - JSON config drives most economy balance, but missing item IDs, malformed chance tables, negative values, or duplicate IDs are not checked in CI.
   - Recommendation: add a startup/config test that validates unique IDs, positive costs/rewards, referenced item IDs, and chance totals.

4. **Global/user economy boundaries are not explicit.**
   - The current schema keys most money and inventory by Discord user ID only, making the economy effectively global across all servers.
   - Recommendation: decide whether this bot should be global like Dank Memer or customizable per guild like UnbelievaBoat/Tatsu, then encode that decision in schema and UX.

5. **Admin-only commands have hardcoded owner bypasses.**
   - Hardcoded IDs are hard to audit and rotate.
   - Recommendation: move owner/developer IDs to environment/config and add a small `isBotOwner()` helper.

## Competitive research snapshot

| Bot/source | Relevant observed features | Implication for this project |
| --- | --- | --- |
| Dank Memer public listing on Top.gg | Positions itself as a global currency game with catching creatures, item collecting, robbing, pets, gambling, marketplace, many unique items/skins, detailed fishing with tools, bait, NPCs, locations, idle fishing, skills, collection book, and leaderboards. Source: <https://top.gg/bot/memes> | The current bot has the foundation but lacks deeper long-term systems: marketplace, pets, collection books, skill trees, richer fishing, and global leaderboards. |
| Dank Memer pet tutorial | Pets can be bought or obtained from adventures, fishing NPCs, passes, shops, rewards, and the market; friendly pets can breed and hostile pets can fight/lose levels. Source: <https://dankmemer.lol/tutorials/pet-basics> | Pets are a high-retention feature that can connect existing adventures, fishing, item rewards, market, and progression. |
| UnbelievaBoat homepage | Highlights customizable server economy, income commands, shops/items, role rewards, casino games, animal racing/training, taxes, moderation, permissions, and dashboard-driven configuration. Source: <https://unbelievaboat.com/> | If this project wants server adoption rather than a single global economy, admin-configurable currency/shop/roles/taxes are differentiators. |
| UnbelievaBoat economy command listing | Includes economy stats, deposit, withdraw, give-money, money, leaderboard, clean-leaderboard, reset-money, and reset-economy. Source: <https://unbelievaboat.com/commands?module=economy> | Basic economy management/leaderboard/admin reset commands are expected by server owners and are mostly missing or incomplete here. |
| Tatsu homepage and help docs | Emphasizes global economy, profile cards, badges, pets, furniture, item trading/gifting, frequent store updates, and server-specific currency/rank/store systems. Sources: <https://tatsu.gg/> and <https://support.tatsu.gg/hc/en-us/articles/900007295883-List-of-Tatsu-Commands> | Cosmetics, housing/profile personalization, trading, and server reward stores can turn earned currency into visible social status. |

## Recommended roadmap

### Phase 1: Stabilize core economy correctness

1. **Transaction-safe economy operations**
   - Add `transferCoins`, `settleWager`, `moveWalletToBank`, `moveBankToWallet`, `transferItems`, and `completeAdventureRun` helpers using `db.transaction()`.
   - Centralize balance/item revalidation inside those helpers so commands cannot accidentally skip checks.

2. **Utility/config test suite**
   - Replace the placeholder `npm test` with Node's built-in test runner or a small dependency-free test script.
   - Cover number parsing, duration parsing, cooldown reset calculations, item config validity, achievement/badge config references, and transaction helpers.

3. **Persistent cooldowns for grind commands**
   - Add a `cooldowns(user_id, command_name, expires_at)` table.
   - Keep current in-memory cooldowns as cache, but fall back to DB after restart.

4. **Environment-safe service startup**
   - Make trivia fetch opt-in/lazy and test-friendly.
   - Resolve SQLite path through `ECONOMY_DB_PATH` with a stable default.

### Phase 2: Add expected economy features

1. **Leaderboards and economy stats**
   - Add `/leaderboard wallet|bank|net|level|wins`, `/economy stats`, and admin `/economy clean-left-users` if guild-scoped mode is introduced.
   - This matches common expectations from UnbelievaBoat and competitive economy bots.

2. **Shop buy/sell layer**
   - Add `/shop view`, `/shop buy`, `/shop sell`, and rotating featured items.
   - Keep `items.json` as source of truth, but split static item metadata from dynamic shop stock/prices if rotating prices are added.

3. **Player marketplace**
   - Add market listings for items first: `/market post`, `/market view`, `/market buy`, `/market cancel`.
   - Include listing fees, taxes, expiration, minimum/maximum prices, and price-history logs to reduce inflation and abuse.

4. **Rob/heist with protection items**
   - Add opt-in or guild-configurable robbing, with padlocks/landmines/life savers, cooldowns, fail penalties, and friend/guild restrictions.
   - This is highly recognizable from Dank-style bots but should be configurable to avoid toxic server dynamics.

### Phase 3: Add retention systems

1. **Pets 1.0**
   - Schema: `pets`, `user_pets`, `pet_stats`, and `pet_cooldowns`.
   - Commands: `/pets buy`, `/pets view`, `/pets feed`, `/pets wash`, `/pets play`, `/pets fetch`, `/pets rename`.
   - Rewards: pets can find low-value items/coins, unlock profile cosmetics, and contribute to multipliers.

2. **Fishing/Hunting/Digging collection books**
   - Convert existing fish/hunt/dig commands from simple loot tables into collectible catalogs with rarity, variants, locations, tools, bait/ammo/shovels, NPC tasks, and leaderboards.
   - This builds toward Dank Memer's current deeper fishing loop without needing to clone it exactly.

3. **Farming and passive production**
   - Add plots, seeds, growth timers, harvests, fertilizer, and occasional pests/weather.
   - This creates non-gambling progression and item sinks.

4. **Cosmetics and profile/housing sinks**
   - Add profile cards/backgrounds, badges display slots, furniture/room items, and prestige cosmetics.
   - Cosmetic sinks help control inflation without punishing casual players.

### Phase 4: Server-owner customization

1. **Guild economy settings**
   - Currency name/emoji, starting balance, income multipliers, rob enabled/disabled, shop categories, reward roles, tax rates, and command permissions.

2. **Role store and reward automation**
   - Let admins sell temporary/permanent roles for coins.
   - Add audit logs and refunds on role removal where possible.

3. **Admin dashboard/export commands**
   - Even without a web dashboard, add `/economy export`, `/economy import-check`, and `/economy audit user` to make operations manageable.

## Suggested immediate next implementation ticket

**Implement transaction-safe transfer and wager settlement helpers, then migrate deposit, withdraw, friends share, slots, and snakeeyes to use them.**

Why this should be first:

- It directly protects every existing high-volume money path.
- It creates reusable primitives needed by marketplace, robbing, shop, and heist features.
- It is easier to verify with small deterministic tests than a large new gameplay system.

Acceptance criteria:

- `npm test` passes and includes tests for successful transfer, insufficient funds, invalid amount, partial-failure rollback, and wager payout/loss accounting.
- Deposit/withdraw/friend-share/casino commands no longer call multiple independent balance/item mutation helpers for one logical transaction.
- Currency logs are written inside the same transaction or are explicitly documented as best-effort telemetry.
