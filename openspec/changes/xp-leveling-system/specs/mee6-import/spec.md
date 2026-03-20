## ADDED Requirements

### Requirement: Leveling data imported from CSV attachment
The system SHALL accept a CSV file attachment on `/import-levels` and upsert all rows into `user_levels` for the current guild.

#### Scenario: Successful import
- **WHEN** an admin invokes `/import-levels` with a valid CSV attachment (columns: platformId, username, XP, currentLevel)
- **THEN** the system SHALL parse each row and upsert into `user_levels`, then respond with the count of records imported

#### Scenario: Existing records overwritten
- **WHEN** a CSV row's `platformId` already exists in `user_levels` for the guild
- **THEN** the system SHALL overwrite the existing XP, level, and username with the values from the CSV

#### Scenario: Invalid CSV rejected
- **WHEN** the attached file is missing required columns or is not parseable
- **THEN** the system SHALL respond with an error message and import no records

#### Scenario: No attachment provided
- **WHEN** `/import-levels` is invoked without a file attachment
- **THEN** the system SHALL respond with an error prompting the user to attach a CSV file
