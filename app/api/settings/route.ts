import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseBody } from "@/lib/http";
import { settingsUpdateSchema } from "@/lib/validations/settings";

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
    return handleRouteError("SETTINGS_GET", error);
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await requirePrincipal();

    const values = await parseBody(settingsUpdateSchema, req);

    const settings = await db.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...values,
      },
      update: values,
    });

    return NextResponse.json(settings);
  } catch (error) {
    return handleRouteError("SETTINGS_PATCH", error);
  }
}
