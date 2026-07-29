import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const apkPath = path.join(process.cwd(), "public", "downloads", "tradefx.apk");

  try {
    const apkBuffer = await fs.readFile(apkPath);

    return new NextResponse(apkBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="tradefx.apk"',
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("APK not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
