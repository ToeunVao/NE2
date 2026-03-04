"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Clock, User } from "lucide-react";

export default function ClientMobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 px-6 py-3 z-50 flex justify-between items-center pb-8">
      <NavLink href="/dashboard" icon={<Home size={20} />} label="Home" />
      <NavLink href="/book" icon={<Calendar size={20} />} label="Book" />
      <NavLink href="/appointments" icon={<Clock size={20} />} label="History" />
      <NavLink href="/profile" icon={<User size={20} />} label="Profile" />
    </nav>
  );
}

// --- ADD THIS HELPER COMPONENT HERE ---
function NavLink({ href, icon, label }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center gap-1 transition-colors ${
        isActive 
          ? "text-pink-600 " 
          : "text-slate-400 dark:text-slate-500"
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold  uppercase tracking-tighter">
        {label}
      </span>
    </Link>
  );
}