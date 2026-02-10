"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [needCount, setNeedCount] = useState(0);

  const loadCount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    const { count } = await supabase
      .from("products_with_timing")
      .select("*", { count: "exact", head: true })
      .eq("household_id", membership.household_id)
      .in("status", ["on_list", "reminded"]);

    setNeedCount(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, [loadCount]);

  const links = [
    { href: "/", label: "Voorraad", icon: "\uD83D\uDCE6" },
    { href: "/shopping-list", label: "Nodig", icon: "\uD83D\uDED2", badge: needCount },
    { href: "/reminders", label: "Reminders", icon: "\uD83D\uDD14" },
    { href: "/settings", label: "Instellingen", icon: "\u2699\uFE0F" },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname === link.href
                  ? "bg-green-100 text-green-800"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="text-base">{link.icon}</span>
              <span className="hidden sm:inline">{link.label}</span>
              {link.badge !== undefined && link.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span className="text-base">{"\uD83D\uDEAA"}</span>
          <span className="hidden sm:inline">Uit</span>
        </button>
      </div>
    </nav>
  );
}
