import React from 'react';
import { Outlet } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { Footer } from '@/components/layout/Footer';

export const RootLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      
      <main className="flex-1">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};