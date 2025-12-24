import React, { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { Settings, LogOut, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest, getQueryFn, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';

export default function Profile() {
  const { data } = useQuery<any | null>({
    queryKey: ['/api/auth/me'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/auth/login', { username, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const register = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/auth/register', { username, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logout = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/auth/logout'),
    onSuccess: async () => {
      await queryClient.setQueryData(['/api/auth/me'], null);
    },
  });

  const isAuthed = !!data?.user;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold text-foreground mb-6">
          {isAuthed ? 'Espace établissement' : 'Connexion établissement'}
        </h1>

        {!isAuthed ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={mode === 'login' ? 'default' : 'outline'} onClick={() => setMode('login')}>
                Connexion
              </Button>
              <Button variant={mode === 'register' ? 'default' : 'outline'} onClick={() => setMode('register')}>
                Inscription
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="space-y-2">
                <Label>Email / Téléphone</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="+225 07... ou email" />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
              </div>

              <Button
                className="w-full"
                onClick={() => (mode === 'login' ? login.mutate() : register.mutate())}
                disabled={login.isPending || register.isPending}
              >
                {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Connecté</div>
                <div className="text-base font-bold text-foreground">{data.user.username}</div>
              </div>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </div>

            <Separator className="my-2 bg-border" />

            <Button
              variant="destructive"
              className="w-full justify-start pl-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border-none"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut className="w-4 h-4 mr-3" />
              Se déconnecter
            </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
