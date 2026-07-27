import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password)
    throw new Error("Usage: npm run admin:reset-password -- email password");
  const db = new PrismaClient();
  await db.user.update({
    where: { email: email.toLowerCase() },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  await db.$disconnect();
  console.log(`Reset ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
