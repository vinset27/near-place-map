import React from 'react';
import BottomNav from '@/components/BottomNav';
import { User, Settings, CreditCard, Heart, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function Profile() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold text-white mb-6">Mon Profil</h1>
        
        <div className="flex items-center space-x-4 mb-8">
          <Avatar className="w-20 h-20 border-2 border-primary">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-white">Alexandre Koffi</h2>
            <p className="text-muted-foreground">Abidjan, Côte d'Ivoire</p>
            <div className="mt-2 inline-flex px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold uppercase">
              Membre VIP
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <MenuLink icon={Heart} label="Mes Favoris" />
          <MenuLink icon={CreditCard} label="Abonnement" />
          <MenuLink icon={Settings} label="Paramètres" />
        </div>

        <Separator className="my-6 bg-white/10" />

        <Button variant="destructive" className="w-full justify-start pl-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border-none">
          <LogOut className="w-4 h-4 mr-3" />
          Se déconnecter
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

function MenuLink({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <button className="w-full flex items-center p-4 rounded-xl hover:bg-secondary transition-colors text-left group">
      <div className="w-10 h-10 rounded-full bg-secondary group-hover:bg-background flex items-center justify-center mr-4 transition-colors border border-white/5">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-base font-medium text-gray-200 group-hover:text-white flex-1">{label}</span>
      <span className="text-muted-foreground text-lg">›</span>
    </button>
  );
}
