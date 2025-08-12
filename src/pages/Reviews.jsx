import React from 'react';

const REVIEWS = [
  {
    name: 'A. Kumar',
    rating: 5,
    text: 'Amazing selection and polite staff. Great experience at Mufti Motihari!',
  },
  {
    name: 'P. Singh',
    rating: 5,
    text: 'Puma store was superb — genuine products and helpful guidance.',
  },
  {
    name: 'S. Verma',
    rating: 4,
    text: 'Monte Carlo had a wide range and good pricing. Recommended.',
  },
];

function Stars({ n }) {
  return (
    <div className="text-yellow-500">{'★★★★★'.slice(0, n)}<span className="text-slate-300">{'★★★★★'.slice(n)}</span></div>
  );
}

export default function Reviews() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold">Customer Reviews</h1>
        <p className="mt-2 text-slate-600">Highlights from Google and our shoppers in Motihari.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {REVIEWS.map((r, i) => (
          <div key={i} className="rounded-2xl bg-white ring-1 ring-slate-200 shadow p-5">
            <Stars n={r.rating} />
            <p className="mt-3 text-slate-700">{r.text}</p>
            <div className="mt-4 text-sm text-slate-500">— {r.name}</div>
          </div>
        ))}
      </div>
      <div className="text-center mt-8">
        <a href="https://www.google.com/maps/search/?api=1&query=Mufti+Motihari" target="_blank" rel="noreferrer" className="inline-block px-4 py-2 rounded bg-slate-900 text-white">See more on Google</a>
      </div>
    </div>
  );
}


