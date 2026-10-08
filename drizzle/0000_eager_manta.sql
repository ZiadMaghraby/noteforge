CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`icon` text DEFAULT '📄' NOT NULL,
	`kind` text DEFAULT 'document' NOT NULL,
	`cover` text DEFAULT 'none' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`blocks` text DEFAULT '[]' NOT NULL,
	`rows` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `workspaces`(`owner_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pages_owner_parent` ON `pages` (`owner_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'My workspace' NOT NULL,
	`created_at` text NOT NULL
);
