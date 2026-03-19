"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// ADDED db, doc, getDoc, and onAuthStateChanged
import { auth, db } from "@/lib/firebase"; 
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore"; 

import Sidebar from "@/components/Sidebar";
import GlobalBookingModal from "@/components/GlobalBookingModal";
import Header from "@/components/Header";
import { useConfirm } from "@/context/ConfirmContext"; 
import { 
  LayoutDashboard, UserCheck, Calendar, BarChart3, Gift, Award, 
  CreditCard, Package, Sparkles, Users, User, BookOpen, Key, 
  Settings, CalendarCheck, LogOut, Scissors, UserRound, Store, TrendingUp, Receipt, FileText, Users2, KeyRound
} from "lucide-react";

export default function DashboardLayout({ children }) {
  const { ask } = useConfirm();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
// NEW STATE: Track which sub-menus are open
  const [openMenus, setOpenMenus] = useState({});

  const toggleSubMenu = (label) => {
    setOpenMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };
  // --- NEW: STATE FOR ROLE MANAGEMENT ---
  const [userRole, setUserRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // --- NEW: FETCH USER ROLE ON LOAD ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // 1. Check if they are Staff or Admin in the "users" collection
          const staffDoc = await getDoc(doc(db, "users", currentUser.uid));
          
          if (staffDoc.exists()) {
            setUserRole(staffDoc.data().role); // Will be "admin" or "technician"
          } else {
            // 2. If not in "users", they must be a Client
            setUserRole("client");
          }
        } catch (error) {
          console.error("Error fetching role:", error);
          setUserRole("client"); // Fallback for safety
        }
      } else {
        setUserRole(null);
      }
      setLoadingRole(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      ask("Logout?", "Are you sure you want to exit?", async () => {
        await signOut(auth);
        router.push("/"); 
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleStartPractice = () => {
    sessionStorage.setItem("theory_auth", "true");
    sessionStorage.setItem("access_mode", "staff");
    router.push("/theory-test/live");
  };

// --- DYNAMIC NAV LINKS BASED ON ROLE ---
  let menuItems = [];

  if (userRole === "admin") {
    menuItems = [
      { label: "Dash", path: "/admin", icon: LayoutDashboard },
      { label: "Check-in", path: "/admin/check-in", icon: UserCheck },
      { label: "Booking", path: "/admin/booking", icon: Calendar },
      { 
        label: "Reports", 
        icon: BarChart3,
        isDropdown: true,
        subItems: [
  { label: "Staff", path: "/admin/reports/staff-earnings", icon: UserRound },
  { label: "Salon", path: "/admin/reports/salon-earning", icon: Store },
  { label: "Profit", path: "/admin/reports/profit", icon: TrendingUp },
  { label: "Expenses", path: "/admin/reports/expenses", icon: Receipt },
]
      },
      { label: "Gifts", path: "/admin/gift-cards", icon: Gift },
      { label: "Royalty", path: "/admin/royalty", icon: Award },
      { label: "Members", path: "/admin/membership", icon: CreditCard },
      { label: "Stock", path: "/admin/inventory", icon: Package },
      { label: "Services", path: "/admin/services", icon: Sparkles },
      { label: "Clients", path: "/admin/clients", icon: Users },
      { label: "Users", path: "/admin/users", icon: User },
      { 
        label: "Exams", 
        icon: BookOpen,
        isDropdown: true,
        subItems: [
  { label: "Theory Exam", path: "/admin/theory-manager", icon: FileText },
  { label: "Group Test", path: "/admin/theory-manager/group-test", icon: Users2 },
  { label: "Access Codes", path: "/admin/access-codes", icon: KeyRound },
]
      },
      { label: "Setup", path: "/admin/settings", icon: Settings },
    ];
  } else if (userRole === "technician" || userRole === "staff") {
    menuItems = [
      { label: "Dash", path: "/staff/dashboard", icon: LayoutDashboard },
      { label: "Report", path: "/staff/reports", icon: BarChart3 },
      { label: "Booking", path: "/staff/appointments/book", icon: Calendar },
      { label: "PSI", path: "/staff/board-exam", icon: BookOpen },
    ];
  } else {
    // Client view
    menuItems = [
      { label: "Dash", path: "/client/dashboard", icon: LayoutDashboard },
      { label: "Gifts", path: "/client/gift-cards", icon: Gift },
      { label: "Bookings", path: "/client/bookings", icon: CalendarCheck },
    ];
  }
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
      
      {/* --- LEFT SIDEBAR --- */}
<aside className="hidden md:flex w-[85px] flex-col h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-[100]">
        
        {/* LOGO */}
        <div className="py-8 flex flex-col items-center border-b border-slate-50 dark:border-slate-800 mb-4">
          <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-200 mb-1">
            <span className="text-white font-black text-xl tracking-tighter">NE</span>
          </div>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Express</span>
        </div>

        {/* NAVIGATION ITEMS */}
        <div className="flex-1 flex flex-col items-center gap-2 px-2 py-2 overflow-y-auto no-scrollbar">
          {menuItems.map((item, index) => {
            const isSubActive = item.subItems?.some(sub => pathname === sub.path);
            const isActive = pathname === item.path || isSubActive;
            const isOpen = openMenus[item.label];
            const Icon = item.icon;

            // --- DROPDOWN STYLE (ACCORDION / TOGGLE DOWN) ---
            if (item.isDropdown) {
              return (
                <div key={index} className="w-full flex flex-col items-center">
                  <button
                    onClick={() => toggleSubMenu(item.label)}
                    className={`w-full flex flex-col items-center justify-center py-3 rounded-2xl transition-all ${
                      isActive 
                        ? "bg-pink-50 dark:bg-pink-900/20 text-pink-600" 
                        : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[8px] font-bold uppercase tracking-tighter mt-1">
                      {item.label}
                    </span>
                    {/* Visual indicator for toggle */}
                    <div className={`mt-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </button>

                  {/* SUB-ITEM LIST (Show/Hide) */}
                  {isOpen && (
  <div className="w-full border-l border-slate-200 dark:border-slate-600 dark:bg-slate-800 flex flex-col items-center gap-1 mt-1 mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
     {item.subItems.map((sub, idx) => {
      const SubIcon = sub.icon; // Get the icon for the sub-item
      const isSubActive = pathname === sub.path;

      return (
        <Link
          key={idx}
          href={sub.path}
          className={`rounded-lg text-center leading-tight transition-colors ${
            isSubActive
               ? "bg-pink-50 dark:bg-pink-900/20 text-pink-600" 
                : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          {/* Render the Sub Icon - Small size (12-14px) is best for CRM style */}
          {SubIcon && (
            <SubIcon 
              size={16} 
              strokeWidth={isSubActive ? 2.5 : 2} 
              className={isSubActive ? "text-pink-600" : "text-slate-400"} 
            />
          )}
          
         <span className="text-[7px] tracking-tighter mt-1">{sub.label}</span>
        </Link>
      );
    })}
  </div>
)}

                 
                </div>
              );
            }

            // --- STANDARD LINK ---
            return (
              <Link
                key={index}
                href={item.path}
                className={`w-full flex flex-col items-center justify-center py-4 rounded-2xl transition-all group ${
                  isActive 
                    ? "bg-pink-50 dark:bg-pink-900/20 text-pink-600 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="mb-1" />
                <span className="text-[8px] font-bold uppercase tracking-tighter text-center leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* LOGOUT */}
        <div className="p-2 mt-auto border-t border-slate-50 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex flex-col items-center justify-center py-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
          >
            <LogOut size={22} />
            <span className="text-[9px] font-bold uppercase mt-1">Exit</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar for Notifications/User Profile if needed */}
        <Header />

        <div className="min-h-screen px-0 md:px-0 pb-24 md:pb-0 overflow-y-auto">
          {children}
        </div>

      {/* GLOBAL FLOATING BUTTON - ONLY FOR STAFF/ADMIN */}
{(userRole === "admin" || userRole === "staff" || userRole === "technician") && (
  <button 
    onClick={() => setIsModalOpen(true)}
    className="fixed bottom-[28px] left-1/2 -translate-x-1/2 z-[110] w-14 h-14 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all md:bottom-10 md:right-10 md:left-auto md:translate-x-0 bg-[#db2777] md:w-16 md:h-16 border-4 border-white hover:scale-110 z-50 print:hidden"
  >
    <i className="fas fa-plus text-2xl"></i>
  </button>
)}
        {/* GLOBAL BOOKING MODAL */}
        <GlobalBookingModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      </main>
    </div>
  );
}