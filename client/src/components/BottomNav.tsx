import { Link, useLocation } from 'wouter';
import { Map, List, User, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: '/', icon: Map, label: 'Carte' },
    { href: '/list', icon: List, label: 'Liste' },
    { href: '/business', icon: PlusCircle, label: 'Ajouter', highlight: true },
    { href: '/profile', icon: User, label: 'Profil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors duration-200 cursor-pointer",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                item.highlight && "text-primary font-bold"
              )}>
                <Icon className={cn(
                  "w-6 h-6",
                  isActive && "fill-current/20",
                  item.highlight && "w-8 h-8 -mt-4 bg-primary text-background rounded-full p-1.5 shadow-lg shadow-primary/40 box-content"
                )} />
                {!item.highlight && <span className="text-[10px] font-medium">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
