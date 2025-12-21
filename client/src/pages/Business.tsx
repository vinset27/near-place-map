import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Upload, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLocation } from 'wouter';
import BottomNav from '@/components/BottomNav';

export default function Business() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    // Simulate submission
    setTimeout(() => {
      setStep(3);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 border-b border-white/5 flex items-center sticky top-0 bg-background/95 backdrop-blur z-10">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="ml-2 text-lg font-bold text-white">Espace Pro</h1>
      </div>

      <div className="p-6">
        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold text-white">Inscrivez votre établissement</h2>
              <p className="text-muted-foreground mt-2 text-sm">Gagnez en visibilité et attirez plus de clients.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Nom de l'établissement</Label>
                <Input id="name" placeholder="Ex: Maquis Le Pilier" className="bg-secondary border-white/10 text-white" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-white">Catégorie</Label>
                <select className="flex h-10 w-full rounded-md border border-white/10 bg-secondary px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
                  <option value="maquis">Maquis</option>
                  <option value="bar">Bar</option>
                  <option value="lounge">Lounge</option>
                  <option value="cave">Cave</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">Téléphone</Label>
                <Input id="phone" type="tel" placeholder="+225 07..." className="bg-secondary border-white/10 text-white" required />
              </div>
              
              <div className="space-y-2">
                <Label className="text-white">Photos</Label>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground hover:bg-secondary/50 cursor-pointer transition-colors">
                  <Upload className="w-8 h-8 mb-2" />
                  <span className="text-xs">Cliquez pour ajouter des photos</span>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 mt-8">
              Soumettre la demande
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in">
             <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
             <p className="text-white font-medium">Traitement en cours...</p>
          </div>
        )}

        {step === 3 && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-500">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Demande reçue !</h2>
            <p className="text-muted-foreground mb-8 max-w-xs">
              Votre établissement a été soumis avec succès. Notre équipe va vérifier les informations avant validation.
            </p>
            <Button onClick={() => setLocation('/')} variant="outline" className="w-full border-white/10 text-white hover:bg-secondary">
              Retour à l'accueil
            </Button>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  );
}
