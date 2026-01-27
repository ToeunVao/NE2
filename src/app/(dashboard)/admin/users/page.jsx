"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, doc, setDoc, 
  deleteDoc, query, orderBy, serverTimestamp 
} from "firebase/firestore";

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  // Initial Form State
const initialForm = {
    name: "",
    phone: "",
    email: "",
    uid: "",
    role: "technician",
    payoutType: "standard",
    commission: "60",
    checkPayout: "70" // Ensure this is a string for the input field
  };

  const [formData, setFormData] = useState(initialForm);

  // --- LISTEN FOR USERS ---
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // --- ACTIONS ---
  const handleAddUpdateUser = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return alert("Name and Email are required");

try {
  const docId = formData.uid || formData.email.toLowerCase();
  
// Locate this section in your handleAddUpdateUser function
const userPayload = {
  ...formData,
  role: formData.role.toLowerCase(),
  email: formData.email.toLowerCase(),
  // FIX: Divide by 100 so 60 becomes 0.6 and 70 becomes 0.7
  commission: parseFloat(formData.commission) || 60,
  checkPayout: parseFloat(formData.checkPayout) || 70,
  updatedAt: serverTimestamp()
};

  await setDoc(doc(db, "users", docId), userPayload, { merge: true });

      // Reset Form
      setFormData(initialForm);
      alert("User saved successfully");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

const handleEdit = (user) => {
  // 1. Determine the correct Payout Type string
  let detectedPayout = user.payoutType || "standard";
  
  // If your old data uses variations like "Comm. + Tips", normalize it here
  if (detectedPayout.toLowerCase().includes("tips")) {
    detectedPayout = "Commission + Tips";
  }

  setFormData({
    name: user.name || "",
    phone: user.phone || "",
    email: user.email || "",
    uid: user.id || "",
    role: user.role?.toLowerCase() || "technician",
    payoutType: detectedPayout, // Matches the new select options
    // 2. Ensure commission is pulled exactly as it is (e.g., 70)
    commission: user.commission > 100 ? user.commission / 100 : (user.commission || "60"),
    checkPayout: user.checkPayout ? user.checkPayout.toString() : "70"
  });
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

  const handleDelete = async (id, name) => {
    if (confirm(`Delete user ${name}?`)) {
      await deleteDoc(doc(db, "users", id));
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-8 space-y-10">
      <h1 className="text-2xl font-black text-gray-800 italic uppercase tracking-tighter">Manage Users</h1>

      {/* --- INPUT FORM SECTION --- */}
      <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
        <form onSubmit={handleAddUpdateUser} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Phone</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">User UID</label>
              <input 
                type="text" 
                placeholder="Paste UID from Firebase Console"
                value={formData.uid}
                onChange={e => setFormData({...formData, uid: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Role</label>
              <select 
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none"
              >
                <option value="technician">Technician</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
            {/* In your JSX Form */}
<label className="text-[10px] font-black text-gray-400 uppercase ml-1">Payout Type</label>
<select 
  value={formData.payoutType}
  onChange={e => setFormData({...formData, payoutType: e.target.value})}
  className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none"
>
  <option value="standard">Standard (Commission Only)</option>
  <option value="Commission + Tips">Commission + Tips</option>
  <option value="hourly">Hourly</option>
</select>
              <p className="text-[8px] text-gray-400 mt-1 ml-1 uppercase font-bold">Affects Salon & Staff Earning reports.</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Commission (%)</label>
              <input 
                type="number" 
                value={formData.commission}
                onChange={e => setFormData({...formData, commission: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-xl text-xs font-bold border border-gray-100 outline-none focus:border-pink-300" 
              />
            </div>
            {/* NEW: Check Payout Field */}
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Check Payout (%)</label>
    <input 
      type="number" 
      value={formData.checkPayout || "70"} 
      onChange={e => setFormData({...formData, checkPayout: e.target.value})}
      className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-100" 
      placeholder="70"
    />
  </div>
            <button 
              type="submit"
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 shadow-md transition-all"
            >
              Update User Record
            </button>
          </div>
        </form>
      </div>

      {/* --- TABLE SECTION --- */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Payout</th>
              <th className="px-6 py-4">Comm. %</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs font-bold text-gray-600">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 text-gray-900 uppercase italic font-black">{user.name}</td>
                <td className="px-6 py-4 text-gray-400 font-normal">{user.email}</td>
                <td className="px-6 py-4">
                   <span className="bg-gray-100 px-2 py-1 rounded-lg text-[9px] uppercase">{user.role}</span>
                </td>
<td className="px-6 py-4 uppercase text-[9px] text-pink-500 font-black">
  {user.payoutType || 'standard'}
</td>
<td className="px-6 py-4 text-gray-900 font-black">
  {/* Display the commission from the database, fallback to 60 */}
  {user.commission || 60}%
</td>
 <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleEdit(user)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] uppercase font-black">Edit</button>
                    <button onClick={() => handleDelete(user.id, user.name)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] uppercase font-black">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}