"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { loadStripe } from '@stripe/stripe-js';
import { 
  getDoc, getDocs, doc,
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  Timestamp, 
  orderBy, setDoc,
  where 
} from "firebase/firestore";
import { useToast } from "@/context/ToastContext"; // Your new context
// FIXED: Combined auth and db into one line
import { auth, db } from "@/lib/firebase"; 
import { Loader2 } from "lucide-react";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  setPersistence, 
  browserLocalPersistence,
  onAuthStateChanged // ADD THIS
} from "firebase/auth";
import { useRouter } from "next/navigation";


const promotions = [
  { id: 1, category: "Special", title: "New Client Gel", description: "First time visit special for full set gel.", price: "45" },
  { id: 2, category: "Spa", title: "Luxury Pedi", description: "Organic scrub and extended massage.", price: "60" }
];

export default function HomePage() {
  const { showToast } = useToast();
  const router = useRouter();
const [stripePublicKey, setStripePublicKey] = useState("");
  // Add these for Tracking
const [trackCode, setTrackCode] = useState("");
const [trackResult, setTrackResult] = useState(null);
const [trackLoading, setTrackLoading] = useState(false);
const [trackError, setTrackError] = useState("");
const [isFlipped, setIsFlipped] = useState(false);
  // --- ADD THESE STATES HERE ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  // -----------------------------
const [step, setStep] = useState(1);
const [staff, setStaff] = useState([]); // To store technicians
const [showPolicy, setShowPolicy] = useState(false); // Modal state
const [showAnnouncement, setShowAnnouncement] = useState(false);
  const openModal = () => setIsLoginModalOpen(true);
  const closeModal = () => setIsLoginModalOpen(false);
// Add this inside your HomePage function
const [users, setUsers] = useState([]);
  // --- NEW EFFECT TO FETCH STORE INFO ---
const [storeSettings, setStoreSettings] = useState(null);
const [blockedDates, setBlockedDates] = useState([]);
const [isCheckingAuth, setIsCheckingAuth] = useState(true)

useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store_info"));
        if (snap.exists()) {
          setStripePublicKey(snap.data().stripePublicKey);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    fetchSettings();
  }, []);

  
