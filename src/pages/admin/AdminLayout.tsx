import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const AdminLayout: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="border-b border-border bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-foreground">관리자 패널</h1>
            <Separator orientation="vertical" className="h-6" />
            <nav className="flex items-center gap-2">
              <Button
                variant={isActive('/admin/inquiries') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link to="/admin/inquiries">문의 관리</Link>
              </Button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">메인으로</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;