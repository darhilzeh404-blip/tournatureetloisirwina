import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/admin/dashboard')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalTickets: 0,
    reservedTickets: 0,
    paidTickets: 0,
    cancelledTickets: 0,
    validatedTickets: 0,
    totalRevenue: 0,
    appFees: 0,
    totalAgencies: 0,
    totalRoutes: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    try {
      // 1. Statistiques des tickets
      type TicketRow = { status?: string | null; price?: number | null };
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets' as any)
        .select('status, price') as any;

      if (ticketsError) {
        console.error('Error fetching tickets:', ticketsError);
        setLoading(false);
        return;
      }

      const ticketRows = Array.isArray(tickets) ? (tickets as TicketRow[]) : [];
      const totalTickets = ticketRows.length;
      const reservedTickets = ticketRows.filter((t) => t.status === 'reservé').length;
      const paidTickets = ticketRows.filter((t) => t.status === 'payé').length;
      const cancelledTickets = ticketRows.filter((t) => t.status === 'annulé').length;
      const validatedTickets = ticketRows.filter((t) => t.status === 'validé').length;
      const totalRevenue = ticketRows.reduce((sum, t) => sum + (t.price ?? 0), 0);
      
      // Calcul des frais application (10% du total)
      const appFees = totalRevenue * 0.1;

      // 2. Statistiques des agences
      const { data: agencies, error: agenciesError } = await supabase
        .from('agencies' as any)
        .select('id') as any;

      if (agenciesError) {
        console.error('Error fetching agencies:', agenciesError);
      }

      const totalAgencies = agencies?.length || 0;

      // 3. Statistiques des trajets
      const { data: routes, error: routesError } = await supabase
        .from('routes' as any)
        .select('id') as any;

      if (routesError) {
        console.error('Error fetching routes:', routesError);
      }

      const totalRoutes = routes?.length || 0;

      // Mettre à jour les stats
      setStats({
        totalTickets,
        reservedTickets,
        paidTickets,
        cancelledTickets,
        validatedTickets,
        totalRevenue,
        appFees,
        totalAgencies,
        totalRoutes
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1>📊 Dashboard Admin</h1>
        <p>Chargement des statistiques...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h1>📊 Dashboard Admin</h1>
      
      {/* Section: Agences et Trajets */}
      <section className="stats-section">
        <h2>🏢 Agences & Trajets</h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🏢</div>
            <div className="stat-info">
              <h3>Agences</h3>
              <p className="stat-value">{stats.totalAgencies}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🚌</div>
            <div className="stat-info">
              <h3>Trajets</h3>
              <p className="stat-value">{stats.totalRoutes}</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Section: Tickets */}
      <section className="stats-section">
        <h2>🎫 Tickets</h2>
        
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">🎫</div>
            <div className="stat-info">
              <h3>Total Tickets</h3>
              <p className="stat-value">{stats.totalTickets}</p>
            </div>
          </div>
          
          <div className="stat-card reserved">
            <div className="stat-icon">📌</div>
            <div className="stat-info">
              <h3>Réservés</h3>
              <p className="stat-value">{stats.reservedTickets}</p>
            </div>
          </div>
          
          <div className="stat-card paid">
            <div className="stat-icon">💳</div>
            <div className="stat-info">
              <h3>Payés</h3>
              <p className="stat-value">{stats.paidTickets}</p>
            </div>
          </div>
          
          <div className="stat-card validated">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <h3>Validés</h3>
              <p className="stat-value">{stats.validatedTickets}</p>
            </div>
          </div>
          
          <div className="stat-card cancelled">
            <div className="stat-icon">❌</div>
            <div className="stat-info">
              <h3>Annulés</h3>
              <p className="stat-value">{stats.cancelledTickets}</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Section: Finances */}
      <section className="stats-section">
        <h2>💰 Finances</h2>
        
        <div className="stats-grid">
          <div className="stat-card revenue">
            <div className="stat-icon">💵</div>
            <div className="stat-info">
              <h3>Revenue Total</h3>
              <p className="stat-value">{stats.totalRevenue.toFixed(2)} €</p>
            </div>
          </div>
          
          <div className="stat-card fees">
            <div className="stat-icon">💳</div>
            <div className="stat-info">
              <h3>Frais Application (10%)</h3>
              <p className="stat-value">{stats.appFees.toFixed(2)} €</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Bouton Refresh */}
      <button 
        onClick={fetchStats}
        className="btn-refresh"
      >
        🔄 Actualiser les statistiques
      </button>
    </div>
  );
}