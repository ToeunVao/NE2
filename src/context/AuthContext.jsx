// src/context/AuthContext.jsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setLoading(true);
    if (currentUser) {
      try {
        // Add a small delay/timeout check or just a try-catch
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setRole(userDoc.data().role);
        } else {
          console.warn("User authenticated but no Firestore document found.");
          setRole('client');
        }
        setUser(currentUser);
      } catch (error) {
        console.error("Firestore connection failed:", error);
        // Fallback: stay logged in as client so the app doesn't crash
        setUser(currentUser);
        setRole('client'); 
      }
    } else {
      setUser(null);
      setRole(null);
    }
    setLoading(false);
  });

  return () => unsubscribe();
}, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);