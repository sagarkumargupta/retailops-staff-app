import React from 'react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold">About Us</h1>
        <p className="mt-2 text-slate-600">RetailOps Partners — curating leading brands in Motihari, Bihar.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card card-pad">
          <h2 className="text-xl font-semibold mb-2">Our Story</h2>
          <p className="text-slate-700">We bring premium experiences to our city with stores spanning fashion, sportswear and essentials. Our focus is simple: selection, service and satisfaction.</p>
        </div>
        <div className="card card-pad">
          <h2 className="text-xl font-semibold mb-2">Brands</h2>
          <ul className="list-disc pl-5 text-slate-700">
            <li>Mufti</li>
            <li>Monte Carlo</li>
            <li>Puma</li>
            <li>Jockey</li>
            <li>Biba</li>
          </ul>
        </div>
        <div className="card card-pad md:col-span-2">
          <h2 className="text-xl font-semibold mb-2">What We Value</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border">Quality Products</div>
            <div className="p-4 rounded-lg bg-slate-50 border">Honest Pricing</div>
            <div className="p-4 rounded-lg bg-slate-50 border">Friendly Service</div>
          </div>
        </div>
      </div>
    </div>
  );
}


