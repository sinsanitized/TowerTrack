import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const db = new PrismaClient();
  if ((await db.organization.count()) > 0) {
    await db.$disconnect();
    console.log(
      "Organization already initialized; preserving existing records.",
    );
    return;
  }

  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    await db.$disconnect();
    throw new Error(
      "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required for a new production database.",
    );
  }

  await db.organization.create({
    data: {
      name: process.env.INITIAL_ORGANIZATION_NAME || "TowerTrack",
      users: {
        create: {
          name: "TowerTrack Administrator",
          email: email.toLowerCase(),
          passwordHash: await bcrypt.hash(password, 12),
          role: UserRole.ADMIN,
        },
      },
    },
  });
  await db.$disconnect();
  console.log("Created the initial organization and administrator.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
