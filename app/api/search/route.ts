import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const querySchema = z.string().trim().min(2).max(100);

export async function GET(request: Request) {
  const user = await requireUser();
  const query = querySchema.safeParse(
    new URL(request.url).searchParams.get("q"),
  );
  if (!query.success) return NextResponse.json({ items: [] });
  const terms = query.data.split(/\s+/).slice(0, 6);
  const systems = await db.coolingTowerSystem.findMany({
    where: {
      active: true,
      deletedAt: null,
      building: {
        active: true,
        deletedAt: null,
        customer: {
          organizationId: user.organizationId,
          active: true,
          deletedAt: null,
        },
      },
      AND: terms.map((term) => ({
        OR: [
          { internalJobNumber: { contains: term, mode: "insensitive" } },
          { systemName: { contains: term, mode: "insensitive" } },
          { serialNumber: { contains: term, mode: "insensitive" } },
          { registrationNumber: { contains: term, mode: "insensitive" } },
          { NYCSystemId: { contains: term, mode: "insensitive" } },
          { NYSSystemId: { contains: term, mode: "insensitive" } },
          {
            building: {
              buildingName: { contains: term, mode: "insensitive" },
            },
          },
          {
            building: {
              streetAddress: { contains: term, mode: "insensitive" },
            },
          },
          {
            building: { city: { contains: term, mode: "insensitive" } },
          },
          {
            building: { postalCode: { contains: term, mode: "insensitive" } },
          },
          {
            building: {
              customer: { name: { contains: term, mode: "insensitive" } },
            },
          },
          {
            building: {
              customer: {
                accountNumber: { contains: term, mode: "insensitive" },
              },
            },
          },
        ],
      })),
    },
    select: {
      id: true,
      internalJobNumber: true,
      systemName: true,
      building: {
        select: {
          buildingName: true,
          streetAddress: true,
          customer: { select: { name: true } },
        },
      },
    },
    orderBy: [{ building: { buildingName: "asc" } }, { systemName: "asc" }],
    take: 8,
  });
  return NextResponse.json({
    items: systems.map((system) => ({
      id: system.id,
      href: `/systems/${system.id}`,
      title: `${system.building.buildingName} — ${system.systemName}`,
      subtitle: `${system.building.customer.name} · ${system.building.streetAddress} · ${system.internalJobNumber}`,
      keywords: "",
    })),
  });
}
