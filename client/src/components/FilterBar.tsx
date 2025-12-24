import { Search, Filter, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  radiusKm: 5 | 10 | 25;
  onRadiusKmChange: (r: 5 | 10 | 25) => void;
  showEvents: boolean;
  onShowEventsChange: (v: boolean) => void;
}

export default function FilterBar({
  activeFilter,
  onFilterChange,
  query,
  onQueryChange,
  radiusKm,
  onRadiusKmChange,
  showEvents,
  onShowEventsChange,
}: FilterBarProps) {
  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'maquis', label: 'Maquis' },
    { id: 'bar', label: 'Bars' },
    { id: 'lounge', label: 'Lounges' },
    { id: 'cave', label: 'Caves' },
    { id: 'restaurant', label: 'Restaurants' },
    { id: 'hotel', label: 'Hôtels' },
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
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full bg-background/80 backdrop-blur-xl border border-border/60 rounded-full py-2.5 pl-10 pr-4 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
        />
        <div className="absolute inset-y-0 right-3 flex items-center">
          <div className="bg-secondary p-1 rounded-full">
            <Filter className="h-3 w-3 text-foreground" />
          </div>
        </div>
      </div>

      {/* Radius + Events */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-muted-foreground">Rayon</div>
          <div className="flex gap-2">
          {[5, 10, 25].map((r) => (
            <button
              key={r}
              onClick={() => onRadiusKmChange(r as 5 | 10 | 25)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                radiusKm === r
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/80 backdrop-blur-md text-foreground border-border/60 hover:bg-secondary",
              )}
            >
              {r}km
            </button>
          ))}
          </div>
        </div>

        <button
          onClick={() => onShowEventsChange(!showEvents)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-2",
            showEvents
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-background/80 backdrop-blur-md text-foreground border-border/60 hover:bg-secondary",
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Événements
        </button>
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
                : "bg-background/80 backdrop-blur-md text-foreground border-border/60 hover:bg-secondary"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
