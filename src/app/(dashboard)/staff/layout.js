"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/context/ToastContext"; // 1. Add this import
import { Loader2 } from "lucide-react";
export default function StaffLayout({ children }) {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
const { showToast } = useToast();
// Inside src/app/(dashboard)/staff/layout.js

const handleStartPractice = () => {
  sessionStorage.setItem("theory_auth", "true");
  sessionStorage.setItem("access_mode", "staff");
  router.push("/theory-test/live");
};
useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          router.push("/clients/login");
          return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists()) {
          showToast("User profile not found", "error");
          router.push("/");
          return;
        }

        const role = userDoc.data()?.role?.toLowerCase();
        // ALLOW LIST: admin, staff, and technician
        const allowedRoles = ["admin", "staff", "technician"];

        if (allowedRoles.includes(role)) {
          setAuthorized(true);
        } else {
          // If the user is a client, send them to the client dashboard
          //showToast("Access Denied: Staff Only Area", "error");
          router.push("/client/dashboard");
        }
      } catch (error) {
        console.error("Auth Error:", error);
        showToast("Authentication Error", "error");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, showToast]);

  // Show a clean loading spinner while checking authorization
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-pink-600" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
           Opening Salon...
          </p>
        </div>
      </div>
    );
  }

  // Only render children if authorized
  return authorized ? <>{children}</> : null;
}