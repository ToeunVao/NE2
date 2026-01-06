import Image from "next/image";
import Link from "next/link";
import { getPromotions } from "@/lib/dataService";

export default async function HomePage() {
  const promotions = await getPromotions();

  return (
    <main className="min-h-screen bg-pink-50/30">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center">
        <Image 
          src="https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80"
          alt="Nail Art"
          fill
          priority
          className="object-cover brightness-75"
        />
        <div className="relative z-10 text-center text-white">
          <h1 className="text-7xl font-cursive mb-4">NailsXpress</h1>
          <p className="text-xl font-light tracking-widest uppercase">Luxury Spa & Nail Art</p>
          <Link href="/login" className="mt-8 inline-block bg-white text-pink-600 px-8 py-3 rounded-full font-bold hover:bg-pink-100 transition-all">
            Manage Salon
          </Link>
        </div>
      </section>

      {/* Promotions Section */}
      <section className="max-w-7xl mx-auto py-20 px-6">
        <h2 className="text-4xl font-serif text-gray-800 mb-12 text-center">Special Offers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {promotions.map((promo) => (
            <div key={promo.id} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow border border-pink-100">
              <div className="relative h-48">
                <Image 
                  src={promo.imageUrl || "https://placehold.co/600x400?text=Special+Offer"} 
                  alt={promo.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <span className="text-pink-600 font-bold text-sm uppercase tracking-tighter">{promo.category}</span>
                <h3 className="text-xl font-bold text-gray-800 mt-2">{promo.title}</h3>
                <p className="text-gray-600 mt-2 text-sm">{promo.description}</p>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-2xl font-bold text-pink-600">${promo.price}</span>
                  <button className="bg-pink-50 text-pink-600 px-4 py-2 rounded-lg font-semibold hover:bg-pink-600 hover:text-white transition-colors">
                    Claim Offer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}