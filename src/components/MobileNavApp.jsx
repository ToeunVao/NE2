"use client";
import { useAuth } from "@/context/AuthContext"; // Assuming you have auth context
import StaffMobileNav from "./StaffMobileNav";
import AdminMobileNav from "./AdminMobileNav";
import ClientMobileNav from "./ClientMobileNav";

export default function MobileNavApp() {
  const { user, role, loading } = useAuth();

  if (loading || !user) return null;

  // 1. ADMIN ROLE
  if (role === "admin") {
    return <AdminMobileNav />;
  }

  // 2. STAFF or TECHNICIAN ROLE
  if (role === "staff" || role === "technician") {
    return <StaffMobileNav />;
  }

  // 3. CLIENT ROLE (Registered from landing page)
  return <ClientMobileNav />;
}