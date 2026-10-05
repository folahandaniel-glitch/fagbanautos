-- Documents: stable, sequential numbers per document type and subject.
ALTER TABLE "Document" ADD COLUMN "refId" TEXT NOT NULL;

CREATE UNIQUE INDEX "Document_type_refId_key" ON "Document"("type", "refId");

CREATE TABLE "DocumentCounter" (
    "key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("key")
);
