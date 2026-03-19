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
import { Sun, Moon } from "lucide-react"; 

export default function DashboardLayout({ children }) {
  const { ask } = useConfirm();
  const [isCollapsed, setIsCollapsed] = useState(false); 
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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

  // --- NEW: DYNAMIC NAV LINKS BASED ON ROLE ---
  let navLinks = [];

  if (userRole === "admin") {
    navLinks = [
      { name: "Dashboard", href: "/admin", icon: "fa-th-large" },
      { name: "Check-in", href: "/admin/check-in", icon: "fa-user-check" },
      { name: "Booking", href: "/admin/booking", icon: "fa-calendar-alt" },
      { 
        name: "Report", 
        icon: "fa-chart-line",
        isDropdown: true,
        subItems: [
          { name: "Staff Earning", href: "/admin/reports/staff-earnings" },
          { name: "Salon Earning", href: "/admin/reports/salon-earning" },
          { name: "Profit Dashboard", href: "/admin/reports/profit" },
          { name: "Expense", href: "/admin/reports/expenses" },
        ]
      },
      { name: "Gift Cards", href: "/admin/gift-cards", icon: "fas fa-gift group-hover:text-white" },
      { name: "Royalty", href: "/admin/royalty", icon: "fas fa-gift group-hover:text-white" },
      { name: "Membership", href: "/admin/membership", icon: "fas fa-gift group-hover:text-white" },
      { name: "Inventory", href: "/admin/inventory", icon: "fas fa-boxes" },
      { name: "Service", href: "/admin/services", icon: "fas fa-concierge-bell" },
      { name: "Clients", href: "/admin/clients", icon: "fas fa-user-friends" },
      { name: "User", href: "/admin/users", icon: "fa-user" },
      { 
        name: "State Board Exam", 
        icon: "fa-book",
        isDropdown: true,
        subItems: [
          { name: "Theory Examination", href: "/admin/theory-manager", icon: "fa-book" },
          { name: "Group Fun Test", href: "/admin/theory-manager/group-test", icon: "fas fa-user-friends" },
          { name: "Access Codes", href: "/admin/access-codes", icon: "fa-key" },
        ]
      },
      { name: "Setting", href: "/admin/settings", icon: "fa-cog" },
    ];
  } else if (userRole === "technician" || userRole === "staff") {
    navLinks = [
      { name: "Dashboard", href: "/staff/dashboard", icon: "fa-th-large" },
      { name: "Report", href: "/staff/matrix", icon: "fa-chart-line" },
      { name: "Booking", href: "/staff/appointments/book", icon: "fa-calendar-alt" },
      { name: "State Board Portal", href: "/staff/board-exam", icon: "fa-book" },
    ];
  } else  {
    navLinks = [
      { name: "My Dashboard", href: "/client/dashboard", icon: "fa-th-large" },
      { name: "Gift Cards", href: "/client/gift-cards", icon: "fa-gift" }, // Added this
      { name: "My Bookings", href: "/client/bookings", icon: "fa-calendar-plus" },
      // You can add more client links here later (e.g., "My Profile", "Rewards")
    ];
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
      
      {/* --- LEFT SIDEBAR --- */}
      <aside className={`hidden md:block border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 border-r border-gray-100 flex flex-col sticky top-0 h-screen transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-20" : "w-64"
      }`}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-white border border-gray-100 dark:bg-slate-900/80 dark:border-slate-800 rounded-full w-6 h-6 flex items-center justify-center text-[10px] text-pink-600 shadow-sm cursor-pointer hover:bg-pink-50 z-50"
        >
          <i className={`fas ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`}></i>
        </button> 
        
        {/* Logo Section */}
        <div className={`p-6 transition-all duration-300 ${isCollapsed ? "text-center px-2" : "p-8"}`}>
          <Link href={userRole === 'client' ? '/client/dashboard' : '/admin'} className="no-underline group">
            <span className={`logo-style text-pink-700 block transition-all ${isCollapsed ? "text-xl" : "text-2xl"}`}>
              {isCollapsed ? "NE" : "Nails Express"}
            </span>
            {!isCollapsed && (
              <p className="text-[9px] font-bold text-pink-600 uppercase tracking-[4px] mt-1 mb-0 animate-in fade-in duration-500">
                {userRole === 'client' ? 'Client Portal' : 'Management Suite'}
              </p>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-2 mt-4">
          {!loadingRole ? (
            navLinks.map((link) => (
              <div key={link.name}>
                {link.isDropdown ? (
                  <>
                    <button 
                      onClick={() => setReportOpen(!reportOpen)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm border-none bg-transparent cursor-pointer ${
                        pathname.includes('/reports') ? "text-pink-600 bg-pink-50" : "text-gray-400 hover:text-pink-600"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <i className={`fas ${link.icon} text-lg`}></i>
                        {!isCollapsed && <span>{link.name}</span>}
                      </div>
                      {!isCollapsed && <i className={`fas fa-chevron-${reportOpen ? 'up' : 'down'} text-[10px]`}></i>}
                    </button>
                    
                    {/* Sub Menu Items */}
                    {reportOpen && !isCollapsed && (
                      <div className="ml-12 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {link.subItems.map(sub => (
                          <Link 
                            key={sub.name} 
                            href={sub.href}
                            className={`block py-2 text-xs font-bold no-underline transition-colors ${
                              pathname === sub.href ? "text-pink-600" : "text-gray-400 hover:text-pink-600"
                            }`}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link 
                    key={link.name} 
                    href={link.href}
                    title={isCollapsed ? link.name : ""} // Show tooltip on hover when collapsed
                    className={`flex items-center rounded-xl transition-all no-underline font-bold text-sm ${
                      isCollapsed ? "justify-center h-12 w-12 mx-auto" : "px-4 py-3 gap-4"
                    } ${
                      pathname === link.href 
                      ? "bg-pink-600 text-white shadow-lg shadow-pink-100" 
                      : "text-gray-400 hover:bg-gray-50 hover:text-pink-600 "
                    }`}
                  >
                    <i className={`fas ${link.icon} text-lg`}></i>
                    {!isCollapsed && <span className="whitespace-nowrap">{link.name}</span>}
                  </Link>
               )}
              </div>
            ))
          ) : (
             <div className="text-center mt-10 text-xs text-gray-400 font-bold uppercase tracking-widest animate-pulse">
               Loading Menu...
             </div>
          )}
        </nav>

        {/* Footer (Logout) */}
        <div className={`p-4 border-t border-gray-50 space-y-4 dark:border-slate-800 ${isCollapsed ? "items-center" : ""}`}>
          <button 
            onClick={handleLogout}
            className={`flex items-center transition-all border-none cursor-pointer font-bold text-sm text-gray-400 hover:text-red-600 bg-transparent ${
              isCollapsed ? "justify-center w-full py-4" : "gap-3 px-4 py-3 w-full hover:bg-red-50 rounded-xl"
            }`}
          >
            <i className="fas fa-sign-out-alt text-lg"></i>
            {!isCollapsed && <span>Logout</span>}
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