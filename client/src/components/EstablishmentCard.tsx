import { Establishment } from '@/lib/data';
import { Star, MapPin, Hotel, UtensilsCrossed, Wine, Martini } from 'lucide-react';
import { Link } from 'wouter';

interface EstablishmentCardProps {
  establishment: Establishment;
}

export default function EstablishmentCard({ establishment }: EstablishmentCardProps) {
  const CategoryGlyph = (() => {
    switch (establishment.category) {
      case "restaurant":
      case "maquis":
        return UtensilsCrossed;
      case "bar":
        return Martini;
      case "cave":
        return Wine;
      case "hotel":
        return Hotel;
      default:
        return MapPin;
    }
  })();

  return (
    <Link href={`/details/${establishment.id}`}>
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer group">
        <div className="relative h-32 w-full overflow-hidden">
          <img 
            src={establishment.imageUrl} 
            alt={establishment.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full flex items-center space-x-1">
            <Star className="w-3 h-3 text-yellow-400 fill-current" />
            <span className="text-xs font-bold text-white">{establishment.rating}</span>
          </div>
          <div className="absolute bottom-2 left-2">
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
               ${establishment.isOpen ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
               {establishment.isOpen ? 'Ouvert' : 'Fermé'}
             </span>
          </div>
          <div className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center border border-white/20">
            <CategoryGlyph className="h-4 w-4 text-white" />
          </div>
        </div>
        
        <div className="p-3">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-display font-bold text-lg leading-tight truncate pr-2">{establishment.name}</h3>
          </div>
          
          <div className="flex items-center text-muted-foreground text-xs mb-2">
            <MapPin className="w-3 h-3 mr-1" />
            <span className="truncate">{establishment.commune} • {establishment.address}</span>
          </div>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {establishment.features.slice(0, 2).map((feature, i) => (
              <span key={i} className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/60">
                {feature}
              </span>
            ))}
             {establishment.features.length > 2 && (
              <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/60">
                +{establishment.features.length - 2}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
