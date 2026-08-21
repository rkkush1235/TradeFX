"use client";

import { useState } from "react";
import Link from "next/link";
import { bootstrapSuperAdmin, DEFAULT_SUPER_ADMIN_EMAIL, DEFAULT_SUPER_ADMIN_PASSWORD } from "@/services/bootstrapSuperAdmin";

export default function SuperAdminBootstrapPage() {
  const [status, setStatus] = useState("");
  const run = async () => {
    setStatus("Creating Super Admin...");
    try { const uid = await bootstrapSuperAdmin(); setStatus(`Created. UID: ${uid}`); }
    catch (e) { setStatus(e instanceof Error ? e.message : "Could not create Super Admin. It may already exist."); }
  };
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-4"><section className="glass w-full space-y-4 p-6"><h1 className="text-xl font-semibold">TradeFX Super Admin Setup</h1><p className="text-sm text-zinc-400">Run this one time after Firebase is configured. If the account already exists, Firebase will reject the duplicate.</p><div className="rounded-lg border border-zinc-700 p-3 text-sm"><p>Email: <b>{DEFAULT_SUPER_ADMIN_EMAIL}</b></p><p>Password: <b>{DEFAULT_SUPER_ADMIN_PASSWORD}</b></p></div><button onClick={run} className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-bold text-zinc-950">Create Super Admin</button>{status && <p className="break-all rounded-lg border border-zinc-700 p-3 text-xs text-zinc-300">{status}</p>}<Link href="/login" className="block text-center text-sm text-emerald-300">Go to Login</Link></section></main>;
}
