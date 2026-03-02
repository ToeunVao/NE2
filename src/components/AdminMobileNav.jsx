"use client";
import React from 'react'; // Add this for safety
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BarChart3, Bell, Calendar, Gift, Settings } from "lucide-react";

// 1. ENSURE THIS IS EXPORT DEFAULT
export default function AdminMobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 px-6 py-3 z-50 flex justify-between items-center pb-2">
      <NavLink href="/admin" icon={<LayoutDashboard size={20} />} label="Home" />
      <NavLink class="pr-5" href="/admin/reports/salon-earning" icon={<BarChart3 size={20} />} label="Report" />
      <NavLink href="/admin/gift-cards" icon={<Gift size={20} />} label="Gifts" />
      <NavLink href="/admin/booking" icon={<Calendar size={20} />} label="Booking" />
    </nav>
  );
}

// 2. NavLink can stay in the same file as a regular function
function NavLink({ href, icon, label }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href} className="flex flex-col items-center gap-1">
      <div className={`p-2 rounded-xl transition-all ${
        isActive 
          ? "bg-pink-50 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400" 
          : "text-slate-400 dark:text-slate-500"
      }`}>
        {icon}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-tighter ${
        isActive ? "text-pink-600 dark:text-pink-400" : "text-slate-400 dark:text-slate-500"
      }`}>
        {label}
      </span>
    </Link>
  );
}