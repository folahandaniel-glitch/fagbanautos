import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
db.user.findMany({ select: { email: true, status: true, createdAt: true, mustChangePassword: true } }).then((r) => console.log(JSON.stringify(r))).finally(() => db.$disconnect());
