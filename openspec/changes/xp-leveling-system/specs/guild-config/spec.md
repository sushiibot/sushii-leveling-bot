## ADDED Requirements

### Requirement: Level role configured via command
The system SHALL allow guild admins to map a role to a level via `/set-level-role`, so users who reach that level are automatically granted that role.

#### Scenario: Role reward set
- **WHEN** an admin invokes `/set-level-role <level> <role>`
- **THEN** the system SHALL upsert the `(guild_id, level, role_id)` row in `level_roles` and confirm success

#### Scenario: Role reward overwritten
- **WHEN** an admin sets a role for a level that already has a role mapped
- **THEN** the system SHALL replace the existing mapping with the new role

### Requirement: Level role removed via command
The system SHALL allow guild admins to remove a role reward for a level via `/remove-level-role`.

#### Scenario: Role reward removed
- **WHEN** an admin invokes `/remove-level-role <level>` and a mapping exists
- **THEN** the system SHALL delete the row from `level_roles` and confirm success

#### Scenario: Remove non-existent mapping
- **WHEN** an admin invokes `/remove-level-role <level>` and no mapping exists for that level
- **THEN** the system SHALL respond with an informational message indicating nothing was configured for that level

### Requirement: Guild config defaults applied when absent
The system SHALL fall back to default values for all guild config fields when no row exists in `guild_configs`.

#### Scenario: Defaults returned for unconfigured guild
- **WHEN** a guild has no row in `guild_configs`
- **THEN** the system SHALL use xp_min=15, xp_max=25, cooldown_seconds=60, and no background image
