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
    <>
      {children}
      {/* Only show the Nav if we have a staff ID */}
      {currentStaffId && <StaffMobileNav currentStaffId={currentStaffId} />}
    </>
  );
}