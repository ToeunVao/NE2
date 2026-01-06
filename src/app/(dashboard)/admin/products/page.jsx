"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import Image from "next/image";

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const adjustStock = async (id, currentStock, amount) => {
    const newStock = Math.max(0, currentStock + amount);
    await updateDoc(doc(db, "products", id), { stock: newStock });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 font-serif">Inventory</h1>
          <p className="text-gray-500">Manage salon supplies and retail products.</p>
        </div>
        <button className="bg-pink-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-pink-700 transition-all">
          <i className="fas fa-plus mr-2"></i> Add Product
        </button>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group">
            <div className="relative h-48 bg-gray-100">
              <Image 
                src={product.imageUrl || "https://placehold.co/400x400?text=Product"} 
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {product.stock <= 5 && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                  Low Stock
                </span>
              )}
            </div>
            
            <div className="p-5">
              <h3 className="font-bold text-gray-800 truncate">{product.name}</h3>
              <p className="text-pink-600 font-bold text-lg">${product.price}</p>
              
              <div className="mt-4 flex items-center justify-between bg-gray-50 p-2 rounded-xl">
                <span className="text-xs font-semibold text-gray-500 uppercase ml-2">Stock</span>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => adjustStock(product.id, product.stock, -1)}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-pink-500 hover:text-pink-600 transition-colors"
                  >
                    -
                  </button>
                  <span className={`font-bold ${product.stock <= 5 ? 'text-red-500' : 'text-gray-800'}`}>
                    {product.stock}
                  </span>
                  <button 
                    onClick={() => adjustStock(product.id, product.stock, 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-pink-500 hover:text-pink-600 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}