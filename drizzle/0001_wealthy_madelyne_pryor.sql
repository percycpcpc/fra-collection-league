PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Deck` (
	`id` text PRIMARY KEY NOT NULL,
	`profileId` text NOT NULL,
	`name` text NOT NULL,
	`commander` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Deck`("id", "profileId", "name", "commander", "createdAt") SELECT "id", "profileId", "name", "commander", "createdAt" FROM `Deck`;--> statement-breakpoint
DROP TABLE `Deck`;--> statement-breakpoint
ALTER TABLE `__new_Deck` RENAME TO `Deck`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `Deck_profileId_idx` ON `Deck` (`profileId`);--> statement-breakpoint
CREATE TABLE `__new_Match` (
	`id` text PRIMARY KEY NOT NULL,
	`winnerId` text NOT NULL,
	`loserId` text NOT NULL,
	`winnerDeckId` text,
	`loserDeckId` text,
	`note` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`winnerId`) REFERENCES `Profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`loserId`) REFERENCES `Profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Match`("id", "winnerId", "loserId", "winnerDeckId", "loserDeckId", "note", "createdAt") SELECT "id", "winnerId", "loserId", "winnerDeckId", "loserDeckId", "note", "createdAt" FROM `Match`;--> statement-breakpoint
DROP TABLE `Match`;--> statement-breakpoint
ALTER TABLE `__new_Match` RENAME TO `Match`;--> statement-breakpoint
CREATE INDEX `Match_winnerId_idx` ON `Match` (`winnerId`);--> statement-breakpoint
CREATE INDEX `Match_loserId_idx` ON `Match` (`loserId`);--> statement-breakpoint
CREATE TABLE `__new_Profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_Profile`("id", "name", "createdAt") SELECT "id", "name", "createdAt" FROM `Profile`;--> statement-breakpoint
DROP TABLE `Profile`;--> statement-breakpoint
ALTER TABLE `__new_Profile` RENAME TO `Profile`;--> statement-breakpoint
CREATE UNIQUE INDEX `Profile_name_unique` ON `Profile` (`name`);