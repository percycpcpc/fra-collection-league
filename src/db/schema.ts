import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export const profiles = sqliteTable("Profile", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull().unique(),
  iconCard:  text("iconCard"),
  createdAt: text("createdAt").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const profileRelations = relations(profiles, ({ many }) => ({
  cards:  many(collectionCards),
  decks:  many(decks),
  wins:   many(matches, { relationName: "MatchWins" }),
  losses: many(matches, { relationName: "MatchLosses" }),
}));

// ---------------------------------------------------------------------------
// CollectionCard
// ---------------------------------------------------------------------------
export const collectionCards = sqliteTable(
  "CollectionCard",
  {
    id:        text("id").primaryKey(),
    profileId: text("profileId").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    name:      text("name").notNull(),
    qty:       integer("qty").notNull().default(1),
    owned:     integer("owned", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    unique("CollectionCard_profileId_name_key").on(t.profileId, t.name),
    index("CollectionCard_profileId_idx").on(t.profileId),
  ],
);

export const collectionCardRelations = relations(collectionCards, ({ one }) => ({
  profile: one(profiles, { fields: [collectionCards.profileId], references: [profiles.id] }),
}));

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------
export const decks = sqliteTable(
  "Deck",
  {
    id:        text("id").primaryKey(),
    profileId: text("profileId").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    name:      text("name").notNull(),
    commander: text("commander"),
    createdAt: text("createdAt").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("Deck_profileId_idx").on(t.profileId)],
);

export const deckRelations = relations(decks, ({ one, many }) => ({
  profile: one(profiles, { fields: [decks.profileId], references: [profiles.id] }),
  cards:   many(deckCards),
}));

// ---------------------------------------------------------------------------
// DeckCard
// ---------------------------------------------------------------------------
export const deckCards = sqliteTable(
  "DeckCard",
  {
    id:      text("id").primaryKey(),
    deckId:  text("deckId").notNull().references(() => decks.id, { onDelete: "cascade" }),
    name:    text("name").notNull(),
    qty:     integer("qty").notNull().default(1),
    isBasic: integer("isBasic", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    unique("DeckCard_deckId_name_key").on(t.deckId, t.name),
    index("DeckCard_deckId_idx").on(t.deckId),
  ],
);

export const deckCardRelations = relations(deckCards, ({ one }) => ({
  deck: one(decks, { fields: [deckCards.deckId], references: [decks.id] }),
}));

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------
export const matches = sqliteTable(
  "Match",
  {
    id:           text("id").primaryKey(),
    winnerId:     text("winnerId").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    loserId:      text("loserId").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    winnerDeckId: text("winnerDeckId"),
    loserDeckId:  text("loserDeckId"),
    note:         text("note"),
    createdAt:    text("createdAt").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("Match_winnerId_idx").on(t.winnerId),
    index("Match_loserId_idx").on(t.loserId),
  ],
);

export const matchRelations = relations(matches, ({ one }) => ({
  winner: one(profiles, { fields: [matches.winnerId], references: [profiles.id], relationName: "MatchWins" }),
  loser:  one(profiles, { fields: [matches.loserId], references: [profiles.id], relationName: "MatchLosses" }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Profile        = typeof profiles.$inferSelect;
export type CollectionCard = typeof collectionCards.$inferSelect;
export type Deck           = typeof decks.$inferSelect;
export type DeckCard       = typeof deckCards.$inferSelect;
export type Match          = typeof matches.$inferSelect;
