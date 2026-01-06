"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";

export default function StaffSchedule() {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "staff"), (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (staffId, newStatus) => {
    await updateDoc(doc(db, "staff", staffId), {
      workStatus: newStatus, // 'available', 'on-break', 'off-duty'
      lastStatusUpdate: new Date()
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif text-gray-800">Team Attendance</h1>
        <p className="text-gray-500">Manage daily availability and breaks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <div key={member.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-600 font-bold text-xl">
                {member.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{member.name}</h3>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  member.workStatus === 'available' ? 'bg-green-100 text-green-600' :
                  member.workStatus === 'on-break' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {member.workStatus || 'off-duty'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => updateStatus(member.id, 'available')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${member.workStatus === 'available' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                Active
              </button>
              <button 
                onClick={() => updateStatus(member.id, 'on-break')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${member.workStatus === 'on-break' ? 'bg-yellow-500 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                Break
              </button>
              <button 
                onClick={() => updateStatus(member.id, 'off-duty')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${member.workStatus === 'off-duty' ? 'bg-gray-800 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                Off
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}