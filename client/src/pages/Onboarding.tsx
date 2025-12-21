import React from 'react';
import { useLocation } from 'wouter';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function Onboarding() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mb-8 relative"
      >
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        <MapPin className="w-10 h-10 text-primary" />
      </motion.div>

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-display font-bold text-center mb-4 text-white"
      >
        Activez la localisation
      </motion.h1>

      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-muted-foreground mb-12 max-w-xs"
      >
        O'Show a besoin de votre position pour vous montrer les meilleurs endroits autour de vous.
      </motion.p>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm space-y-3"
      >
        <Button 
          onClick={() => setLocation('/')} 
          className="w-full h-12 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Navigation className="w-5 h-5 mr-2" />
          Autoriser l'accès
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="w-full text-muted-foreground hover:text-white"
        >
          Continuer sans GPS
        </Button>
      </motion.div>
    </div>
  );
}
