import React, { useState } from 'react';
import MapView from '@/components/Map';
import BottomNav from '@/components/BottomNav';
import FilterBar from '@/components/FilterBar';

export default function Home() {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden flex flex-col">
      <div className="flex-1 relative z-0">
        <MapView />
        <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      </div>
      <BottomNav />
    </div>
  );
}
