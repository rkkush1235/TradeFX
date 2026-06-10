import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

const depositsCol = collection(db, "deposits");

/**
 * Clear old approved deposit screenshots (older than 24 hours)
 * Can be called by Firebase Cloud Scheduler or manually
 * POST /api/cleanup/deposits
 * Header: Authorization: Bearer YOUR_SECRET_TOKEN
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is coming from Cloud Scheduler (check for a secret token)
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CLEANUP_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find approved deposits with screenshots that are older than 24 hours
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const q = query(
      depositsCol,
      where("status", "==", "approved")
    );

    const snapshot = await getDocs(q);
    let clearedCount = 0;
    let errorCount = 0;

    // Clear screenshots older than 24 hours
    for (const docSnap of snapshot.docs) {
      const deposit = docSnap.data();

      // Check if deposit has a screenshot and was approved more than 24 hours ago
      if (deposit.screenshotUrl && deposit.reviewedAt && deposit.reviewedAt <= twentyFourHoursAgo) {
        try {
          await updateDoc(doc(depositsCol, docSnap.id), {
            screenshotUrl: "",
            screenshotClearedAt: Date.now(),
          });
          clearedCount++;
        } catch (error) {
          console.error(`Error clearing screenshot for deposit ${docSnap.id}:`, error);
          errorCount++;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Cleared ${clearedCount} screenshots, ${errorCount} errors.`,
        clearedCount,
        errorCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cleanup job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cleanup job failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check cleanup status
 */
export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const q = query(depositsCol, where("status", "==", "approved"));
    const snapshot = await getDocs(q);

    const readyForCleanup = snapshot.docs.filter((doc) => {
      const deposit = doc.data();
      return (
        deposit.screenshotUrl &&
        deposit.reviewedAt &&
        deposit.reviewedAt <= twentyFourHoursAgo
      );
    }).length;

    return NextResponse.json({
      status: "ok",
      approvedDeposits: snapshot.size,
      screenshotsReadyForCleanup: readyForCleanup,
      currentTime: new Date(now).toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}
