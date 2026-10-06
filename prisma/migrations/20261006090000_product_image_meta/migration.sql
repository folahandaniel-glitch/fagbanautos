-- Photo metadata: attribution for licensed photos and the stored (compressed) dimensions.
ALTER TABLE "ProductImage" ADD COLUMN "credit" TEXT;
ALTER TABLE "ProductImage" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "ProductImage" ADD COLUMN "width" INTEGER;
ALTER TABLE "ProductImage" ADD COLUMN "height" INTEGER;
ALTER TABLE "ProductImage" ADD COLUMN "bytes" INTEGER;
