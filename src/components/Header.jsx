"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // Ensure this is corre

import { signOut } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { useTheme } from "@/context/ThemeContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import NotificationCenter from "./NotificationCenter";
import { 
  Menu, // The 3-dash icon
  X, Sun, Moon, ChevronDown, ChevronUp,
  LayoutDashboard, UserCheck, Calendar, ChartLine, 
  Gift, Crown, CreditCard, Boxes, Bell, Users, 
  UserCircle, Book, Settings, LogOut
} from "lucide-react";


export default function Header() {
  const router = useRouter();
  const { role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openSub, setOpenSub] = useState(null);

  // Prevent background scrolling when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);
const handleLogout = async () => {
  try {
    // 1. Tell Firebase to clear the local storage session
    await signOut(auth);
    
    // 2. Clear all local storage manually just in case
    localStorage.clear();
    sessionStorage.clear();

    // 3. Force a full browser reload to the landing page
    // This stops the "still rendering" admin state
    window.location.href = "/"; 
    
  } catch (error) {
    console.error("Logout Error:", error.message);
    // Fallback if everything fails
    window.location.reload();
  }
};
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
      <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-[60] transition-colors duration-300">
        
        {/* LEFT: Logo + 3-Dash Menu Icon */}
       {/* LEFT: Logo + 3-Dash Menu Icon */}
      <div className="flex items-center gap-3">
        {role === "admin" && (
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            aria-label="Open Admin Menu"
          >
            <Menu size={24} strokeWidth={2.5} /> 
          </button>
        )}
        
        {/* LOGO: Shown on Mobile (hidden by default), Hidden on Desktop (md:hidden) */}
        <Link href={role === 'admin' ? "/admin" : "/client/dashboard"} className="flex md:hidden flex-col no-underline">
          <span className="logo-style text-xl font-black uppercase tracking-tighter text-[#db2777] leading-none">
            Nails Express
          </span>
          <span className="text-[8px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
            Salon Management System
          </span>
        </Link>
      </div>

        {/* RIGHT: Theme + Notifications */}
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2.5 text-slate-600 dark:text-yellow-400">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {(role === "admin" || role === "staff" || role === "technician") && (
          <NotificationCenter />
          )}
        </div>
      </header>

      {/* ADMIN FULL MENU OVERLAY (Scrollable, Not Fixed Position Content) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden overflow-hidden">
          {/* Backdrop layer */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)} />
          
          {/* Menu Drawer - Content scrolls naturally here */}
          <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-xs bg-white dark:bg-slate-950 shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-left duration-300">
            
            {/* Sticky Header inside the Menu */}
            <div className="sticky top-0 z-20 bg-white dark:bg-slate-950 p-6 flex justify-between items-center border-b border-slate-50 dark:border-slate-900">
              <span className="text-[10px] font-black uppercase tracking-widest text-pink-600">Admin Control</span>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400">
                <X size={24} />
              </button>
            </div>

            {/* Scrollable List */}
            <nav className="p-4 space-y-1">
              {adminLinks.map((link) => (
               <div key={link.name}>
            {link.subItems ? (
              <div className="mb-1">
                <button 
                  onClick={() => setOpenSub(openSub === link.name ? null : link.name)}
                  className="w-full flex items-center justify-between p-4 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-pink-600/70">{link.icon}</span> 
                    {link.name}
                  </div>
                  {openSub === link.name ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                
                {openSub === link.name && (
                  <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-100 dark:border-slate-800">
                    {link.subItems.map(sub => (
                      <Link 
                        key={sub.name} 
                        href={sub.href} 
                        onClick={() => setIsMenuOpen(false)}
                        className="block p-3 pl-6 text-[11px] font-bold text-slate-500 dark:text-slate-500 hover:text-pink-600 transition-colors"
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link 
                href={link.href} 
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 p-4 rounded-xl font-bold text-xs transition-all ${
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
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-4 mt-8 mb-10 rounded-xl font-bold text-xs text-red-500 bg-red-50/50 dark:bg-red-500/5 transition-all border border-red-100 dark:border-red-900/20"
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