import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/cases', label: 'Cases' },
  { to: '/cm-song', label: 'CM Song' },
];

export const NavBar = () => {
  return (
    <nav className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">응</span>
            </div>
            <span className="font-bold text-xl text-text-strong">응답하라-입주민이여</span>
          </NavLink>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-primary ${
                    isActive ? 'text-primary' : 'text-text-muted'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Button variant="default" className="rounded-button">
              Login
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button variant="ghost" className="md:hidden" size="icon">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
        </div>
      </div>
    </nav>
  );
};