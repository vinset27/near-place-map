import React, { useRef, useEffect, useState } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl, Popup, ViewStateChangeEvent } from 'react-map-gl';
import { establishments } from '@/lib/data';
import { MapPin, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidHJvdXZlcmNoYXAiLCJhIjoiY21qZzk4ZHExMTE2cjNkc2R5YnhvYnRqYyJ9.kLaJ7Fd3pBs8NzF6vOTwcA';

interface MapViewProps {
  interactive?: boolean;
}

export default function MapView({ interactive = true }: MapViewProps) {
  const [viewState, setViewState] = useState({
    latitude: 5.3261, // Abidjan center
    longitude: -4.0200,
    zoom: 13,
    bearing: 0,
    pitch: 0
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const selectedEstablishment = establishments.find(e => e.id === selectedId);

  return (
    <div className="w-full h-full relative">
      <Map
        {...viewState}
        onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        attributionControl={false}
        reuseMaps
      >
        <GeolocateControl position="top-right" />
        <NavigationControl position="top-right" showCompass={true} />

        {establishments.map((est) => (
          <Marker
            key={est.id}
            latitude={est.coordinates.lat}
            longitude={est.coordinates.lng}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedId(est.id);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.2 }}
              className={`p-2 rounded-full border-2 border-white shadow-lg cursor-pointer
                ${est.category === 'maquis' ? 'bg-orange-500' : 
                  est.category === 'lounge' ? 'bg-purple-500' : 
                  'bg-blue-500'}`}
            >
               <MapPin className="w-5 h-5 text-white fill-current" />
            </motion.div>
          </Marker>
        ))}

        {selectedEstablishment && (
          <Popup
            latitude={selectedEstablishment.coordinates.lat}
            longitude={selectedEstablishment.coordinates.lng}
            anchor="top"
            onClose={() => setSelectedId(null)}
            closeButton={false}
            className="z-50"
          >
             <div 
               className="p-2 min-w-[200px] cursor-pointer"
               onClick={() => setLocation(`/details/${selectedEstablishment.id}`)}
             >
                <h3 className="font-display font-bold text-lg text-slate-900">{selectedEstablishment.name}</h3>
                <p className="text-sm text-slate-600 capitalize">{selectedEstablishment.category} • {selectedEstablishment.commune}</p>
                <div className="mt-2 flex items-center text-primary font-medium text-sm">
                  <span>Voir détails</span>
                  <Navigation className="w-3 h-3 ml-1" />
                </div>
             </div>
          </Popup>
        )}
      </Map>
      
      {/* Gradient Overlay for better UI visibility */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-background/80 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
    </div>
  );
}
