import Image from "next/image";

export default function GalleryPage() {
  // In a real setup, these would come from your 'gallery' collection in Firebase
  const photos = [
    { id: 1, url: "https://images.unsplash.com/photo-1604654894610-df490668f602?q=80", title: "Classic Red" },
    { id: 2, url: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?q=80", title: "French Tip" },
    { id: 3, url: "https://images.unsplash.com/photo-1600057081960-ef0744047395?q=80", title: "Chrome Finish" },
    { id: 4, url: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80", title: "Floral Art" },
  ];

  return (
    <div className="min-h-screen bg-white py-20 px-6">
      <div className="max-w-7xl mx-auto text-center mb-16">
        <h1 className="text-5xl font-serif font-bold text-gray-800 mb-4">Our Masterpieces</h1>
        <p className="text-gray-500 max-w-lg mx-auto italic">High-quality art designed for your unique style.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="relative h-80 group overflow-hidden rounded-2xl shadow-sm">
            <Image 
              src={photo.url}
              alt={photo.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white font-bold tracking-widest uppercase border-b-2 border-white pb-1">
                {photo.title}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}