import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { establishments } from '@/lib/data';
import { ArrowLeft, Phone, Share2, Navigation, Clock, MapPin, Star, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { getRoute, formatDistance, formatDuration } from '@/lib/routing';

export default function Details() {
  const [, params] = useRoute('/details/:id');
  const [, setLocation] = useLocation();
  const id = params?.id;
  const establishment = establishments.find(e => e.id === id);
  
  const [userLoc, setUserLoc] = useState({ lat: 5.3261, lng: -4.0200 });
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [routeLoading, setRouteLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!establishment) return;

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLoc(loc);
        fetchRoute(loc);
      }, () => {
        fetchRoute(userLoc);
      });
    } else {
      fetchRoute(userLoc);
    }
  }, [establishment?.id]);

  const fetchRoute = async (location: { lat: number; lng: number }) => {
    if (!establishment) return;
    
    setRouteLoading(true);
    const route = await getRoute(
      location.lng,
      location.lat,
      establishment.coordinates.lng,
      establishment.coordinates.lat,
      'driving'
    );
    setRouteInfo(route);
    setRouteLoading(false);
  };

  if (!establishment) {
    return <div className="p-8 text-center text-white">Établissement non trouvé</div>;
  }

  return (
    <div className="min-h-screen bg-background relative pb-24">
      {/* Hero Image */}
      <div className="h-[45vh] w-full relative">
        <img 
          src={establishment.imageUrl} 
          alt={establishment.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        {/* Header Actions */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <button 
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-background/40 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex space-x-2">
            <button className="w-10 h-10 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-background/40 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide">
                {establishment.category}
              </span>
              {establishment.isOpen ? (
                <span className="text-green-400 text-xs font-medium flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />
                  Ouvert maintenant
                </span>
              ) : (
                <span className="text-red-400 text-xs font-medium">Fermé</span>
              )}
            </div>
            
            <h1 className="text-3xl font-display font-bold text-white mb-1 leading-tight">{establishment.name}</h1>
            
            <div className="flex items-center text-gray-300 text-sm mb-4">
              <MapPin className="w-4 h-4 mr-1 text-primary" />
              <span>{establishment.address}</span>
            </div>

            <div className="flex items-center space-x-4">
               <div className="flex items-center">
                 <Star className="w-5 h-5 text-yellow-400 fill-current" />
                 <span className="ml-1 text-white font-bold">{establishment.rating}</span>
                 <span className="ml-1 text-gray-400 text-xs">(128 avis)</span>
               </div>
               <div className="h-4 w-[1px] bg-white/20" />
               {!routeLoading && routeInfo && (
                 <div className="flex items-center text-gray-300 text-sm">
                   <Navigation className="w-4 h-4 mr-1" />
                   <span>{formatDistance(routeInfo.distance)} • {formatDuration(routeInfo.duration)}</span>
                 </div>
               )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content Body */}
      <div className="px-6 py-6 space-y-6">
        {/* Route Info Card */}
        {!routeLoading && routeInfo && (
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Distance et durée</p>
                <p className="text-lg font-bold text-primary">
                  {formatDistance(routeInfo.distance)} • {formatDuration(routeInfo.duration)}
                </p>
              </div>
              <Navigation className="w-8 h-8 text-primary opacity-50" />
            </div>
          </motion.div>
        )}

        <section>
          <h2 className="text-lg font-bold text-white mb-2">À propos</h2>
          <p className="text-gray-400 leading-relaxed text-sm">
            {establishment.description}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3">Commodités</h2>
          <div className="flex flex-wrap gap-2">
            {establishment.features.map((feature, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm border border-white/5">
                {feature}
              </span>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-xl border-t border-white/10 flex space-x-3 z-20 pb-safe">
           <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-12 rounded-xl">
             <Phone className="w-4 h-4 mr-2" />
             Appeler
           </Button>
           <Button className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl">
             <Navigation className="w-4 h-4 mr-2" />
             Itinéraire
           </Button>
        </div>
      </div>
    </div>
  );
}
