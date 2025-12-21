import React, { useState } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl, Popup, ViewStateChangeEvent } from 'react-map-gl';
import { establishments } from '@/lib/data';
import { MapPin, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import RouteLayer from './RouteLayer';
import { RouteInfo } from '@/lib/routing';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidHJvdXZlcmNoYXAiLCJhIjoiY21qZzk4ZHExMTE2cjNkc2R5YnhvYnRqYyJ9.kLaJ7Fd3pBs8NzF6vOTwcA';

interface MapViewProps {
  interactive?: boolean;
  userLocation?: { lat: number; lng: number };
  highlightedId?: string;
}

export default function MapView({ interactive = true, userLocation, highlightedId }: MapViewProps) {
  const [viewState, setViewState] = useState({
    latitude: 5.3261,
    longitude: -4.0200,
    zoom: 13,
    bearing: 0,
    pitch: 0
  });

  const [selectedId, setSelectedId] = useState<string | null>(highlightedId || null);
  const [, setLocation] = useLocation();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const userLoc = userLocation || { lat: 5.3261, lng: -4.0200 };
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

        {/* User Location Marker */}
        <Marker
          latitude={userLoc.lat}
          longitude={userLoc.lng}
          anchor="center"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-3 h-3 bg-blue-400 rounded-full border-4 border-blue-300 shadow-lg"
          />
        </Marker>

        {/* Establishment Markers */}
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
              animate={{ scale: selectedId === est.id ? 1.3 : 1, opacity: 1 }}
              whileHover={{ scale: 1.2 }}
              className={`p-2 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all
                ${est.category === 'maquis' ? 'bg-orange-500' : 
                  est.category === 'lounge' ? 'bg-purple-500' : 
                  'bg-blue-500'}
                ${selectedId === est.id ? 'ring-4 ring-yellow-300' : ''}`}
            >
               <MapPin className="w-5 h-5 text-white fill-current" />
            </motion.div>
          </Marker>
        ))}

        {/* Route Layer */}
        {selectedEstablishment && (
          <RouteLayer
            userLat={userLoc.lat}
            userLng={userLoc.lng}
            destLat={selectedEstablishment.coordinates.lat}
            destLng={selectedEstablishment.coordinates.lng}
            onRouteUpdate={setRouteInfo}
          />
        )}

        {/* Popup */}
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
               className="p-3 min-w-[220px] cursor-pointer"
               onClick={() => setLocation(`/details/${selectedEstablishment.id}`)}
             >
                <h3 className="font-display font-bold text-lg text-slate-900">{selectedEstablishment.name}</h3>
                <p className="text-sm text-slate-600 capitalize mb-2">{selectedEstablishment.category} • {selectedEstablishment.commune}</p>
                
                {routeInfo && (
                  <div className="bg-blue-50 rounded-lg p-2 mb-2 text-xs space-y-1">
                    <div className="flex justify-between text-blue-900 font-medium">
                      <span>{(routeInfo.distance / 1000).toFixed(1)} km</span>
                      <span>{Math.round(routeInfo.duration / 60)} min</span>
                    </div>
                  </div>
                )}
                
                <div className="mt-3 flex items-center text-primary font-medium text-sm">
                  <span>Voir itinéraire</span>
                  <Navigation className="w-3 h-3 ml-1" />
                </div>
             </div>
          </Popup>
        )}
      </Map>
      
      {/* Gradient Overlays */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-background/80 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
    </div>
  );
}
