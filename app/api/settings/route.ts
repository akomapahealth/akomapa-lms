import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { settingsUpdateSchema } from "@/lib/validations/settings";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const { userId } = await requirePrincipal();

    const settings = await db.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      const created = await db.userSettings.create({
        data: { userId },
      });
      return NextResponse.json(created);
    }

    return NextResponse.json(settings);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("SETTINGS_GET", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await requirePrincipal();

    const body = await req.json();

    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return new NextResponse("Invalid data", { status: 400 });
    }

    const settings = await db.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...parsed.data,
      },
      update: parsed.data,
    });

    return NextResponse.json(settings);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("SETTINGS_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
