"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/format";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3,
  LayoutDashboard,
  Shield,
  User,
  Wallet,
  Landmark,
  HandCoins,
  type LucideIcon,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: BarChart3 },
  { href: "/trades", label: "Position", icon: BarChart3 },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/deposit", label: "Deposit", icon: Landmark },
  { href: "/withdraw", label: "Withdraw", icon: HandCoins },
  { href: "/profile", label: "Profile", icon: User },
  // { href: "/settings", label: "Settings", icon: Settings },
];

const adminLinks = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/users", label: "Admin Users", icon: User },
  { href: "/admin/kyc", label: "Admin KYC", icon: Shield },
  { href: "/admin/deposits", label: "Admin Deposits", icon: Landmark },
  { href: "/admin/withdrawals", label: "Admin Withdrawals", icon: HandCoins },
  // { href: "/admin/settings", label: "Admin Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const { appUser } = useAuth();
  const navLinks = appUser?.role === "admin" ? adminLinks : links;
  const bottomLinks = links.filter((item) =>
    ["/dashboard", "/markets", "/trades", "/wallet", "/profile"].includes(item.href),
  );

  return (
    <>
      <aside className="glass fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] w-64 p-4 md:block">
        <SidebarContent pathname={pathname} links={navLinks} />
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "glass fixed left-0 top-0 z-50 h-screen w-72 p-4 transition-transform md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent pathname={pathname} links={navLinks} onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {appUser?.role !== "admin" ? (
        <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur md:hidden">
          {bottomLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition",
                  active ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-400",
                )}
              >
                <Icon size={18} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}

function SidebarContent({
  pathname,
  links,
  onNavigate,
}: {
  pathname: string;
  links: Array<{ href: string; label: string; icon: LucideIcon }>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Trade FX</p>
        <h2 className="mt-2 text-xl font-semibold">Live Markets</h2>
      </div>

      <nav className="mt-8 space-y-2">
        {links.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-zinc-300 hover:bg-zinc-800/70",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto" />
    </div>
  );
}
