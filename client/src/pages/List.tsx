import React from 'react';
import EstablishmentCard from '@/components/EstablishmentCard';
import BottomNav from '@/components/BottomNav';
import { establishments } from '@/lib/data';
import { Search } from 'lucide-react';

export default function List() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-white/5 px-4 py-4">
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">À proximité</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Filtrer la liste..." 
            className="w-full bg-secondary/50 border-none rounded-lg py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {establishments.map((est) => (
          <EstablishmentCard key={est.id} establishment={est} />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
