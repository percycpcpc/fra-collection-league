CREATE TABLE `CollectionCard` (
	`id` text PRIMARY KEY NOT NULL,
	`profileId` text NOT NULL,
	`name` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`owned` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CollectionCard_profileId_idx` ON `CollectionCard` (`profileId`);--> statement-breakpoint
CREATE UNIQUE INDEX `CollectionCard_profileId_name_key` ON `CollectionCard` (`profileId`,`name`);--> statement-breakpoint
CREATE TABLE `DeckCard` (
	`id` text PRIMARY KEY NOT NULL,
	`deckId` text NOT NULL,
	`name` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`isBasic` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`deckId`) REFERENCES `Deck`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `DeckCard_deckId_idx` ON `DeckCard` (`deckId`);--> statement-breakpoint
CREATE UNIQUE INDEX `DeckCard_deckId_name_key` ON `DeckCard` (`deckId`,`name`);--> statement-breakpoint
CREATE TABLE `Deck` (
	`id` text PRIMARY KEY NOT NULL,
	`profileId` text NOT NULL,
	`name` text NOT NULL,
	`commander` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Deck_profileId_idx` ON `Deck` (`profileId`);--> statement-breakpoint
CREATE TABLE `Match` (
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
CREATE INDEX `Match_winnerId_idx` ON `Match` (`winnerId`);--> statement-breakpoint
CREATE INDEX `Match_loserId_idx` ON `Match` (`loserId`);--> statement-breakpoint
CREATE TABLE `Profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`iconCard` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Profile_name_unique` ON `Profile` (`name`);