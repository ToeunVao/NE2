import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase"; // Your firebase config
import { onAuthStateChanged } from "firebase/auth";

export function useStaffAuth() {
  const [staffId, setStaffId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Here, the staffId is the unique UID from Firebase Auth
        setStaffId(user.uid);
      } else {
        setStaffId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { staffId, loading };
}