const handleStripeCheckout = async () => {
  // --- 1. VALIDATION ---
  // Ensure giftAmount is treated as a number
  const numericAmount = parseFloat(giftAmount);

  if (!numericAmount || numericAmount <= 0) {
    showToast("Please enter a valid amount", "error");
    return;
  }

  if (!giftData.toName || !giftData.fromName) {
    showToast("Please fill in the To and From names", "error");
    return;
  }

  setLoading(true);
  try {
  // --- GENERATE 6-DIGIT NUMERIC CODE ---
    // Generates a random number between 100000 and 999999
    const cardCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Create the card in "Pending Payment" status
    const newGiftCard = {
      code: cardCode, // Now "123456" instead of "GC-123456" or "ABC123"
      recipientName: giftData.toName || "Customer",
      senderName: giftData.fromName || "Anonymous",
      recipientEmail: giftData.toEmail || "",
      message: giftData.message || "",
      amount: Number(giftAmount),
      balance: Number(giftAmount),
      status: "pending_payment", 
      isActivated: false,
      isRead: false,
      createdAt: serverTimestamp(),
      origin: "online"
    };
    // Save to Firebase
    const docRef = await addDoc(collection(db, "gift_cards"), newGiftCard);

    // --- 3. CALL STRIPE API ---
    const response = await fetch("/api/checkout_sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: numericAmount,
        giftCardId: docRef.id,
        recipientName: giftData.toName,
        senderName: giftData.fromName
      }),
    });

    const session = await response.json();

    if (session.url) {
      // Redirect to Stripe
      window.location.href = session.url;
    } else {
      throw new Error(session.error || "Failed to create checkout session");
    }

  } catch (err) {
    console.error("Checkout Error:", err);
    showToast("Payment system is currently unavailable. Please try again.", "error");
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  // Check if the URL has ?payment=success
  const queryParams = new URLSearchParams(window.location.search);
  if (queryParams.get("payment") === "success") {
    showToast("Payment Successful! Your Gift Card is now active.", "success");
    
    // Optional: Clear the URL so the toast doesn't show again on refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);



useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User IS logged in. Let's find their role to route them correctly.
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const role = userDoc.data().role || 'client';
            
            // Redirect based on role
            if (role === "admin") router.replace("/admin");
            else if (role === "staff") router.replace("/staff/dashboard");
            else router.replace("/client/dashboard");
            
            // NOTE: We intentionally DO NOT set isCheckingAuth to false here.
            // We want the loading screen to stay visible while Next.js changes the page!
          } else {
            // Failsafe: User auth exists, but no database profile
            setIsCheckingAuth(false);
          }
        } catch (error) {
          console.error("Auth check error:", error);
          setIsCheckingAuth(false);
        }
      } else {
        // No user is logged in. Safe to show the landing page.
        setIsCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

useEffect(() => {
  // We fetch from 'settings' collection, 'store' document
  const unsub = onSnapshot(doc(db, "settings", "store"), (docSnap) => {
    if (docSnap.exists()) {
      setStoreSettings(docSnap.data());
    }
  });
  return () => unsub();
}, []);
// Add this useEffect to fetch staff from Firestore
useEffect(() => {
  const q = query(collection(db, "users")); // Ensure 'db' is imported
  const unsub = onSnapshot(q, (snap) => {
    const userData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setUsers(userData);
  });
  return () => unsub();
}, []);

useEffect(() => {
  // 1. Fetch Operating Hours
  const fetchSettings = async () => {
    const docSnap = await getDoc(doc(db, "settings", "store_info"));
    if (docSnap.exists()) setStoreSettings(docSnap.data());
  };
  
  // 2. Fetch Holiday/Closure Dates
  const unsubClosures = onSnapshot(collection(db, "closures"), (snap) => {
    setBlockedDates(snap.docs.map(doc => doc.data().date));
  });

  fetchSettings();
  return () => unsubClosures();
}, []);
const validateClientBooking = (selectedDateTime) => {
  if (!storeSettings) return true;

  const dateObj = new Date(selectedDateTime);
  const dateString = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const selectedTime = dateObj.getHours().toString().padStart(2, '0') + ":" + 
                       dateObj.getMinutes().toString().padStart(2, '0');

  // --- 1. Check Holiday/Closure Dates ---
  if (blockedDates.includes(dateString)) {
    const holidayMsg = storeSettings.closureMessage || "The salon is closed on this date.";
    showToast(`DATE UNAVAILABLE: ${holidayMsg}`, "error");
    return false;
  }

  // --- 2. Check Operating Hours ---
  const daySettings = storeSettings.hours[dayName];
  if (!daySettings || daySettings.isClosed) {
    showToast(`CLOSED: We are closed on ${dayName}s. Please pick another day.`, "error");
    return false;
  }

  // --- 3. Check Time Window ---
  if (selectedTime < daySettings.open || selectedTime > daySettings.close) {
    showToast(
      `OUTSIDE HOURS: ${dayName} hours are ${daySettings.open} - ${daySettings.close}.`, 
      "error"
    );
    return false;
  }

  return true;
};
// Fetch Technicians (Users with role 'technician' or 'staff')
useEffect(() => {
  const q = query(collection(db, "users"), where("role", "==", "technician"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsubscribe();
}, []);


// Inside your HomePage Component:
const [categories, setCategories] = useState([]);
const [services, setServices] = useState([]); // To store all salon services
const [serviceSearch, setServiceSearch] = useState(""); // The text user types
const [showDropdown, setShowDropdown] = useState(false); // To toggle results

// Add these inside your HomePage function
const [giftAmount, setGiftAmount] = useState(0);
const [giftData, setGiftData] = useState({ toName: '', toEmail: '', fromName: '', message: '' });

const handleGiftPurchase = async () => {
  try {
    const randomNum = Math.floor(Math.random() * 999999) + 1;
    const digitCode = randomNum.toString().padStart(6, '0');
    const cardCode = `GC-${digitCode}`;
    const amountNum = Number(giftAmount);
    const localDateString = new Date().toLocaleDateString('en-CA');

const newGiftCard = {
      code: cardCode,
      recipientName: giftData.toName || "Customer",
      senderName: giftData.fromName || "Anonymous",
      recipientEmail: giftData.toEmail,
      customerEmail: giftData.toEmail, 
      type: "Online",             
      isOnline: true,             
      origin: "online",           
      date: localDateString,
      amount: amountNum, 
      balance: amountNum,
      status: "pending", 
      isActivated: false, 
      isRead: false, // <--- ADD THIS LINE so NotificationCenter can find it
      message: giftData.message || "",
      createdAt: serverTimestamp(),
      purchaseDate: serverTimestamp(), // <--- ADD THIS so the notification has a time
      lastUsed: serverTimestamp(),
      history: [{
        date: Timestamp.fromDate(new Date()), 
        type: 'Purchase Request',
        amount: amountNum,
        oldBalance: 0,
        newBalance: amountNum,
        note: 'Online Order - Waiting for Payment'
      }]
    };

    // 1. Save the Gift Card to the database
    await addDoc(collection(db, "gift_cards"), newGiftCard);

    // 2. NEW: Send Notification to Admin Dashboard
    await addDoc(collection(db, "notifications"), {
      type: "gift_card",
      message: `New Online Gift Card: ${newGiftCard.recipientName} ($${amountNum})`,
      read: false,
      color: "bg-blue-500", // Blue color for gift cards
      icon: "fa-gift",      // Gift icon for the dropdown
      timestamp: serverTimestamp()
    });

  showToast(`Order Submitted! Code: ${cardCode}. Please complete payment to activate.`, "success");
    
    // Reset Form
    setStep(1);
    setGiftAmount(0);
    setGiftData({ toName: '', toEmail: '', fromName: '', message: '' });

  } catch (error) {
    showToast("Failed to submit order. Please check your connection.", "error");
  }
};


// SINGLE SOURCE OF TRUTH FOR SERVICES
useEffect(() => {
  const qServ = query(collection(db, "services"));
  const unsubServ = onSnapshot(qServ, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    //console.log("Services loaded:", data.length); // Debug check
    setServices(data);
  }, (err) => console.error("Service Fetch Error:", err.message));

  return () => unsubServ();
}, []);

// --- 1. STATE FOR REVIEWS ---
const [reviews, setReviews] = useState([]);

// --- 2. FETCH REVIEWS FROM FIREBASE ---
useEffect(() => {
  // 1. Connect to 'finished_clients'
  // We remove the 'limit' temporarily to make sure we find YOUR test data
  const q = query(collection(db, "finished_clients"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const rawData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

   // console.log("RAW DATA FROM DB:", rawData); // Check this in console!

    // 2. Filter: Keep ANY entry that has a rating OR a review comment
    // We check multiple spelling variations found in your old app code
    const validReviews = rawData.filter(item => {
       const hasRating = (item.rating && Number(item.rating) > 0) || (item.stars && Number(item.stars) > 0);
       const hasText = (item.review && item.review.length > 1) || (item.feedback && item.feedback.length > 1) || (item.comment && item.comment.length > 1);
       
       return hasRating || hasText;
    });

    // 3. Sort by Date (Newest First)
    // We use 'checkOutTimestamp' which is what your script.js uses
    validReviews.sort((a, b) => {
      const dateA = a.checkOutTimestamp?.seconds || 0;
      const dateB = b.checkOutTimestamp?.seconds || 0;
      return dateB - dateA;
    });

    //console.log("FINAL FILTERED REVIEWS:", validReviews);
    setReviews(validReviews);
  }, (error) => {
    console.error("Error fetching reviews:", error);
  });

  return () => unsubscribe();
}, []);

const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    // 1. Fetch Global Security Settings (from settings/store)
    const settingsSnap = await getDoc(doc(db, "settings", "store"));
    const security = settingsSnap.data()?.bookingConfigs || { maxLoginAttempts: 3, lockoutDuration: 120 };

    // 2. Look up the user by email BEFORE auth to check if they are locked out
    const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    let userDocId = null;
    let currentFailedAttempts = 0;

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      userDocId = userDoc.id;
      currentFailedAttempts = userData.failedAttempts || 0;

      // 3. Check Lockout Status
      if (userData.lockoutUntil && userData.lockoutUntil.toDate() > new Date()) {
        const remainingMin = Math.ceil((userData.lockoutUntil.toDate() - new Date()) / 60000);
        showToast(`Account locked. Try again in ${remainingMin} mins.`, "error");
        setLoading(false);
        return; // Stop login process completely
      }
    }

    // 4. Set persistence
    await setPersistence(auth, browserLocalPersistence);

    // 5. Attempt Sign in
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (authError) {
      // IF PASSWORD FAILS: Increment attempts and trigger lockout if necessary
      if (userDocId) {
        const userRef = doc(db, "users", userDocId);
        const newAttempts = currentFailedAttempts + 1;
        
        if (newAttempts >= security.maxLoginAttempts) {
          const lockoutTime = new Date(Date.now() + security.lockoutDuration * 60000);
          await setDoc(userRef, { 
            failedAttempts: newAttempts, 
            lockoutUntil: Timestamp.fromDate(lockoutTime) 
          }, { merge: true });
          showToast(`Too many attempts. Locked for ${security.lockoutDuration} mins.`, "error");
        } else {
          await setDoc(userRef, { failedAttempts: newAttempts }, { merge: true });
          showToast(`Invalid password. ${security.maxLoginAttempts - newAttempts} attempts left.`, "error");
        }
      } else {
        showToast("Invalid credentials. Please try again.", "error");
      }
      setLoading(false);
      return; // Stop execution on failure
    }

    // 6. IF LOGIN SUCCESS: Get user data and redirect (Your original logic)
    const user = userCredential.user;
    const finalUserRef = doc(db, "users", user.uid);
    const finalUserSnap = await getDoc(finalUserRef);
    
    if (finalUserSnap.exists()) {
      const finalUserData = finalUserSnap.data();
      const role = finalUserData?.role || 'client';

      // Reset failed attempts to 0 on successful login
      await setDoc(finalUserRef, { failedAttempts: 0, lockoutUntil: null }, { merge: true });

      showToast(`Welcome back, ${finalUserData.name || 'User'}!`, "success");

      // Redirect with a slight delay to ensure Toast shows and Router triggers
      setTimeout(() => {
        if (role === "admin") {
          router.replace("/admin");
        } else if (role === "staff" || role === "technician") {
          router.replace("/staff/dashboard");
        } else {
          router.replace("/client/dashboard");
        }
      }, 500); 

    } else {
      showToast("User profile not found.", "error");
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast("An unexpected error occurred. Please try again.", "error");
  } finally {
    setLoading(false);
  }
};
// Add this if it is missing or replace your old booking state
// Helper to get the current date and time formatted for the input
const getCurrentDateTimeLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const [bookingData, setBookingData] = useState({
  name: "",
  phone: "",
  serviceId: "",
  serviceName: "",
  price: 0,
  groupSize: 1,
  staffId: "anyone",
  staffName: "Any Technician",
  dateTime: getCurrentDateTimeLocal(), // Combined date and time
  note: "" // New Note field
});

