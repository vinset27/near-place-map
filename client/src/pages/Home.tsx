import React, { useState, useEffect } from 'react';
import MapView from '@/components/Map';
import BottomNav from '@/components/BottomNav';
import FilterBar from '@/components/FilterBar';

export default function Home() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();

  useEffect(() => {
    // Simulate getting user location - in real app, use geolocation API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      }, () => {
        // Default to Abidjan center if permission denied
        setUserLocation({ lat: 5.3261, lng: -4.0200 });
      });
    }
  }, []);

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden flex flex-col">
      <div className="flex-1 relative z-0">
        <MapView 
          userLocation={userLocation}
        />
        <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      </div>
      <BottomNav />
    </div>
  );
}
