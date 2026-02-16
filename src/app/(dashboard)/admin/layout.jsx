"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function AdminLayout({ children }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        // Fetch user role from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData?.role === "admin") {
          setIsAuthorized(true);
        } else {
          // If NOT admin, kick them out to their own dashboard
          router.replace("/staff/dashboard");
        }
      } catch (error) {
        console.error("Auth Error:", error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  // Only render the admin pages if isAuthorized is true
  return isAuthorized ? <>{children}</> : null;
}