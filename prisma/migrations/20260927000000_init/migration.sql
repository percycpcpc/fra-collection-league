-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionCard" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "owned" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CollectionCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commander" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "isBasic" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profile_name_key" ON "Profile"("name");
CREATE INDEX "CollectionCard_profileId_idx" ON "CollectionCard"("profileId");
CREATE UNIQUE INDEX "CollectionCard_profileId_name_key" ON "CollectionCard"("profileId", "name");
CREATE INDEX "Deck_profileId_idx" ON "Deck"("profileId");
CREATE INDEX "DeckCard_deckId_idx" ON "DeckCard"("deckId");
CREATE UNIQUE INDEX "DeckCard_deckId_name_key" ON "DeckCard"("deckId", "name");

ALTER TABLE "CollectionCard" ADD CONSTRAINT "CollectionCard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