const filteredServices = services.filter(s => 
  s.name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
  s.category?.toLowerCase().includes(serviceSearch.toLowerCase())
);
// --- HELPER FUNCTION: VALIDATE OPERATING HOURS ---
  const isWithinOperatingHours = (selectedDateTimeStr) => {
    if (!storeHours || !selectedDateTimeStr) return true; // Default to allow if not loaded

    const dateObj = new Date(selectedDateTimeStr);
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = daysOfWeek[dateObj.getDay()];
    
    const todayHours = storeHours[dayName];

    // 1. Check if the salon is closed that day
    if (!todayHours || todayHours.isClosed) {
      showToast(`Sorry, we are closed on ${dayName}s.`, "error");
      return false;
    }

    // 2. Extract just the time from the datetime-local input (format: "HH:mm")
    // dateTime string looks like "YYYY-MM-DDTHH:mm"
    const timeParts = selectedDateTimeStr.split('T');
    if (timeParts.length < 2) return true; 
    const selectedTime = timeParts[1]; 

    // 3. Compare selected time with open and close times
    if (selectedTime < todayHours.open || selectedTime > todayHours.close) {
      // Convert 24h to 12h for the error message
      const format12h = (time24) => {
        const [h, m] = time24.split(':');
        const hNum = parseInt(h);
        const ampm = hNum >= 12 ? 'PM' : 'AM';
        const h12 = hNum % 12 || 12;
        return `${h12}:${m} ${ampm}`;
      };

      showToast(`Please book between ${format12h(todayHours.open)} and ${format12h(todayHours.close)} on ${dayName}s.`, "error");
      return false;
    }

    return true; // Valid time
  };

const handleBookingSubmit = async () => {
  try {
    // 1. DATA VALIDATION
    if (!bookingData.name || !bookingData.phone || !bookingData.serviceName || !bookingData.dateTime) {
      showToast("Please fill in all fields", "error");
      return;
    }

    const appointmentDate = new Date(bookingData.dateTime);
    const now = new Date();

    // 2. MINIMUM NOTICE CHECK
    const noticeHours = storeSettings?.bookingConfigs?.minBookingNotice || 12;
    const earliestAllowed = new Date(now.getTime() + (noticeHours * 60 * 60 * 1000));

    if (appointmentDate < earliestAllowed) {
      showToast(`Appointments must be booked at least ${noticeHours} hours in advance.`, "error");
      return;
    }

    // 3. TECHNICIAN SCHEDULE CHECK (The Blocker)
    // IMPORTANT: We check if staffId is a real ID and not "anyone"
    const selectedStaff = users.find(u => u.id === bookingData.staffId);
    
    console.log("Checking Schedule for:", selectedStaff?.name);

    if (selectedStaff && bookingData.staffId !== "anyone") {
      const dayName = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const schedule = selectedStaff.schedule?.[dayName];

      // If no schedule exists or active is false
      if (!schedule || !schedule.active) {
        showToast(`${selectedStaff.name} is not working on ${dayName}.`, "error");
        return;
      }

      // Convert times to total minutes for 100% accuracy
      const apptTotalMins = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
      const [openH, openM] = schedule.open.split(':').map(Number);
      const [closeH, closeM] = schedule.close.split(':').map(Number);
      
      const openTotalMins = openH * 60 + openM;
      const closeTotalMins = closeH * 60 + closeM;

      console.log(`Appt Mins: ${apptTotalMins} | Range: ${openTotalMins}-${closeTotalMins}`);

      if (apptTotalMins < openTotalMins || apptTotalMins >= closeTotalMins) {
        showToast(
          `${selectedStaff.name} is only available between ${schedule.open} and ${schedule.close} on ${dayName}.`, 
          "error"
        );
        return; // STOPS THE BOOKING
      }
    }
// --- NEW: CLIENT ACCOUNT AUTO-CREATION & LOGIN ---
    // Strip spaces/dashes from phone to make it a clean username/password
    const cleanPhone = bookingData.phone.replace(/\D/g, ''); 
    if (cleanPhone.length < 6) {
        showToast("Phone number must be at least 6 digits.", "error");
        return;
    }

    const clientEmail = `${cleanPhone}@nailsexpressky.com`;
    const clientPassword = cleanPhone; // Phone number as default password
    let currentClientId = "guest";

    try {
        // Attempt 1: Try to log in existing client
        const userCred = await signInWithEmailAndPassword(auth, clientEmail, clientPassword);
        currentClientId = userCred.user.uid;
    } catch (error) {
        // Attempt 2: If they don't exist, create an account automatically
        try {
            const newCred = await createUserWithEmailAndPassword(auth, clientEmail, clientPassword);
            currentClientId = newCred.user.uid;

            // Save their profile to a 'clients' collection in Firestore
            await setDoc(doc(db, "clients", currentClientId), {
                name: bookingData.name,
                phone: bookingData.phone,
                cleanPhone: cleanPhone,
                createdAt: serverTimestamp()
            });
        } catch (createErr) {
            console.error("Client Creation Error:", createErr);
        }
    }

    // 4. FINAL SAVE
    await addDoc(collection(db, "appointments"), {
      name: bookingData.name,
      phone: bookingData.phone,
      service: bookingData.serviceName,
      price: Number(bookingData.price || 0),
      technicianId: bookingData.staffId,
      technician: bookingData.staffName || "Any Technician",
      appointmentTimestamp: Timestamp.fromDate(appointmentDate),
      note: bookingData.note || "",
      bookingType: "Online",
      status: "confirmed",
      clientId: currentClientId, // LINK APPOINTMENT TO THE CLIENT
      createdAt: serverTimestamp(),
      isRead: false
    });

    showToast("Booking Confirmed! Taking you to your dashboard...", "success");
    
    // REDIRECT TO DASHBOARD
    setTimeout(() => {
        router.push("/client/dashboard");
    }, 1500);

  } catch (err) {
    console.error("Critical Booking Error:", err);
    showToast("Error processing booking. Please try again.", "error");
  }
};

// ADD THIS NEW EFFECT BLOCK:
  useEffect(() => {
    // Listen for existing login sessions when the app opens
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // If a user is found, check their role in Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            // Redirect based on role
            if (role === "admin") {
              router.push("/admin");
            } else {
              router.push("/staff/dashboard");
            }
          }
        } catch (error) {
          console.error("Error checking user role:", error);
        }
      }
      // If no user is found, it just stays on the Landing Page
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

