## ADDED Requirements

### Requirement: Rank card rendered on /level command
The system SHALL render a rank card image and return it as a Discord attachment when `/level` is invoked.

#### Scenario: Self rank card
- **WHEN** a user invokes `/level` with no arguments
- **THEN** the system SHALL render and return a rank card for the invoking user

#### Scenario: Other user rank card
- **WHEN** a user invokes `/level` with a user mention
- **THEN** the system SHALL render and return a rank card for the mentioned user

#### Scenario: Untracked user
- **WHEN** `/level` is invoked for a user with no XP record in the guild
- **THEN** the system SHALL render a rank card showing level 0, 0 XP, and rank N/A

### Requirement: Rank card displays user stats
The rank card image SHALL include: user avatar (circular), username, current level, rank position within the guild, current XP, XP required for next level, and an XP progress bar.

#### Scenario: Progress bar reflects XP within current level
- **WHEN** a user is halfway through the XP required for their current level
- **THEN** the progress bar SHALL be filled to approximately 50%

#### Scenario: Rank position reflects leaderboard order
- **WHEN** multiple users have XP in the guild
- **THEN** the rank shown SHALL reflect the user's position ordered by total XP descending

### Requirement: Background image set via attachment
The system SHALL accept an image file attachment on `/set-level-background`, download it immediately, and store the raw bytes and MIME type as a BLOB in the database.

#### Scenario: Background saved from attachment
- **WHEN** an admin invokes `/set-level-background` with an image attachment
- **THEN** the system SHALL download the image, store it as a BLOB in `guild_configs`, and confirm success

#### Scenario: No URL dependency after set
- **WHEN** the original attachment URL has expired
- **THEN** the system SHALL still serve the background correctly from the stored BLOB

#### Scenario: Oversized image rejected
- **WHEN** the attached image exceeds the maximum allowed file size
- **THEN** the system SHALL reject it with an error message and not update the stored background

### Requirement: Rank card uses configurable background
The system SHALL use the guild's stored background BLOB as the rank card background, falling back to a default solid color when none is set.

#### Scenario: Custom background applied
- **WHEN** the guild has a background BLOB stored in `guild_configs`
- **THEN** the rank card SHALL render that image as the background

#### Scenario: Default background used
- **WHEN** the guild has no background BLOB
- **THEN** the rank card SHALL use a default dark solid color background

#### Scenario: Background decoded and cached in memory
- **WHEN** the same guild background is used for multiple `/level` requests
- **THEN** the BLOB SHALL be decoded from the DB only once and cached in-memory, not re-read on every request
