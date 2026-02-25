"use client";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase"; 
import StaffMobileNav from "@/components/StaffMobileNav";

export default function ClientWrapper({ children }) {
  const [currentStaffId, setCurrentStaffId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentStaffId(user.uid);
      } else {
        setCurrentStaffId(null);
      }
    });
    return () => unsubscribe();
  }, []);

return (
  <div className="flex flex-col min-h-screen">
    {/* This container holds your pages */}
    <div className="flex-1 px-4 md:px-0"> 
      {children}
    </div>
    
    {currentStaffId && <StaffMobileNav currentStaffId={currentStaffId} />}
  </div>
);
}