const handleTrackGiftCard = async (e) => {
  e.preventDefault();
  if (!trackCode) return;
  
  setTrackLoading(true);
  setTrackError("");
  setTrackResult(null);

  try {
    const input = trackCode.trim();
    
    // Matches your working code: checks raw, uppercase, and GC- prefix
    const q = query(
      collection(db, "gift_cards"), 
      where("code", "in", [input, input.toUpperCase(), `GC-${input}`, `GC-${input.toUpperCase()}`])
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      setTrackError("Gift card not found. Please check the number.");
    } else {
      const docData = querySnapshot.docs[0].data();
      setTrackResult({
        id: querySnapshot.docs[0].id,
        ...docData,
        customerName: docData.recipientName || "Valued Client",
        expiryDate: docData.expirationDate?.toDate ? docData.expirationDate.toDate().toLocaleDateString() : (docData.expirationDate || "No Expiry")
      });
    }
  } catch (err) {
    console.error("Tracking Error:", err);
    setTrackError("Error connecting to database.");
  } finally {
    setTrackLoading(false);
  }
};

const generateSlots = (selectedDate) => {
  const now = new Date();
  const noticeHours = bookingConfigs?.minBookingNotice || 12; // From Admin Settings
  const earliestAllowed = new Date(now.getTime() + (noticeHours * 60 * 60 * 1000));

  // When filtering your time slots:
  const availableSlots = allDaySlots.filter(slot => {
    const slotTime = new Date(`${selectedDate} ${slot}`);
    return slotTime > earliestAllowed; 
  });
  
  return availableSlots;
};
// From your uploaded page.jsx
const [bookingConfigs, setBookingConfigs] = useState({
  minBookingNotice: 12,
  defaultServiceDuration: 60,
  // ...
});

const handleBookAppointment = async (startTime) => {
  const duration = bookingConfigs?.defaultServiceDuration || 60; // From Admin
  const endTime = calculateEndTime(startTime, duration);

  await addDoc(collection(db, "appointments"), {
    customerName: name,
    start: startTime,
    end: endTime, // This blocks the technician for the full duration
    status: "confirmed",
    createdAt: serverTimestamp()
  });
};

// Add state for client login
const [clientLoginPhone, setClientLoginPhone] = useState("");

// Add this function inside HomePage
const handleClientLogin = async (e) => {
    e.preventDefault();
    const cleanPhone = clientLoginPhone.replace(/\D/g, '');
    const clientEmail = `${cleanPhone}@nailsexpressky.com`;

    try {
        await signInWithEmailAndPassword(auth, clientEmail, cleanPhone);
        showToast("Welcome back!", "success");
        router.push("/client/dashboard");
        // close modal
    } catch (err) {
        showToast("Account not found. Please check your phone number.", "error");
    }
};

// Update your existing useEffect that fetches storeSettings:
useEffect(() => {
  const fetchSettings = async () => {
    // CHANGE THIS PATH TO MATCH YOUR SAVE FUNCTION
    const snap = await getDoc(doc(db, "settings", "store_info")); 
    
    if (snap.exists()) {
      const data = snap.data();
      setStoreSettings(data);
      
      // Detailed check for the announcement
      if (data.announcement?.enabled === true) {
        const hasSeen = sessionStorage.getItem("announcement_shown");
        if (!hasSeen) {
          setShowAnnouncement(true);
        }
      }
    }
  };
  fetchSettings();
}, []);

// Add this helper function to your HomePage
const isWithinWorkingHours = (slotTime, techSchedule) => {
  const dateObj = new Date(slotTime);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const schedule = techSchedule?.[dayName];

  // 1. If no schedule exists or staff is inactive/off, block the booking
  if (!schedule || !schedule.active) return false;

  // 2. Convert slot time to total minutes from midnight (e.g., 09:30 = 570 mins)
  const slotTotalMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();

  // 3. Convert open/close strings ("09:00") to total minutes
  const [openH, openM] = schedule.open.split(':').map(Number);
  const [closeH, closeM] = schedule.close.split(':').map(Number);
  
  const openTotalMinutes = openH * 60 + openM;
  const closeTotalMinutes = closeH * 60 + closeM;

  // 4. Return true only if the slot is between open and close times
  return slotTotalMinutes >= openTotalMinutes && slotTotalMinutes < closeTotalMinutes;
};

const handleSlotSelection = (selectedDate, selectedTech) => {
  const allPossibleSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]; // Example slots
  
  const validSlots = allPossibleSlots.filter(slot => {
    const slotDateTime = new Date(`${selectedDate} ${slot}`);
    return isWithinWorkingHours(slotDateTime, selectedTech.schedule);
  });

  if (validSlots.length === 0) {
    showToast("Technician unavailable for these hours. Please pick another time or staff.", "error");
    return;
  }
  
  setAvailableSlots(validSlots);
};
// 3. The Loading Gate
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900">
        <Loader2 className="animate-spin text-pink-600 mb-4" size={40} />
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
          Opening Salon...
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
{/* 1. ELEGANT NAVIGATION */}
<nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-pink-100 px-6 py-4">
  <div className="max-w-7xl mx-auto flex justify-between items-center">
    <div className="text-2xl font-serif font-bold text-pink-600 tracking-tighter">
      Nails Express <p className="text-xs text-gray-500 -mt-1">Nails salon &amp; Spa</p>
    </div>
    
    <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
      <Link href="#" className="hover:text-pink-600 transition-colors">Home</Link>
      <Link href="#book" className="hover:text-pink-600 transition-colors">Booking</Link>
      <Link href="#gift-cards" className="hover:text-pink-600 transition-colors">Gift Cards</Link>
    </div>

    <button onClick={openModal} className="text-gray-500 hover:text-pink-500 transition-colors font-bold text-sm">
      <i className="fas fa-user mr-2"></i> Login
    </button>
  </div>
</nav>

{/* 2. REFINED HERO SECTION */}
<section className="relative h-[50vh] flex items-center px-6 overflow-hidden">
  {/* Background remains full width */}
  <div className="absolute inset-0 z-0">
    <Image 
      src="https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80"
      alt="Luxury Manicure Art"
      fill
      priority
      className="object-cover object-center scale-105 brightness-[0.9]"
    />
    <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-transparent"></div>
  </div>
  
  {/* Content is constrained to the container */}
  <div className="relative z-10 max-w-7xl mx-auto w-full">
    <div className="max-w-xl">
      <span className="text-pink-600 font-bold tracking-[0.2em] uppercase text-xs mb-3 block">
        Welcome to Nails Express
      </span>
      <h1 className="text-4xl md:text-6xl font-serif text-gray-900 mb-6 leading-tight">
        Elevate Your <br/>
        <span className="italic text-pink-500">Natural Beauty</span>
      </h1>
      <p className="text-base md:text-lg text-gray-700 mb-8 leading-relaxed max-w-md">
        Experience the finest nail artistry and spa treatments in a serene, sophisticated environment.
      </p>
      
      <div className="flex flex-wrap gap-4 items-center">
        <Link href="#book" className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg">
          Book Now
        </Link>

        {/* Social Icons Container */}
        <div className="flex gap-3">
          <a href="https://facebook.com/..." target="_blank" className="bg-white/50 backdrop-blur-sm text-blue-600 border border-gray-200 p-3 rounded-xl hover:bg-white transition-all">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
           {/* YouTube */}

  <a href="https://youtube.com/@NailExpressKY" target="_blank"

     className="bg-white/50 backdrop-blur-sm text-red-600 border border-gray-200 p-3 rounded-xl hover:bg-white transition-all">

    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>

  </a>

 

  {/* TikTok */}

  <a href="https://www.tiktok.com/@nailsexpressky" target="_blank"

     className="bg-white/50 backdrop-blur-sm text-black border border-gray-200 p-3 rounded-xl hover:bg-white transition-all">

    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>

  </a>
        </div>
      </div>
    </div>
  </div>
