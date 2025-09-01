import React from 'react';

export const HeroFigma: React.FC = () => {
  return (
    <section className="relative w-full min-h-screen bg-bg">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center text-center">
          <h1 className="h1 mb-6">
            Hero Component
          </h1>
          <p className="body max-w-2xl mb-8">
            This is a hero component placeholder. Add your content here.
          </p>
        </div>
      </div>
    </section>
  );
};