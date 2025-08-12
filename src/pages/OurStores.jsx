import React from 'react';

const STORES = [
  { 
    brand: 'Mufti', 
    name: 'Mufti Bettiah', 
    city: 'Bettiah, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Mufti+Bettiah',
    photo: 'https://via.placeholder.com/400x300/1e40af/ffffff?text=Mufti+Bettiah'
  },
  { 
    brand: 'Mufti', 
    name: 'Mufti Motihari', 
    city: 'Motihari, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Mufti+Motihari',
    photo: 'https://via.placeholder.com/400x300/1e40af/ffffff?text=Mufti+Motihari'
  },
  { 
    brand: 'Monte Carlo', 
    name: 'Monte Carlo Motihari', 
    city: 'Motihari, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Monte+Carlo+Motihari',
    photo: 'https://via.placeholder.com/400x300/059669/ffffff?text=Monte+Carlo+Motihari'
  },
  { 
    brand: 'Puma', 
    name: 'Puma Motihari', 
    city: 'Motihari, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Puma+Motihari',
    photo: 'https://via.placeholder.com/400x300/000000/ffffff?text=Puma+Motihari'
  },
  { 
    brand: 'Jockey', 
    name: 'Jockey Motihari', 
    city: 'Motihari, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Jockey+Motihari',
    photo: 'https://via.placeholder.com/400x300/ea580c/ffffff?text=Jockey+Motihari'
  },
  { 
    brand: 'Biba', 
    name: 'Biba Motihari', 
    city: 'Motihari, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Biba+Motihari',
    photo: 'https://via.placeholder.com/400x300/ec4899/ffffff?text=Biba+Motihari'
  },
  { 
    brand: 'Van Heusen', 
    name: 'Van Heusen Motihari', 
    city: 'Motihari, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Van+Heusen+Motihari',
    photo: 'https://via.placeholder.com/400x300/1f2937/ffffff?text=Van+Heusen+Motihari'
  },
  { 
    brand: 'Dcot', 
    name: 'Dcot Motihari', 
    city: 'Motihari, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Dcot+Motihari',
    photo: 'https://via.placeholder.com/400x300/dc2626/ffffff?text=Dcot+Motihari'
  },
  { 
    brand: 'Monte Carlo', 
    name: 'Monte Carlo Gopalganj', 
    city: 'Gopalganj, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Monte+Carlo+Gopalganj',
    photo: 'https://via.placeholder.com/400x300/059669/ffffff?text=Monte+Carlo+Gopalganj'
  },
  { 
    brand: 'Mufti', 
    name: 'Mufti Puma Gopalganj', 
    city: 'Gopalganj, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Mufti+Puma+Gopalganj',
    photo: 'https://via.placeholder.com/400x300/1e40af/ffffff?text=Mufti+Puma+Gopalganj'
  },
  { 
    brand: 'Dcot', 
    name: 'Dcot Gopalganj', 
    city: 'Gopalganj, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Dcot+Gopalganj',
    photo: 'https://via.placeholder.com/400x300/dc2626/ffffff?text=Dcot+Gopalganj'
  },
  { 
    brand: 'Cobb', 
    name: 'Cobb Gopalganj', 
    city: 'Gopalganj, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Cobb+Gopalganj',
    photo: 'https://via.placeholder.com/400x300/7c3aed/ffffff?text=Cobb+Gopalganj'
  },
  { 
    brand: 'Mufti', 
    name: 'Mufti Puma Raxaul', 
    city: 'Raxaul, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Mufti+Puma+Raxaul',
    photo: 'https://via.placeholder.com/400x300/1e40af/ffffff?text=Mufti+Puma+Raxaul'
  },
  { 
    brand: 'Jockey', 
    name: 'Jockey Sitamarhi', 
    city: 'Sitamarhi, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Jockey+Sitamarhi',
    photo: 'https://via.placeholder.com/400x300/ea580c/ffffff?text=Jockey+Sitamarhi'
  },
  { 
    brand: 'Park Avenue', 
    name: 'Park Avenue Muzaffarpur', 
    city: 'Muzaffarpur, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Park+Avenue+Muzaffarpur',
    photo: 'https://via.placeholder.com/400x300/0891b2/ffffff?text=Park+Avenue+Muzaffarpur'
  },
  { 
    brand: 'Monte Carlo', 
    name: 'Monte Carlo Muzaffarpur(Icon Mall)', 
    city: 'Muzaffarpur, Bihar', 
    map: 'https://www.google.com/maps/search/?api=1&query=Monte+Carlo+Muzaffarpur+Icon+Mall',
    photo: 'https://via.placeholder.com/400x300/059669/ffffff?text=Monte+Carlo+Muzaffarpur+Icon+Mall'
  },
];

export default function OurStores() {
  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Our Stores</h1>
        <p className="mt-3 text-lg text-gray-600">Across Bihar — premium fashion and sportswear destinations in multiple cities.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {STORES.map((s) => (
          <div key={s.name} className="group overflow-hidden rounded-xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="relative h-48 overflow-hidden">
              <img 
                src={s.photo} 
                alt={`${s.name} store front`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-gray-600 font-medium">{s.brand}</div>
                  <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-500">{s.city}</div>
                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  {s.brand}
                </div>
              </div>
              
              <div className="flex gap-2">
                <a 
                  href={s.map} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 px-3 py-2 text-sm font-medium text-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View on Map
                </a>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=shopping+${s.city.split(',')[0]}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="px-3 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Directions
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-12 text-center">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Visit Our Stores</h3>
          <p className="text-gray-600 mb-4">Experience premium fashion and exceptional service at any of our locations across Bihar.</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <span>🏪 16 Locations</span>
            <span>🏙️ 6 Cities</span>
            <span>👔 9 Premium Brands</span>
          </div>
        </div>
      </div>
    </div>
  );
}