</section>

{/* --- GIFT CARD SECTION --- */}
<section id="gift-cards" className="py-10 bg-pink-50">
  <div className="max-w-6xl mx-auto px-6">
<div className="bg-white rounded-xl overflow-hidden shadow-xl border border-indigo-100 flex flex-col md:flex-row items-center">
  
  {/* Left Block: Visual Side (The 3D Card) */}
  <div className="w-full md:w-1/2 p-8 md:p-12 bg-gray-50/50 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-indigo-50">
    <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-bottom-4 duration-300">
      
      {/* --- PREMIUM 3D GIFT CARD --- */}
      <div 
        className="group perspective-1000 w-full h-[240px] cursor-pointer" 
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* FRONT OF CARD - LUXURY SIGNATURE STYLE */}
          <div className="absolute inset-0 backface-hidden bg-slate-900 rounded-xl shadow-2xl overflow-hidden p-0 border border-slate-800">
            {/* Modern Rose-Gold Geometric Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -ml-16 -mb-16"></div>

            {/* Top Section: Brand & Amount */}
            <div className="p-6 flex justify-between items-start relative z-10">
              <div>
                 <h3 className="font-parisienne text-3xl font-black text-pink-500 leading-tight">Gift Card</h3>
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">Nails Express</p>
              </div>
              <div className="text-right">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Balance</p>
                <p className="text-3xl font-black text-white tracking-tighter">$100.00</p>
              </div>
            </div>

            {/* Middle Section: Recipient & Sender */}
            <div className="px-6 mt-2 relative z-10 flex gap-8">
              <div>
                <p className="text-[7px] font-black text-pink-500/60 uppercase tracking-widest mb-1">To</p>
                <p className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[100px]">Valued Guest</p>
              </div>
              <div>
                <p className="text-[7px] font-black text-pink-500/60 uppercase tracking-widest mb-1">From</p>
                <p className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[100px]">Nails Express</p>
              </div>
            </div>

            {/* Bottom Section: Card Number & Expiry */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/40 to-transparent relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Card Number</p>
                  <p className="text-sm font-mono text-white tracking-[0.2em]">000000</p>
                </div>
                <div className="text-right">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Expires</p>
                  <p className="text-[10px] font-bold text-white">01/01/2026</p>
                </div>
              </div>
            </div>
          </div>

          {/* BACK OF CARD */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-xl border border-gray-100 shadow-xl flex flex-col p-8 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-10 bg-black"></div>
            <div className="mt-8 text-center flex-1 flex flex-col justify-center">
               <p className="text-[10px] leading-relaxed text-gray-500 font-medium px-4 mb-4">
          This card is redeemable for services at Nails Express. Treat this card like cash, it is not replaceable if lost or stolen. This card is non-refundable and cannot be exchanged for cash.
        </p>
              <div className="h-[1px] w-full bg-gray-100 my-4"></div>
              <h4 className="text-sm font-black text-pink-600 uppercase">Nails Express</h4>
              <p className="text-[9px] text-gray-400 font-bold uppercase">(859) 236-2873</p>
            </div>
          </div>

        </div>
      </div>
      <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">
        Click card to flip <i className="fas fa-sync ml-1"></i>
      </p>
    </div>
  </div>

  {/* Right Block: Content Side */}
  <div className="w-full md:w-1/2 p-12">
    <h2 className="text-3xl md:text-3xl font-black text-gray-900 mb-6 leading-tight">
      Give the Gift of <span className="text-pink-600 italic  capitalize">Glamour</span>
    </h2>
    <p className="text-gray-600 text-lg leading-relaxed mb-8">
      Treat your loved ones to a relaxing experience with a 
      <span className="font-bold text-pink-600"> Nails Express digital gift card</span>. 
      Perfect for birthdays, holidays, or just because!
    </p>
    
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <button 
        onClick={() => setStep('giftcard')}
        className="w-full sm:w-auto bg-gray-900 text-white px-3 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-pink-600 hover:scale-105 transition-all shadow-lg"
      >
        Buy a Gift Card
      </button>

      <button 
        onClick={() => setStep('track-giftcard')}
        className="w-full sm:w-auto border-2 border-pink-600 text-pink-600 px-3 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-pink-50 transition-all active:scale-95"
      >
        Track My Card
      </button>
    </div>
  </div>
  
</div>
  </div>
</section>

{/* GIFT CARD MODAL */}
{step === 'giftcard' && (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-100">
      <div className="bg-[#d63384] p-6 text-center">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Purchase Gift Card</h2>
        <p className="text-pink-100 text-[10px] font-bold uppercase tracking-widest mt-1">Order Online • Pay to Activate</p>
      </div>

      <div className="p-6 space-y-5">
     <div>
  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Select Amount</label>
  <div className="grid grid-cols-5 gap-2">
    {[25, 50, 100, 200].map((amt) => (
      <button key={amt} onClick={() => setGiftAmount(amt)}
        className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${
          giftAmount === amt ? 'border-[#d63384] bg-pink-50 text-[#d63384]' : 'border-gray-50 bg-gray-50 text-gray-400'
        }`}>${amt}</button>
    ))}
    {/* CUSTOM BUTTON */}
    <button 
      onClick={() => setGiftAmount('custom')}
      className={`py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${
        giftAmount === 'custom' || (![25, 50, 100, 200].includes(giftAmount) && giftAmount > 0)
          ? 'border-[#d63384] bg-pink-50 text-[#d63384]' 
          : 'border-gray-50 bg-gray-50 text-gray-400'
      }`}>Custom</button>
  </div>

  {/* CUSTOM INPUT FIELD - Shows up if Custom is selected */}
  {(giftAmount === 'custom' || (![25, 50, 100, 200].includes(giftAmount) && giftAmount > 0)) && (
    <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
      <input 
        type="number"
        placeholder="Enter custom amount ($)"
        onChange={(e) => setGiftAmount(Number(e.target.value))}
        className="w-full p-4 bg-pink-50 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-[#d63384] font-bold text-[#d63384]"
      />
    </div>
  )}
</div>
<InputItem 
  label="Your Name (Sender)" 
  value={giftData.fromName} 
  onChange={(val) => setGiftData({ ...giftData, fromName: val })} 
  placeholder="e.g. John Doe" 
/>
        <InputItem label="Recipient Name" placeholder="e.g. Jane Doe" value={giftData.toName} onChange={(val) => setGiftData({...giftData, toName: val})} />
        <InputItem label="Recipient Email" placeholder="john.doe@example.com" value={giftData.toEmail} onChange={(val) => setGiftData({...giftData, toEmail: val})} />

        {/* --- ADDED PAYMENT GUIDE BLOCK 
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl space-y-2">
          <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest">How to Pay</h4>
          <p className="text-[11px] text-blue-700 leading-tight font-medium">
            1. Submit this order to generate your code.<br/>
            2. Please send payment to our Venmo <br/>
            <span className="font-black text-blue-900 underline">@nailsexpress or Call us (859) 236-2873</span><br/>
            3. Your card will be activated once payment is confirmed.
          </p>
        </div>
--- */}
       {/* Checkout Action Area */}
<button 
  onClick={handleStripeCheckout}
  disabled={loading || !stripePublicKey}
  className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
    loading || !stripePublicKey 
      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg active:scale-95'
  }`}
>
  {loading ? (
    <div className="flex items-center justify-center gap-2">
      <Loader2 className="animate-spin w-5 h-5" />
      <span>Processing...</span>
    </div>
  ) : (
    <span>Pay with Card / Apple Pay</span>
  )}
</button>
      </div>
    </div>
  </div>
)}


{/* --- GIFT CARD TRACKING MODAL --- */}
{step === 'track-giftcard' && (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
      
      {/* Header */}
      <div className="bg-pink-700 p-6 text-center relative">
        <button onClick={() => { setStep(1); setTrackResult(null); setTrackError(""); }} 
                className="absolute right-4 top-4 text-slate-400 hover:text-white">✕</button>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Track Gift Card</h2>
        <p className="text-white text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Nails Express Registry</p>
      </div>

      <div className="p-6 overflow-y-auto">
        {/* Search Form */}
        {!trackResult && (
          <form onSubmit={handleTrackGiftCard} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Enter Card Code</label>
              <input 
                type="text"
                placeholder="XXXXXX"
                className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-center font-black text-lg text-slate-700 outline-none focus:ring-2 focus:ring-pink-500 transition-all uppercase"
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={trackLoading || !trackCode}
              className="w-full py-4 bg-pink-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-pink-700 transition-all disabled:opacity-50"
            >
              {trackLoading ? "Searching..." : "Check Status"}
            </button>
            {trackError && <p className="text-[10px] font-bold text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 uppercase">{trackError}</p>}
          </form>
        )}
{trackResult && (
  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
    {/* Top Balance Card */}
{/* --- PREMIUM 3D GIFT CARD --- */}
<div className="group perspective-1000 w-full h-[240px] mb-8 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
  <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
    
   {/* FRONT OF CARD - LUXURY SIGNATURE STYLE */}
<div className="absolute inset-0 backface-hidden bg-slate-900 rounded-xl shadow-2xl overflow-hidden p-0 border border-slate-800">
  
  {/* Modern Rose-Gold Geometric Accent */}
  <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
  <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -ml-16 -mb-16"></div>

  {/* Top Section: Brand & Amount */}
  <div className="p-6 flex justify-between items-start relative z-10">
    <div>
      <h3 className="font-parisienne text-3xl font-black text-pink-500 leading-tight">Gift Card</h3>
      <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">Nails Express</p>
    </div>
    <div className="text-right">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Balance</p>
      <p className="text-4xl font-black text-white tracking-tighter">
        ${Number(trackResult.balance).toFixed(2)}
      </p>
    </div>
  </div>

  {/* Middle Section: Recipient & Sender */}
  <div className="px-6 mt-2 relative z-10 flex gap-8">
    <div>
      <p className="text-[7px] font-black text-pink-500/60 uppercase tracking-widest mb-1">To</p>
      <p className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[120px]">
        {trackResult.recipientName || 'Valued Guest'}
      </p>
    </div>
    <div>
      <p className="text-[7px] font-black text-pink-500/60 uppercase tracking-widest mb-1">From</p>
      <p className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[120px]">
        {trackResult.senderName || 'Nails Express'}
      </p>
    </div>
  </div>

  {/* Bottom Section: Card Number & Expiry */}
  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/40 to-transparent relative z-10">
    <div className="flex justify-between items-end">
      <div>
        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Card Number</p>
        <p className="text-sm font-mono text-white tracking-[0.2em]">
          {trackResult.code || 'XXXXXX'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Expires</p>
        <p className="text-[10px] font-bold text-white uppercase">
          {trackResult.expiryDate}
        </p>
      </div>
    </div>
  </div>

  {/* Status Overlay */}
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
     <i className="fas fa-crown text-[120px] text-white"></i>
  </div>
</div>

    {/* BACK OF CARD (Inspired by b.png) */}
    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-xl border border-gray-100 shadow-xl flex flex-col p-8 overflow-hidden">
      {/* Black Magnetic Strip Header */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-black"></div>
      
      <div className="mt-8 text-center flex-1 flex flex-col justify-center">
        <p className="text-[10px] leading-relaxed text-gray-500 font-medium px-4 mb-4">
          This card is redeemable for services at Nails Express. Treat this card like cash, it is not replaceable if lost or stolen. This card is non-refundable and cannot be exchanged for cash.
        </p>
        
        <div className="h-[1px] w-full bg-gray-100 mb-4"></div>
        
        <h4 className="text-sm font-black text-pink-600 uppercase mb-1">Nails Express</h4>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
          1560 Hustonville Rd #345, Danville, KY 40422
        </p>
        <p className="text-[10px] text-gray-400 font-black mt-1">(859) 236-2873</p>
      </div>

      <div className="flex justify-between mt-4 pt-4 border-t border-gray-50">
        <div className="text-left">
          <p className="text-[8px] font-black text-gray-300 uppercase">Holder</p>
          <p className="text-[10px] font-bold text-gray-600">{trackResult.customerName}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-black text-gray-300 uppercase">Expires</p>
          <p className="text-[10px] font-bold text-gray-600">{trackResult.expiryDate}</p>
        </div>
      </div>
    </div>

  </div>
</div>

    {/* Transaction History Section */}
    <div className="mt-6">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">
        Detailed History
      </h3>
      
      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {trackResult.history && trackResult.history.length > 0 ? (
          [...trackResult.history].reverse().map((log, index) => (
            <div key={index} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      log.type === 'Redeem' || log.type === 'spend' ? 'bg-pink-100 text-pink-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400">
                      {log.date?.toDate ? log.date.toDate().toLocaleDateString() : (log.date || 'Recent')}
                    </span>
                  </div>
                  <p className="text-xs font-black text-gray-800 uppercase mt-1">
                    {log.service || (log.type === 'Redeem' || log.type === 'spend' ? 'General Service' : 'Funds Added')}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className={`text-sm font-black ${log.type === 'Redeem' || log.type === 'spend' ? 'text-pink-600' : 'text-green-600'}`}>
                    {(log.type === 'Redeem' || log.type === 'spend') ? '-' : '+'}${Number(Math.abs((log.oldBalance || 0) - (log.newBalance || 0))).toFixed(2)}
                  </p>
                </div>
              </div>

              {log.note && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg border-l-2 border-gray-200">
                  <p className="text-[10px] text-gray-500 italic leading-relaxed line-clamp-2">
                    "{log.note}"
                  </p>
                </div>
              )}

              <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center">
                <span className="text-[8px] font-bold text-gray-300 uppercase">Balance After</span>
                <span className="text-[10px] font-black text-gray-400">${Number(log.newBalance).toFixed(2)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-[10px] font-bold text-gray-400 uppercase">No records found</p>
          </div>
        )}
      </div>
    </div>

    {/* Modal Footer Buttons */}
    <div className="flex flex-col gap-2 pt-2">
        <button 
          onClick={() => { setTrackResult(null); setTrackCode(""); }}
          className="w-full py-4 bg-pink-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all"
        >
          Check Another Card
        </button>
        <button 
          onClick={() => setStep(1)}
          className="w-full py-2 text-slate-400 text-[9px] font-bold uppercase tracking-widest hover:text-pink-600 transition-colors"
        >
          Back to Home
        </button>
    </div>
  </div>
)}

      </div>
    </div>
  </div>
)}
{/* BOOKING SECTION */}


<div id="book" className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 max-w-4xl mt-10 mb-20 mx-auto">
  <div className="text-center mb-10">
  <h2 className="text-3xl font-bold text-[#d63384] mb-2 font-serif tracking-tight">Book a New Appointment</h2>
              <p className="text-gray-500 italic">Your moment of relaxation is just a few clicks away.</p>
              </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
    
    {/* LEFT COLUMN: WHO & WHAT */}
    <div className="space-y-8">
      <section>
        <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">1</span>
          Your Information
        </h4>
       {/* CHANGE grid-cols-1 TO grid-cols-2 */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <InputItem 
      label="" 
      value={bookingData.name} 
      onChange={v => setBookingData({...bookingData, name: v})} 
      placeholder="Enter your name" 
    />
   <InputItem 
  label="Phone Number" 
  value={bookingData.phone} 
  onChange={v => setBookingData({...bookingData, phone: v})} 
  placeholder="(859) 123-4567" 
  minLength={10}   // Prevents submitting if less than 10
  maxLength={14}   // Prevents typing more than a formatted number
  type="tel"       // Opens the numeric keypad on mobile/tablet
/>
    
  </div>
      </section>

{/* ROW 2: SERVICE AND GROUP SIZE */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  
  {/* SELECT SERVICE (Autocomplete) */}
  <section className="relative">
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">2</span>
      Select Service
    </h4>
    <div className="relative">
      <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
      <input 
        type="text"
        placeholder="Type any service..."
        className="w-full p-4 pl-12 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm"
        value={serviceSearch}
        onChange={(e) => { 
            const val = e.target.value;
            setServiceSearch(val);
            setShowDropdown(true);
            setBookingData(prev => ({ ...prev, serviceName: val, serviceId: "custom", price: 0 }));
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />
      {/* ... keep your dropdown code here ... */}
    </div>
  </section>

  {/* GROUP SIZE DROPDOWN */}
  <section>
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">3</span>
      Group Size
    </h4>
    <select 
      value={bookingData.groupSize}
      onChange={(e) => setBookingData({...bookingData, groupSize: Number(e.target.value)})}
      className="w-full text-gray-400 p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm uppercase h-[54px]"
    >
      {[1, 2, 3, 4, 5, 6].map(num => (
        <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'People'}</option>
      ))}
    </select>
  </section>

</div>
    </div>

    {/* RIGHT COLUMN: WHEN & WHO */}
 <div className="   space-y-8">
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
  
  {/* PREFERRED STAFF */}
  <section>
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">4</span>
      Preferred Staff
    </h4>
    <select 
      className="w-full text-gray-400  p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm uppercase h-[54px]"
      value={bookingData.staffId}
      onChange={(e) => {
        const s = staff.find(x => x.id === e.target.value);
        setBookingData({...bookingData, staffId: e.target.value, staffName: s ? s.name : "Any Technician"});
      }}
    >
      <option value="anyone">Any Technician</option>
      {staff.map(member => (
        <option key={member.id} value={member.id}>{member.name}</option>
      ))}
    </select>
  </section>

{/* APPOINTMENT DATE & TIME */}
  <section>
    <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">5</span>
      Appointment Date & Time
    </h4>
    <input 
      type="datetime-local" 
      className="w-full text-gray-400 p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm h-[54px]"
      value={bookingData.dateTime}
      onChange={(e) => setBookingData({...bookingData, dateTime: e.target.value})}
    />
  </section>
</div>
<section className="mt-4">
  <h4 className="text-xs font-black text-pink-500 uppercase mb-4 flex items-center gap-2">
    <span className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px]">6</span>
    Note for Staff (Optional)
  </h4>
  <textarea 
    placeholder="Any special requests "
    value={bookingData.note}
    onChange={(e) => setBookingData({...bookingData, note: e.target.value})}
    className="w-full text-gray-700 p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm min-h-[50px] resize-y"
  />
</section>
</div>

  </div>
  {/* 2. PLACE THE BUTTON HERE (OUTSIDE THE GRID) */}
  <div className="mt-12 flex justify-center">
<button 
      disabled={!bookingData.name || !bookingData.phone || !bookingData.serviceName || !bookingData.dateTime}
      onClick={handleBookingSubmit}
      className="w-full md:w-2/3 py-6 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-pink-600 disabled:bg-gray-100 disabled:text-gray-300 transition-all shadow-lg shadow-gray-200"
    >
      Confirm Appointment
    </button>
  </div>
</div>



{showPolicy && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white rounded-xl max-w-lg w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200">
      <h2 className="text-2xl font-bold mb-4 text-[#d63384]">Salon Policy</h2>
      <div className="text-gray-600 space-y-4 text-sm leading-relaxed overflow-y-auto max-h-[60vh]">
        <p>1. Please arrive 5 minutes before your appointment.</p>
        <p>2. Cancellations must be made 24 hours in advance.</p>
        <p>3. We reserve the right to refuse service to anyone.</p>
      </div>
      <button 
        onClick={() => setShowPolicy(false)}
        className="w-full mt-8 bg-gray-900 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs"
      >
        Close & Accept
      </button>
    </div>
  </div>
)}
{/* WHAT OUR CLIENTS SAY SECTION */}
<section className="py-20 bg-white overflow-hidden">
  <div className="max-w-6xl mx-auto px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
        What Our Clients Say
      </h2>
      <p className="text-gray-500 font-medium">Real stories from our recent visits</p>
    </div>
  </div>

  {/* Marquee Wrapper */}
  <div className="relative w-full max-w-7xl mx-auto">
    
    {/* Gradient Fades for Left and Right Edges */}
    <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
    <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

    {reviews.length > 0 ? (
      /* Scrolling Track */
      <div className="flex animate-marquee gap-8 w-max px-4">
        {/* We duplicate the sliced array to create the infinite seamless loop */}
        {[...reviews.slice(0, 6), ...reviews.slice(0, 6)].map((client, index) => (
          
          /* The Card (Forced to a fixed width so it doesn't squish) */
          <div 
            key={`${client.id || 'review'}-${index}`} 
            className="w-[320px] md:w-[380px] shrink-0 bg-gray-50 p-8 rounded-xl border border-gray-100 hover:shadow-xl transition-all cursor-pointer"
          >
            {/* Star Rating */}
            <div className="flex text-yellow-400 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className={`h-4 w-4 fill-current ${i < (client.rating || 5) ? 'text-yellow-400' : 'text-gray-200'}`} viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>

            <p className="text-gray-700 leading-relaxed mb-6 italic text-sm whitespace-normal">
              "{client.review || "Great service and friendly staff!"}"
            </p>

            <div className="flex items-center">
              <div className="h-10 w-10 shrink-0 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold mr-3 uppercase">
                {(client.name || "G").substring(0, 1)}
              </div>
              <div className="truncate">
                <p className="font-black text-gray-900 text-sm truncate">{client.name || "Valued Customer"}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  {client.checkOutTimestamp ? new Date(client.checkOutTimestamp.seconds * 1000).toLocaleDateString() : "Verified Visit"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-10 text-gray-400 italic font-bold">
        Waiting for new feedback...
      </div>
    )}
  </div>
</section>


{/* --- BRAND SANCTUARY SECTION --- */}
<section className="py-20 bg-gray-50">
  <div className="max-w-4xl mx-auto px-6 text-center">
    {/* Decorative element */}
    <div className="flex justify-center mb-6">
      <div className="h-1 w-12 bg-indigo-600 rounded-full"></div>
    </div>
    
    <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-6 tracking-tight">
      Your Sanctuary for Beauty & Relaxation
    </h2>
    
    <div className="space-y-6">
      <p className="text-lg text-gray-600 leading-relaxed">
        Welcome to <span className="font-bold text-indigo-600">Nail Express</span>, 
        your personal retreat for beauty and wellness in Danville. Our passionate team 
        is dedicated to providing exceptional service in a clean, serene, and friendly environment.
      </p>
      
      <p className="text-lg text-gray-600 leading-relaxed">
        From classic manicures to luxurious spa pedicures, we use only high-quality 
        products to ensure lasting results. Treat yourself to our signature pedicure 
        experience that will leave you walking on air.
      </p>
    </div>

    {/* Optional: Add a small button or link to your booking page here */}
    <div className="mt-10">
      <button 
        onClick={() => router.push('/bookings')} 
        className="text-sm font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-600 pb-1 hover:text-indigo-800 hover:border-indigo-800 transition-all"
      >
        Book Your Experience
      </button>
    </div>
  </div>
</section>
{/* STAFF LOGIN MODAL */}
{isLoginModalOpen && (
  <div 
    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    onClick={closeModal} // Closes modal if you click the dark background
  >
    {/* Glassmorphism Modal Card */}
    <div 
      className="w-full max-w-sm backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 p-8 rounded-xl shadow-2xl border border-white/20 relative animate-in fade-in zoom-in duration-200"
      onClick={(e) => e.stopPropagation()} // Prevents closing when clicking inside the box
    >
      <button 
        onClick={closeModal} 
        className="absolute top-4 right-4 text-slate-400 hover:text-pink-600 transition-colors p-2"
      >
        ✕
      </button>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-pink-600 uppercase tracking-tighter leading-none">
         Welcome Back !
        </h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">
          Login to Salon System
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <p className="text-[10px] font-bold text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 uppercase tracking-tight">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            Email Address
          </label>
          <input 
            type="email" 
            required
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 transition-all text-sm"
            placeholder="admin@nailsexpress.com"
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            Password
          </label>
          <input 
            type="password" 
            required
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 transition-all text-sm"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-pink-600 text-white font-black py-4 rounded-xl hover:bg-pink-700 shadow-xl shadow-pink-500/20 uppercase tracking-widest text-xs mt-4 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Authenticating...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <p className="text-center text-slate-400 text-[9px] font-bold uppercase mt-8 tracking-[0.15em]">
        Secure Access and Monitoring for Authorized
      </p>
    </div>
  </div>
)}

      {/* 6. FOOTER */}
     {/* 6. DYNAMIC FOOTER */}
<footer className="bg-gray-900 text-white py-16 px-6">
  <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
    
    {/* Name & Description */}
    <div>
      <h3 className="text-2xl font-serif mb-6 text-pink-400">
        {storeSettings?.name || "Nails Express"}
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed">
        {storeSettings?.description || "Your neighborhood luxury nail sanctuary. Providing high-quality nail care services."}
      </p>
    </div>

    {/* Hours */}
<div>
  <h4 className="font-bold uppercase tracking-widest mb-6 text-white dark:text-white">
    Hours
  </h4>
  <ul className="text-slate-500 dark:text-slate-400 text-[11px] space-y-3 font-medium">
    {/* Monday - Saturday Grouping */}
    <li className="flex flex-col">
      <span className="text-[9px] uppercase opacity-60">Mon - Sat</span>
      <span>
        {storeSettings?.hours?.['Monday']?.open ?? "9:00 AM"} - {storeSettings?.hours?.['Monday']?.close ?? "7:00 PM"}
      </span>
    </li>
    
    {/* Sunday Display (with Closed check) */}
    <li className="flex flex-col">
      <span className="text-[9px] uppercase opacity-60">Sunday</span>
      <span className={storeSettings?.hours?.['Sunday']?.closed ? "text-red-500 font-bold" : ""}>
        {storeSettings?.hours?.['Sunday']?.closed 
          ? "CLOSED" 
          : `${storeSettings?.hours?.['Sunday']?.open ?? "11:00 AM"} - ${storeSettings?.hours?.['Sunday']?.close ?? "5:00 PM"}`
        }
      </span>
    </li>
  </ul>
</div>

    {/* Location/Link */}
<div>
  <h4 className="font-bold uppercase tracking-widest  mb-6 text-white dark:text-white">
    Location
  </h4>
  <div className="text-slate-500 dark:text-slate-400 text-[11px] space-y-3 font-medium">
    {/* Display the Address from Firebase */}
    <p className="leading-relaxed">
      {storeSettings?.address || "1560 Hustonville Rd #345, Danville, KY"}
    </p>

    {/* Display the Phone from Firebase */}
    <p className="text-pink-500 font-bold">
      {storeSettings?.phone || "859-123-4567"}
    </p>

    {/* Salon Website Link */}
    <p className="pt-2">
      <Link 
        href={storeSettings?.website || "http://nailsexpressky.com"} 
        className="text-pink-400 hover:underline flex items-center gap-1"
      >
        <span className="text-[9px]">🌐</span>
        {storeSettings?.website?.replace('http://', '').replace('https://', '') || "nailsexpressky.com"}
      </Link>
    </p>
  </div>
</div>
  </div>
</footer>
{showAnnouncement && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
      <div className="bg-pink-500 p-6 text-white text-center">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📢</span>
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight">
          {storeSettings?.announcement?.title || "Announcement"}
        </h2>
      </div>
      
      <div className="p-8 text-center">
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
          {storeSettings?.announcement?.text}
        </p>
        
        <button 
          onClick={() => {
            setShowAnnouncement(false);
            sessionStorage.setItem("announcement_shown", "true");
          }}
          className="w-full py-4 bg-slate-900 dark:bg-pink-600 text-white rounded-2xl font-black uppercase text-sm hover:scale-[1.02] transition-transform"
        >
          Got it, thanks!
        </button>
      </div>
    </div>
  </div>
)}

    </main>
  );
}


// Ensure your InputItem looks like this in page.js
function InputItem({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        value={value || ""} // This ensures it becomes empty when state is reset
        onChange={e => onChange(e.target.value)} 
        className="w-full p-4 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white outline-none transition-all focus:ring-2 focus:ring-pink-100 shadow-sm" 
        placeholder={placeholder} 
      />
    </div>
  );
}
