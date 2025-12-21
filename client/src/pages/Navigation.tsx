import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import MapView from '@/components/Map';
import { establishments } from '@/lib/data';
import { ArrowLeft, Phone, MapPin, Clock, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistance, formatDuration } from '@/lib/routing';

export default function NavigationPage() {
  const [, params] = useLocation();
  const id = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('id');
  const [, navigate] = useLocation();
  
  const establishment = establishments.find(e => e.id === id);
  const [userLoc, setUserLoc] = useState({ lat: 5.3261, lng: -4.0200 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLoc({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
  }, []);

  if (!establishment) {
    return <div className="p-8 text-center text-white">Établissement non trouvé</div>;
  }

  return (
    <div className="h-screen w-full bg-background relative flex flex-col">
      {/* Map */}
      <div className="flex-1 relative z-0">
        <MapView 
          userLocation={userLoc}
          highlightedId={id || ''}
        />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-background/80 to-transparent flex items-center space-x-3">
        <button 
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-background/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-white truncate">{establishment.name}</h1>
          <p className="text-xs text-gray-300 capitalize">{establishment.category}</p>
        </div>
      </div>

      {/* Bottom Info Card */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6 pb-safe">
        <div className="bg-card border border-white/10 rounded-2xl p-4 space-y-4">
          {/* Establishment Header */}
          <div>
            <h2 className="font-display font-bold text-xl text-white mb-1">{establishment.name}</h2>
            <div className="flex items-center text-muted-foreground text-sm">
              <MapPin className="w-4 h-4 mr-2" />
              <span>{establishment.address}</span>
            </div>
          </div>

          {/* Distance Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Distance</p>
              <p className="text-lg font-bold text-primary">
                {establishment.address.includes('Plateau') ? '1.5 km' : '2.3 km'}
              </p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Durée</p>
              <p className="text-lg font-bold text-primary">
                {establishment.address.includes('Plateau') ? '8 min' : '12 min'}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 line-clamp-2">{establishment.description}</p>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-12 rounded-xl">
              <Phone className="w-4 h-4 mr-2" />
              Appeler
            </Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl">
              <Navigation className="w-4 h-4 mr-2" />
              Naviguer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
