import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
async function main() {
  const [email, password, name = "TowerTrack Admin"] = process.argv.slice(2);
  if (!email || !password)
    throw new Error("Usage: npm run admin:create -- email password [name]");
  const db = new PrismaClient();
  const org = await db.organization.findFirstOrThrow();
  await db.user.create({
    data: {
      organizationId: org.id,
      email: email.toLowerCase(),
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.ADMIN,
    },
  });
  await db.$disconnect();
  console.log(`Created ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
