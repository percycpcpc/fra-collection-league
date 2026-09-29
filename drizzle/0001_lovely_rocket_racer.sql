CREATE TABLE `Catalog` (
	`name` text PRIMARY KEY NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`img` text DEFAULT '' NOT NULL,
	`colors` text DEFAULT '' NOT NULL,
	`rarity` text DEFAULT '' NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`colorIdentity` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SiteSetting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
