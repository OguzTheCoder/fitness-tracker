-- AlterTable
ALTER TABLE "Food" ADD COLUMN "barcode" TEXT;

-- CreateIndex
CREATE INDEX "Food_isCore_barcode_idx" ON "Food"("isCore", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Food_userId_barcode_key" ON "Food"("userId", "barcode");
