"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

export default function StaffLayout({ children }) {
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

// Inside src/app/(dashboard)/staff/layout.js
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      router.push("/");
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const role = userDoc.data()?.role?.toLowerCase();

    // ALLOW LIST: admin, staff, and technician
    const allowedRoles = ["admin", "staff", "technician"];

    if (userDoc.exists() && allowedRoles.includes(role)) {
      setAuthorized(true);
    } else {
      showToast("Unauthorized Role", "error");
      router.push("/"); 
    }
  });

  return () => unsubscribe();
}, [router]);

  if (!authorized) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
    </div>
  );

  return <>{children}</>;
}