import React from 'react';
import { Link } from 'react-router-dom';

export default function OurStores() {
  const stores = [
    {
      name: "Mufti Motihari",
      brand: "Mufti",
      city: "Motihari",
      address: "Main Market, Motihari, Bihar",
      phone: "+91-98765-43210",
      email: "mufti.motihari@retailops.com"
    },
    {
      name: "Monte Carlo Motihari",
      brand: "Monte Carlo",
      city: "Motihari",
      address: "City Center, Motihari, Bihar",
      phone: "+91-98765-43211",
      email: "montecarlo.motihari@retailops.com"
    },
    {
      name: "Puma Motihari",
      brand: "Puma",
      city: "Motihari",
      address: "Shopping Complex, Motihari, Bihar",
      phone: "+91-98765-43212",
      email: "puma.motihari@retailops.com"
    },
    {
      name: "Jockey Motihari",
      brand: "Jockey",
      city: "Motihari",
      address: "Retail Plaza, Motihari, Bihar",
      phone: "+91-98765-43213",
      email: "jockey.motihari@retailops.com"
    },
    {
      name: "Biba Motihari",
      brand: "Biba",
      city: "Motihari",
      address: "Fashion Street, Motihari, Bihar",
      phone: "+91-98765-43214",
      email: "biba.motihari@retailops.com"
    },
    {
      name: "Dcot Motihari",
      brand: "Dcot",
      city: "Motihari",
      address: "Commercial Area, Motihari, Bihar",
      phone: "+91-98765-43215",
      email: "dcot.motihari@retailops.com"
    },
    {
      name: "Monte Carlo Gopalganj",
      brand: "Monte Carlo",
      city: "Gopalganj",
      address: "Main Road, Gopalganj, Bihar",
      phone: "+91-98765-43216",
      email: "montecarlo.gopalganj@retailops.com"
    },
    {
      name: "Mufti Puma Gopalganj",
      brand: "Mufti & Puma",
      city: "Gopalganj",
      address: "Market Square, Gopalganj, Bihar",
      phone: "+91-98765-43217",
      email: "muftipuma.gopalganj@retailops.com"
    },
    {
      name: "Dcot Gopalganj",
      brand: "Dcot",
      city: "Gopalganj",
      address: "Shopping District, Gopalganj, Bihar",
      phone: "+91-98765-43218",
      email: "dcot.gopalganj@retailops.com"
    },
    {
      name: "Cobb Gopalganj",
      brand: "Cobb",
      city: "Gopalganj",
      address: "Retail Hub, Gopalganj, Bihar",
      phone: "+91-98765-43219",
      email: "cobb.gopalganj@retailops.com"
    },
    {
      name: "Mufti Bettiah",
      brand: "Mufti",
      city: "Bettiah",
      address: "Central Market, Bettiah, Bihar",
      phone: "+91-98765-43220",
      email: "mufti.bettiah@retailops.com"
    },
    {
      name: "Mufti Puma Raxaul",
      brand: "Mufti & Puma",
      city: "Raxaul",
      address: "Border Market, Raxaul, Bihar",
      phone: "+91-98765-43221",
      email: "muftipuma.raxaul@retailops.com"
    },
    {
      name: "Jockey Sitamarhi",
      brand: "Jockey",
      city: "Sitamarhi",
      address: "Main Bazaar, Sitamarhi, Bihar",
      phone: "+91-98765-43222",
      email: "jockey.sitamarhi@retailops.com"
    },
    {
      name: "Park Avenue Muzaffarpur",
      brand: "Park Avenue",
      city: "Muzaffarpur",
      address: "Icon Mall, Muzaffarpur, Bihar",
      phone: "+91-98765-43223",
      email: "parkavenue.muzaffarpur@retailops.com"
    },
    {
      name: "Monte Carlo Muzaffarpur",
      brand: "Monte Carlo",
      city: "Muzaffarpur",
      address: "Icon Mall, Muzaffarpur, Bihar",
      phone: "+91-98765-43224",
      email: "montecarlo.muzaffarpur@retailops.com"
    }
  ];

  const cities = [...new Set(stores.map(store => store.city))];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Stores</h1>
            <p className="text-xl text-gray-600">
              Discover our retail network across Bihar, India
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold mb-2">{stores.length}</div>
              <div className="text-blue-100">Total Stores</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">{cities.length}</div>
              <div className="text-blue-100">Cities</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">8</div>
              <div className="text-blue-100">Brands</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">24/7</div>
              <div className="text-blue-100">Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stores.map((store, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{store.name}</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {store.brand}
                  </span>
                </div>
                <div className="space-y-3 text-gray-600">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{store.city}, Bihar</span>
                  </div>
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-gray-400 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm">{store.address}</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-sm">{store.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">{store.email}</span>
                  </div>
                </div>
                <div className="mt-6">
                  <Link 
                    to="/login" 
                    className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Visit Store
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map Section */}
      <div className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Presence in Bihar</h2>
            <p className="text-gray-600">
              We have stores across major cities in Bihar, serving customers with quality products and excellent service.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cities.map((city, index) => (
              <div key={index} className="text-center p-6 bg-gray-50 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{city}</h3>
                <p className="text-gray-600">
                  {stores.filter(store => store.city === city).length} stores
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Join Our Retail Network</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Want to partner with us or open a new store? Get in touch with our team.
          </p>
          <div className="space-x-4">
            <Link 
              to="/signup" 
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Partner With Us
            </Link>
            <Link 
              to="/about-us" 
              className="inline-block border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
