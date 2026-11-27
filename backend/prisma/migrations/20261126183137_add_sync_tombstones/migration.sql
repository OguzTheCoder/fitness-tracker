-- AlterTable
ALTER TABLE "CalorieEntry" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "CardioEntry" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Food" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "NutritionLog" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "StepEntry" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "WeightEntry" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "WorkoutEntry" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "WorkoutTemplate" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "CalorieEntry_userId_updatedAt_idx" ON "CalorieEntry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CardioEntry_userId_updatedAt_idx" ON "CardioEntry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Exercise_userId_updatedAt_idx" ON "Exercise"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Food_userId_updatedAt_idx" ON "Food"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "NutritionLog_userId_updatedAt_idx" ON "NutritionLog"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Recipe_userId_updatedAt_idx" ON "Recipe"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "StepEntry_userId_updatedAt_idx" ON "StepEntry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "WeightEntry_userId_updatedAt_idx" ON "WeightEntry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkoutEntry_userId_updatedAt_idx" ON "WorkoutEntry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_userId_updatedAt_idx" ON "WorkoutTemplate"("userId", "updatedAt");
