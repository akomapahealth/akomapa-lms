import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { settingsUpdateSchema } from "@/lib/validations/settings";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
    logError("SETTINGS_GET", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
    logError("SETTINGS_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
