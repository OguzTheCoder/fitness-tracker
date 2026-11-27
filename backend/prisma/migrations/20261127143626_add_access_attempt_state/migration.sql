-- CreateTable
CREATE TABLE "AccessAttemptState" (
    "scope" TEXT NOT NULL PRIMARY KEY,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastFailedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
