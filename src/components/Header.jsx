"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import NotificationCenter from "./NotificationCenter"; // Ensure path is correct
import { 
  MoreVertical, X, Sun, Moon, ChevronDown, ChevronUp,
  LayoutDashboard, UserCheck, Calendar, ChartLine, 
  Gift, Crown, CreditCard, Boxes, Bell, Users, 
  UserCircle, Book, Settings, LogOut
} from "lucide-react";

export default function Header() {
  const { role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openSub, setOpenSub] = useState(null);

  const adminLinks = [
    { name: "Dashboard", href: "/admin", icon: <LayoutDashboard size={18}/> },
    { name: "Check-in", href: "/admin/check-in", icon: <UserCheck size={18}/> },
    { name: "Booking", href: "/admin/booking", icon: <Calendar size={18}/> },
    { 
      name: "Reports", 
      icon: <ChartLine size={18}/>,
      subItems: [
        { name: "Staff Earning", href: "/admin/reports/staff-earnings" },
        { name: "Salon Earning", href: "/admin/reports/salon-earning" },
        { name: "Profit Dashboard", href: "/admin/reports/profit" },
        { name: "Expense", href: "/admin/reports/expenses" },
      ]
    },
    { name: "Gift Cards", href: "/admin/gift-cards", icon: <Gift size={18}/> },
    { name: "Royalty", href: "/admin/royalty", icon: <Crown size={18}/> },
    { name: "Membership", href: "/admin/membership", icon: <CreditCard size={18}/> },
    { name: "Inventory", href: "/admin/inventory", icon: <Boxes size={18}/> },
    { name: "Service", href: "/admin/services", icon: <Bell size={18}/> },
    { name: "Clients", href: "/admin/clients", icon: <Users size={18}/> },
    { name: "User", href: "/admin/users", icon: <UserCircle size={18}/> },
    { 
      name: "State Board Exam", 
      icon: <Book size={18}/>,
      subItems: [
        { name: "Theory Examination", href: "/admin/theory-manager" },
        { name: "Group Fun Test", href: "/admin/theory-manager/group-test" },
        { name: "Access Codes", href: "/admin/access-codes" },
      ]
    },
    { name: "Setting", href: "/admin/settings", icon: <Settings size={18}/> },
  ];

  return (
    <>
      <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0  transition-colors duration-300">
        
        {/* LEFT: Logo + More Icon (Admin Mobile Only) */}
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <MoreVertical size={24} />
            </button>
          )}
          
          <Link href="/admin" className="md:hidden flex flex-col no-underline">
            <span className="logo-style text-xl font-black uppercase tracking-tighter text-[#db2777] leading-none">
              Nails Express
            </span>
            <span className="text-[8px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              Management System
            </span>
          </Link>
        </div>

        {/* RIGHT: Theme Toggle + Notifications */}
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={toggleTheme} 
            className="p-2.5 text-slate-600 dark:text-yellow-400 hover:scale-110 active:scale-95 transition-all"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {/* NotificationCenter is back! */}
          <NotificationCenter />
        </div>
      </header>

      {/* ADMIN FULL MENU OVERLAY */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          
          {/* Drawer Content */}
          <div className="absolute left-0 top-0 bottom-0 w-4/5 max-w-xs bg-white dark:bg-slate-950 p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-300">
            <div className="flex justify-between items-center mb-8">
              <span className="text-[10px] font-black uppercase tracking-widest text-pink-600">Admin Control</span>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-400"><X size={24} /></button>
            </div>

            <nav className="space-y-1 pb-10">
              {adminLinks.map((link) => (
                <div key={link.name}>
                  {link.subItems ? (
                    <>
                      <button 
                        onClick={() => setOpenSub(openSub === link.name ? null : link.name)}
                        className="w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                      >
                        <div className="flex items-center gap-3">{link.icon} {link.name}</div>
                        {openSub === link.name ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                      </button>
                      {openSub === link.name && (
                        <div className="ml-9 mt-1 space-y-1 border-l-2 border-pink-100 dark:border-pink-900/30">
                          {link.subItems.map(sub => (
                            <Link 
                              key={sub.name} href={sub.href} onClick={() => setIsMenuOpen(false)}
                              className="block p-2 pl-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 hover:text-pink-600 transition-colors"
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link 
                      href={link.href} onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-xl font-bold text-xs transition-all ${
                        pathname === link.href 
                          ? "bg-pink-600 text-white shadow-lg shadow-pink-200 dark:shadow-none" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      {link.icon} {link.name}
                    </Link>
                  )}
                </div>
              ))}

              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 p-3 mt-6 rounded-xl font-bold text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                <LogOut size={18}/> Logout
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}