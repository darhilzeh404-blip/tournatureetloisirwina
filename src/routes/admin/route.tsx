
import { Outlet, Link, createFileRoute } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="admin-layout min-h-screen lg:flex">
      <AdminSidebar />
      <main className="admin-content flex-1 p-6 lg:p-8">
        <div className="mb-6 hidden lg:flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-secondary/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au site
          </Link>
        </div>
        <Outlet />
      </main>
    </div>
  );
}