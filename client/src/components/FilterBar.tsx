import { Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function FilterBar({ activeFilter, onFilterChange }: FilterBarProps) {
  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'maquis', label: 'Maquis' },
    { id: 'bar', label: 'Bars' },
    { id: 'lounge', label: 'Lounges' },
    { id: 'cave', label: 'Caves' },
  ];

  return (
    <div className="absolute top-4 left-0 right-0 z-10 px-4 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <input 
          type="text" 
          placeholder="Rechercher un lieu..." 
          className="w-full bg-background/80 backdrop-blur-xl border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
        />
        <div className="absolute inset-y-0 right-3 flex items-center">
          <div className="bg-secondary p-1 rounded-full">
            <Filter className="h-3 w-3 text-foreground" />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shadow-sm border",
              activeFilter === filter.id 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-background/80 backdrop-blur-md text-foreground border-white/10 hover:bg-secondary"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
