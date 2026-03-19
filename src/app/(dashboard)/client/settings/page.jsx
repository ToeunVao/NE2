"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db, storage } from "@/lib/firebase"; 
import { 
  updateProfile, 
  updateEmail, 
  updatePassword, 
  onAuthStateChanged 
} from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/context/ToastContext";

export default function ClientSettings() {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingSecurity, setIsSubmittingSecurity] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
    photoURL: "",
  });
  
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      setUser(currentUser);
      
      // 1. Get the Firestore Document
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.exists() ? userDoc.data() : {};

      // 2. THE NAME FALLBACK LOGIC
      // We check: Auth Name -> Firestore Name -> Firestore Username -> Empty
      const existingName = currentUser.displayName || userData.displayName || userData.username || "";

      // 3. THE PHONE/EMAIL CLEANER (From our last step)
      let detectedPhone = userData.phone || "";
      let displayEmail = currentUser.email || "";

      if (!detectedPhone && displayEmail.includes("@nailsexpressky.com")) {
        detectedPhone = displayEmail.split('@')[0];
        displayEmail = ""; 
      }

      // 4. Update the form state
      setFormData({
        displayName: existingName,
        email: displayEmail,
        photoURL: currentUser.photoURL || userData.photoURL || "",
        phone: detectedPhone,
      });
    }
    setLoading(false);
  });
  return () => unsub();
}, []);
  // --- IMAGE UPLOAD LOGIC ---
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return showToast("Image must be less than 2MB", "error");
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Auth Profile
      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      
      // Update Firestore (using setDoc with merge in case the user doc doesn't exist yet)
      await setDoc(doc(db, "users", user.uid), { photoURL: downloadURL }, { merge: true });

      setFormData(prev => ({ ...prev, photoURL: downloadURL }));
      showToast("Profile picture updated!", "success");
    } catch (err) {
      console.error(err);
      showToast("Error uploading image.", "error");
    } finally {
      setUploading(false);
    }
  };

  // --- UPDATE PROFILE LOGIC (Name, Email, Phone) ---
const handleUpdateProfile = async (e) => {
  e.preventDefault();
  setIsSubmittingProfile(true);
  
  try {
    // 1. ALWAYS Update Auth Display Name (so it reflects in Sidebar/Navbar)
    if (formData.displayName !== auth.currentUser.displayName) {
      await updateProfile(auth.currentUser, { 
        displayName: formData.displayName 
      });
    }

    // 2. Update Auth Email ONLY if it's new and not a "fake" system email
    if (formData.email && 
        formData.email !== auth.currentUser.email && 
        !formData.email.includes("@nailsexpressky.com")) {
      await updateEmail(auth.currentUser, formData.email);
    }

    // 3. Sync everything to Firestore (Name, Phone, Email, Username)
    // We use setDoc with { merge: true } to handle "Phone-only" signups gracefully
    await setDoc(doc(db, "users", user.uid), {
      displayName: formData.displayName,
      username: formData.displayName, // Syncing both for your booking lookups
      email: formData.email, 
      phone: formData.phone,
      updatedAt: new Date().toISOString() // Good practice for tracking changes
    }, { merge: true });

    showToast("Profile updated successfully!", "success");
  } catch (err) {
    console.error("Update Error:", err);
    
    // Specific error handling for Firebase "Recent Login" requirement
    if (err.code === 'client/login') {
      showToast("Security: Please log out and back in to change your email.", "error");
    } else {
      showToast("Update failed. Please check your connection.", "error");
    }
  } finally {
    setIsSubmittingProfile(false);
  }
};

  // --- UPDATE PASSWORD LOGIC ---
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return showToast("Passwords do not match", "error");
    }
    if (passwords.newPassword.length < 6) {
      return showToast("Password must be at least 6 characters", "error");
    }

    setIsSubmittingSecurity(true);
    try {
      await updatePassword(auth.currentUser, passwords.newPassword);
      showToast("Password updated successfully!", "success");
      setPasswords({ newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      if (err.message.includes("requires-recent-login")) {
        showToast("Please log out and log back in to change your password.", "error");
      } else {
        showToast("Error updating password.", "error");
      }
    } finally {
      setIsSubmittingSecurity(false);
    }
  };

 // if (loading) return <div className="p-20 text-center font-black text-pink-500 uppercase tracking-widest animate-pulse">Loading Settings...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      
      {/* HEADER & AVATAR SECTION */}
      <div className="flex flex-col items-center mb-12">
        <div className="relative inline-block group mb-4">
          <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-100 relative">
            {formData.photoURL ? (
              <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <i className="fas fa-user text-5xl"></i>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <i className="fas fa-spinner animate-spin text-white"></i>
              </div>
            )}
          </div>
          <button 
            onClick={() => fileInputRef.current.click()}
            className="absolute bottom-0 right-0 bg-pink-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform"
            title="Upload Profile Picture"
          >
            <i className="fas fa-camera text-sm"></i>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            className="hidden" 
            accept="image/*" 
          />
        </div>
        <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-tight">{formData.displayName || "Client"}</h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Manage your account</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* PERSONAL INFORMATION FORM */}
        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm h-fit">
          <h2 className="text-xs font-black uppercase tracking-widest text-pink-600 mb-6 flex items-center gap-2">
            <i className="fas fa-address-card"></i> Personal Information
          </h2>
          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
              <input 
                type="text" 
                value={formData.displayName} 
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Email Address</label>
              <input 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
              />
            </div>
            <div>
  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">
    Phone Number
  </label>
  <input 
    type="tel" 
    // This MUST match the state variable exactly
    value={formData.phone} 
    onChange={(e) => setFormData({...formData, phone: e.target.value})}
    placeholder="(000) 000-0000"
    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 font-bold text-gray-700"
  />
</div>
            <button 
              disabled={isSubmittingProfile || uploading}
              className="w-full py-4 bg-gray-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-pink-600 transition-all shadow-lg disabled:opacity-50 mt-2"
            >
              {isSubmittingProfile ? "Saving..." : "Save Profile Details"}
            </button>
          </form>
        </div>

        {/* SECURITY & PASSWORD FORM */}
        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm h-fit">
          <h2 className="text-xs font-black uppercase tracking-widest text-pink-600 mb-6 flex items-center gap-2">
            <i className="fas fa-lock"></i> Security
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">New Password</label>
              <input 
                type="password" 
                value={passwords.newPassword} 
                onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                placeholder="Leave blank to keep current"
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Confirm New Password</label>
              <input 
                type="password" 
                value={passwords.confirmPassword} 
                onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                placeholder="Confirm your new password"
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold"
              />
            </div>
            <button 
              disabled={isSubmittingSecurity || !passwords.newPassword}
              className="w-full py-4 bg-pink-50 text-pink-600 border border-pink-100 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-pink-600 hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:hover:bg-pink-50 disabled:hover:text-pink-600 mt-2"
            >
              {isSubmittingSecurity ? "Updating..." : "Update Password"}
            </button>
          </form>

          <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-xl">
            <p className="text-[11px] text-yellow-700 leading-relaxed font-medium">
              <i className="fas fa-exclamation-triangle mr-1"></i>
              <strong>Note:</strong> For your security, if you haven't logged in recently, Firebase may require you to log out and log back in before allowing you to change your email or password.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}