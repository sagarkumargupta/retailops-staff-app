import React from 'react'
import { Link } from 'react-router-dom'

export default function Home(){
  return (
    <div className="min-h-screen bg-blue-50">
      <div className="container mx-auto px-6 py-20">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-blue-600 mb-6">
            RetailOps Partners
          </h1>
          <p className="text-2xl text-gray-700 mb-8">
            Bihar's Premium Retail Network
          </p>
          <p className="text-lg text-gray-600 mb-12">
            Premium fashion experiences across 16 locations in 6 cities of Bihar, India.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/our-stores" 
              className="px-8 py-4 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Explore Our Stores
            </Link>
            <Link 
              to="/reviews" 
              className="px-8 py-4 rounded-lg border-2 border-blue-600 text-blue-600 font-semibold hover:bg-blue-600 hover:text-white transition-colors"
            >
              Customer Reviews
            </Link>
          </div>
        </div>
        
        {/* Simple Stats */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">16</div>
            <div className="text-gray-600">Store Locations</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">6</div>
            <div className="text-gray-600">Cities Covered</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">9</div>
            <div className="text-gray-600">Premium Brands</div>
          </div>
        </div>
      </div>
    </div>
  )
}