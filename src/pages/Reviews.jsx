import React from 'react';
import { Link } from 'react-router-dom';

export default function Reviews() {
  const reviews = [
    {
      id: 1,
      name: "Rajesh Kumar",
      store: "Mufti Motihari",
      rating: 5,
      date: "2024-01-15",
      comment: "RetailOps has transformed our store operations completely. The sales tracking and staff management features are incredible. Highly recommended!",
      role: "Store Manager"
    },
    {
      id: 2,
      name: "Priya Sharma",
      store: "Monte Carlo Gopalganj",
      rating: 5,
      date: "2024-01-10",
      comment: "The task management system is excellent. Our team productivity has increased by 40% since we started using RetailOps.",
      role: "Store Owner"
    },
    {
      id: 3,
      name: "Amit Patel",
      store: "Puma Motihari",
      rating: 4,
      date: "2024-01-08",
      comment: "Great platform for managing multiple stores. The reports and analytics help us make better business decisions.",
      role: "Regional Manager"
    },
    {
      id: 4,
      name: "Sunita Devi",
      store: "Jockey Sitamarhi",
      rating: 5,
      date: "2024-01-05",
      comment: "Staff attendance tracking and salary management is so much easier now. The mobile app is very user-friendly.",
      role: "Store Manager"
    },
    {
      id: 5,
      name: "Vikram Singh",
      store: "Biba Motihari",
      rating: 4,
      date: "2024-01-03",
      comment: "Customer management and dues tracking features are exactly what we needed. The WhatsApp integration is brilliant.",
      role: "Store Owner"
    },
    {
      id: 6,
      name: "Meera Gupta",
      store: "Park Avenue Muzaffarpur",
      rating: 5,
      date: "2023-12-28",
      comment: "The training and test modules have helped us improve our staff skills significantly. Excellent platform!",
      role: "HR Manager"
    }
  ];

  const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Customer Reviews</h1>
            <p className="text-xl text-gray-600">
              What our customers say about RetailOps
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold mb-2">{reviews.length}</div>
              <div className="text-blue-100">Total Reviews</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">{averageRating.toFixed(1)}</div>
              <div className="text-blue-100">Average Rating</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">100%</div>
              <div className="text-blue-100">Satisfaction Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">15+</div>
              <div className="text-blue-100">Stores Using</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-lg font-bold text-blue-600">
                      {review.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{review.name}</h3>
                    <p className="text-sm text-gray-500">{review.role}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">{review.store}</p>
                <p className="text-gray-700">{review.comment}</p>
              </div>
              <div className="text-sm text-gray-400">
                {new Date(review.date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6">Why Retailers Choose RetailOps</h2>
            <p className="text-xl text-gray-600">
              Real feedback from real businesses
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Increased Efficiency</h3>
              <p className="text-gray-600">
                "Our operational efficiency improved by 60% within the first month of using RetailOps."
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Better Profitability</h3>
              <p className="text-gray-600">
                "We've seen a 25% increase in profitability due to better inventory and staff management."
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Happy Staff</h3>
              <p className="text-gray-600">
                "Our staff loves the easy-to-use interface and automated processes. Morale has improved significantly."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Join Our Happy Customers</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            See why hundreds of retail businesses trust RetailOps to manage their operations.
          </p>
          <div className="space-x-4">
            <Link 
              to="/signup" 
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link 
              to="/our-stores" 
              className="inline-block border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
            >
              Visit Our Stores
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


