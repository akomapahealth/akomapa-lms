import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
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
    assertTrustedOrigin(req);

    const { userId } = await requirePrincipal();
    await enforceRateLimit(req, "write.default", { userId: userId });

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
