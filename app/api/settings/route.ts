import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

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
    console.log("[SETTINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const values = await req.json();

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
    console.log("[SETTINGS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
