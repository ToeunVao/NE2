import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where, 
  onSnapshot 
} from "firebase/firestore";

// 1. Fetch Promotions (Optimized for the Landing Page)
export const getPromotions = async () => {
  const q = query(collection(db, "promotions"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 2. Fetch Services (The Price List)
export const getServices = async () => {
  const q = query(collection(db, "services"), orderBy("category", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 3. Real-time Appointments (For the Admin Dashboard)
export const subscribeToAppointments = (callback) => {
  const q = query(collection(db, "appointments"), orderBy("appointmentTimestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};