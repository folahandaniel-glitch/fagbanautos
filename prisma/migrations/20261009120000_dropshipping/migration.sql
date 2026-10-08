ALTER TABLE "Product" ADD COLUMN "fulfilment" TEXT NOT NULL DEFAULT 'STOCK',
ADD COLUMN "dropshipPartner" TEXT,
ADD COLUMN "dropshipLeadDays" INTEGER;
