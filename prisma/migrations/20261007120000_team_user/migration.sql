ALTER TABLE "TeamMember" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");
