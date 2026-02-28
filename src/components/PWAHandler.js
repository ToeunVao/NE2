"use client";
import { useEffect } from "react";

export default function PWAHandler() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("PWA Service Worker Active"))
          .catch((err) => console.log("PWA SW Registration failed", err));
      });
    }
  }, []);
  return null;
}