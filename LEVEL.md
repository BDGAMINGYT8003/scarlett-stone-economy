# Level System Blueprint

## Philosophy
The leveling system is designed to be **fun, rewarding, and secure**. It rewards active play while strictly preventing abuse through cooldowns, outcome-based logic, and exclusion of exploitable commands.

## Data Structures

### 1. `src/config/levels.json`
This file will store the rewards for each level.
```json
[
  { "level": 1, "rewards": { "coins": 25000, "title": "Newbie" } },
  { "level": 2, "rewards": { "coins": 25000, "items": [{ "id": "life_saver", "amount": 1 }] } },
  ...
]
```

### 2. User Database Schema
Existing `users` table already has:
- `level` (INTEGER)
- `xp` (INTEGER)

No schema changes required.

## Logic Flow

### XP Calculation
- **Formula:** XP Required for Next Level = `(CurrentLevel + 1) * 250`
- **Base XP:**
    - Profit/Gain Outcome: **2 XP**
    - Loss/Neutral Outcome: **1 XP**

### XP Granting Mechanism (`src/utils/levelManager.js`)
A centralized helper function `grantXp(userId, outcomeType, interaction)` will be created.
- `outcomeType`: 'profit' or 'neutral'.
- **Security Checks:**
    - **Cooldown:** Verify command is not on cooldown (handled by command logic mostly, but double check if possible).
    - **Command Whitelist:** Only Economy commands.
    - **Interaction Type:** Slash Commands only (or specific button interactions that are "gameplay" moves, not navigation).
    - **Exclusions:** Explicitly block `/friends share` commands.

### Level Up Event
When XP threshold is reached:
1. Increment `level`.
2. Reset `xp` (or carry over overflow? Standard is usually cumulative or reset. Current logic in `db.addXp` carries over).
3. Fetch rewards from `levels.json`.
4. Grant rewards (add coins, add items, unlock title).
5. Send DM to user.

## Security Measures

1.  **Economy Only:** Only specific commands in `src/commands/Income` and `src/commands/Economy` (excluding friends share) trigger XP.
2.  **Explicit Triggers:** XP is not granted by `interactionCreate` globally. It is granted by calling `levelManager.grantXp()` *inside* the `execute` or specific button handler of a command, ensuring we know the outcome (Profit vs Neutral).
3.  **Friends Share Ban:** The `friends.js` command will NOT call `grantXp`.
4.  **Navigation Ban:** Pagination buttons (handled in `interactionCreate` or specific collectors) will NOT call `grantXp`.

## UI/UX

### DM Notification
**Title:** Level up!
**Content:** Poggers, [Username]! You leveled up from level **X** to **Y**
**Rewards:** List of rewards.
**Footer:** Timestamp.

### `/advancements levels` Command
- Displays paginated list of level rewards.
- Shows current level status.
- Uses visual indicators (Lock/Unlock emojis).

## Implementation Steps

1.  **Create `src/config/levels.json`:** Populate with the full chart provided.
2.  **Create `src/utils/levelManager.js`:**
    - `grantXp(userId, type, interaction)`
    - `checkLevelUp(userId, interaction)`
    - `getLevelRewards(level)`
    - Random greeting generator.
3.  **Update `src/commands/Economy/*.js` and `src/commands/Income/*.js`:**
    - Insert `levelManager.grantXp()` calls at the end of successful executions.
    - Differentiate between Profit (2 XP) and Loss (1 XP).
4.  **Create `src/commands/Rewards/advancements.js`:**
    - Implement `levels` subcommand with pagination.
