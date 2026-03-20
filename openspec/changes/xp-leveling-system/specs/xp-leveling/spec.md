## ADDED Requirements

### Requirement: XP granted on message
The system SHALL grant XP to a user when they send a message in a guild channel, subject to a per-guild cooldown.

#### Scenario: XP granted after cooldown
- **WHEN** a user sends a message and their last XP grant was more than `cooldown_seconds` ago
- **THEN** the system grants a random XP amount between `xp_min` and `xp_max` (inclusive) and persists the updated total

#### Scenario: XP withheld during cooldown
- **WHEN** a user sends a message and their last XP grant was less than `cooldown_seconds` ago
- **THEN** the system SHALL NOT grant any XP for that message

#### Scenario: Bot messages ignored
- **WHEN** a message is sent by a bot user
- **THEN** the system SHALL NOT grant any XP

### Requirement: Level calculated from total XP
The system SHALL derive a user's current level from their total cumulative XP using the formula `xpToNextLevel(n) = 5n² + 50n + 100`, where total XP to reach level `n` equals the sum of `xpToNextLevel(k)` for k=0 to n-1.

#### Scenario: Level derived correctly
- **WHEN** a user has 255 total XP
- **THEN** the system SHALL report their level as 2

#### Scenario: Level does not decrease
- **WHEN** a user's XP is updated
- **THEN** their stored level SHALL only ever increase, never decrease

### Requirement: Role reward granted on level-up
The system SHALL assign a configured role reward to a user when they reach a level that has a role mapped.

#### Scenario: Role assigned on level-up
- **WHEN** a user levels up to a level that has a `level_roles` entry for the guild
- **THEN** the system SHALL assign that role to the user in the guild

#### Scenario: No role assigned when none configured
- **WHEN** a user levels up to a level with no `level_roles` entry
- **THEN** the system SHALL NOT attempt any role assignment

#### Scenario: Permission error handled gracefully
- **WHEN** the bot lacks permission to assign the role
- **THEN** the system SHALL log the error and continue without crashing

### Requirement: Per-guild XP configuration
The system SHALL apply guild-specific `xp_min`, `xp_max`, and `cooldown_seconds` values, falling back to defaults (15, 25, 60) when not configured.

#### Scenario: Custom config applied
- **WHEN** a guild has `xp_min=10`, `xp_max=20`, `cooldown_seconds=30` configured
- **THEN** XP grants for that guild SHALL use those values

#### Scenario: Default config applied
- **WHEN** a guild has no config row
- **THEN** XP grants SHALL use defaults: xp_min=15, xp_max=25, cooldown_seconds=60
