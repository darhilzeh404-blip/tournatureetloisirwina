import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import UploadAgencyLogo from '@/components/admin/UploadAgencyLogo';

export const Route = createFileRoute('/admin/create-agency-full')({
  component: CreateAgencyWithRoutes,
});

function CreateAgencyWithRoutes() {
  const [agency, setAgency] = useState({
    name: '',
    logo: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    city: ''
  });

  const [routes, setRoutes] = useState([
    {
      departureCity: '',
      arrivalCity: '',
      departureTime: '',
      arrivalTime: '',
      duration: 0,
      busType: 'Standard',
      seatsTotal: 50,
      seatsAvailable: 50,
      basePrice: 0,
      appFee: 0
    }
  ]);

  const handleLogoUploaded = (logoUrl: string) => {
    setAgency({ ...agency, logo: logoUrl });
  };

  const addRoute = () => {
    setRoutes([...routes, {
      departureCity: '',
      arrivalCity: '',
      departureTime: '',
      arrivalTime: '',
      duration: 0,
      busType: 'Standard',
      seatsTotal: 50,
      seatsAvailable: 50,
      basePrice: 0,
      appFee: 0
    }]);
  };

  const removeRoute = (index: number) => {
    setRoutes(routes.filter((_, i) => i !== index));
  };

  const updateRoute = (index: number, field: string, value: any) => {
    setRoutes(routes.map((route, i) => 
      i === index ? { ...route, [field]: value } : route
    ));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!agency.logo) {
      alert('Veuillez uploader un logo');
      return;
    }

    if (routes.length === 0) {
      alert('Veuillez ajouter au moins un trajet');
      return;
    }

    try {
      // 1. Créer l'agence
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .insert(agency)
        .select();

      if (agencyError) {
        console.error('Error creating agency:', agencyError);
        alert('Erreur lors de la création de l\'agence');
        return;
      }

      const agencyId = agencyData[0].id;

      // 2. Créer les trajets pour cette agence
      for (const route of routes) {
        const totalPrice = route.basePrice + route.appFee;
        
        const { error: routeError } = await supabase.from('routes').insert({
          agency_id: agencyId,
          departure_city: route.departureCity,
          arrival_city: route.arrivalCity,
          departure_time: route.departureTime,
          arrival_time: route.arrivalTime,
          duration: route.duration,
          bus_type: route.busType,
          seats_total: route.seatsTotal,
          seats_available: route.seatsAvailable,
          base_price: route.basePrice,
          app_fee: route.appFee,
          total_price: totalPrice,
          is_active: true
        });

        if (routeError) {
          console.error('Error creating route:', routeError);
          alert('Erreur lors de la création du trajet');
          return;
        }
      }

      alert('✅ Agence et trajets créés avec succès!');
      
      // Reset formulaire
      setAgency({
        name: '',
        logo: '',
        description: '',
        phone: '',
        email: '',
        address: '',
        city: ''
      });
      setRoutes([{
        departureCity: '',
        arrivalCity: '',
        departureTime: '',
        arrivalTime: '',
        duration: 0,
        busType: 'Standard',
        seatsTotal: 50,
        seatsAvailable: 50,
        basePrice: 0,
        appFee: 0
      }]);

    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la création');
    }
  };

  return (
    <div className="create-agency-full-page">
      <h1>➕ Créer Agence + Trajets</h1>
      
      <form onSubmit={handleSubmit}>
        {/* Section Agence */}
        <section className="section">
          <h2>📋 Informations Agence</h2>
          
          <UploadAgencyLogo onLogoUploaded={handleLogoUploaded} />
          
          {agency.logo && (
            <div className="logo-preview">
              <p>Logo uploadé:</p>
              <img src={agency.logo} alt="Logo" style={{width: '100px', height: '100px'}} />
            </div>
          )}
          
          <input
            type="text"
            placeholder="Nom de l'agence"
            value={agency.name}
            onChange={e => setAgency({...agency, name: e.target.value})}
            required
          />
          
          <textarea
            placeholder="Description"
            value={agency.description}
            onChange={e => setAgency({...agency, description: e.target.value})}
          />
          
          <input
            type="tel"
            placeholder="Téléphone"
            value={agency.phone}
            onChange={e => setAgency({...agency, phone: e.target.value})}
            required
          />
          
          <input
            type="email"
            placeholder="Email"
            value={agency.email}
            onChange={e => setAgency({...agency, email: e.target.value})}
            required
          />
          
          <input
            type="text"
            placeholder="Adresse"
            value={agency.address}
            onChange={e => setAgency({...agency, address: e.target.value})}
            required
          />
          
          <input
            type="text"
            placeholder="Ville principale"
            value={agency.city}
            onChange={e => setAgency({...agency, city: e.target.value})}
            required
          />
        </section>
        
        {/* Section Trajets */}
        <section className="section">
          <h2>🚌 Trajets de l'agence</h2>
          
          {routes.map((route, index) => (
            <div key={index} className="route-card">
              <h3>Trajet {index + 1}</h3>
              
              <div className="route-fields">
                <input
                  type="text"
                  placeholder="Ville départ"
                  value={route.departureCity}
                  onChange={e => updateRoute(index, 'departureCity', e.target.value)}
                  required
                />
                
                <input
                  type="text"
                  placeholder="Ville arrivée"
                  value={route.arrivalCity}
                  onChange={e => updateRoute(index, 'arrivalCity', e.target.value)}
                  required
                />
                
                <input
                  type="time"
                  placeholder="Heure départ"
                  value={route.departureTime}
                  onChange={e => updateRoute(index, 'departureTime', e.target.value)}
                  required
                />
                
                <input
                  type="time"
                  placeholder="Heure arrivée"
                  value={route.arrivalTime}
                  onChange={e => updateRoute(index, 'arrivalTime', e.target.value)}
                  required
                />
                
                <input
                  type="number"
                  placeholder="Durée (minutes)"
                  value={route.duration}
                  onChange={e => updateRoute(index, 'duration', Number(e.target.value))}
                  required
                />
                
                <select
                  value={route.busType}
                  onChange={e => updateRoute(index, 'busType', e.target.value)}
                >
                  <option value="Standard">Standard</option>
                  <option value="Confort">Confort</option>
                  <option value="Premium">Premium</option>
                </select>
                
                <input
                  type="number"
                  placeholder="Places totales"
                  value={route.seatsTotal}
                  onChange={e => updateRoute(index, 'seatsTotal', Number(e.target.value))}
                  required
                />
                
                <input
                  type="number"
                  placeholder="Places disponibles"
                  value={route.seatsAvailable}
                  onChange={e => updateRoute(index, 'seatsAvailable', Number(e.target.value))}
                  required
                />
                
                <input
                  type="number"
                  placeholder="Prix base (agence)"
                  value={route.basePrice}
                  onChange={e => updateRoute(index, 'basePrice', Number(e.target.value))}
                  required
                />
                
                <input
                  type="number"
                  placeholder="Frais application"
                  value={route.appFee}
                  onChange={e => updateRoute(index, 'appFee', Number(e.target.value))}
                  required
                />
              </div>
              
              <button 
                type="button"
                onClick={() => removeRoute(index)}
                className="btn-remove"
              >
                ❌ Supprimer trajet
              </button>
            </div>
          ))}
          
          <button 
            type="button"
            onClick={addRoute}
            className="btn-add"
          >
            ➕ Ajouter trajet
          </button>
        </section>
        
        <button type="submit" className="btn-submit">
          Créer Agence + Trajets
        </button>
      </form>
    </div>
  );
}