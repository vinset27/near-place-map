import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Upload, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLocation } from 'wouter';
import BottomNav from '@/components/BottomNav';
import { apiRequest } from '@/lib/queryClient';
import { createEstablishment } from '@/lib/establishmentsApi';
import LocationPickerDialog from '@/components/LocationPickerDialog';
import { queryClient } from '@/lib/queryClient';

export default function Business() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('maquis');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [useAsDefault, setUseAsDefault] = useState(true);

  useEffect(() => {
    // load saved "fixed location" if present
    try {
      const slat = localStorage.getItem('business_fixed_lat');
      const slng = localStorage.getItem('business_fixed_lng');
      if (slat && slng && !lat && !lng) {
        setLat(slat);
        setLng(slng);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  const uploadSelectedPhotos = async () => {
    if (files.length === 0) return [];
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const presignRes = await apiRequest('POST', '/api/business/photos/presign', {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        });
        const presign = await presignRes.json();
        const putUrl = presign.url as string;
        const publicUrl = presign.publicUrl as string | undefined;
        if (!putUrl) throw new Error("Impossible d'uploader: URL signée manquante");
        if (!publicUrl) throw new Error("R2_PUBLIC_BASE_URL manquant côté serveur");

        const put = await fetch(putUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload R2 échoué (${put.status})`);
        urls.push(publicUrl);
      }
      setPhotoUrls(urls);
      return urls;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const lt = Number(lat);
    const lg = Number(lng);
    if (!Number.isFinite(lt) || !Number.isFinite(lg)) {
      setError("Choisis une position (Ma position ou Choisir sur la carte) avant de soumettre.");
      return;
    }
    setStep(2);
    try {
      const uploaded = await uploadSelectedPhotos();
      const res = await apiRequest('POST', '/api/business/apply', {
        name,
        category,
        phone,
        description,
        photos: uploaded,
        address,
        commune,
        lat: lt,
        lng: lg,
      });
      const data = await res.json();
      setRequestId(data.id);
      // Invalidate nearby lists (admin may approve quickly; user often returns to map right away).
      queryClient.invalidateQueries({ queryKey: ['db-establishments'] });
      queryClient.invalidateQueries({ queryKey: ['list-establishments'] });
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Soumission impossible');
      setStep(1);
    }
  };

  const handlePublishNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    setStep(2);
    try {
      const lt = Number(lat);
      const lg = Number(lng);
      if (!Number.isFinite(lt) || !Number.isFinite(lg)) {
        throw new Error("Lat/Lng invalides. Utilise 'Ma position' ou saisis des coordonnées.");
      }
      const uploaded = await uploadSelectedPhotos();
      const res = await createEstablishment({
        name,
        category,
        phone,
        description,
        address,
        commune,
        photos: uploaded,
        lat: lt,
        lng: lg,
      });
      if (useAsDefault) {
        try {
          localStorage.setItem('business_fixed_lat', String(lt));
          localStorage.setItem('business_fixed_lng', String(lg));
        } catch {}
      }
      setPublishedId(res?.establishment?.id || null);
      setStep(3);
    } catch (err: any) {
      setError(
        err?.message ||
          "Publication impossible. Connecte-toi comme établissement et complète ton profil (Profil).",
      );
      setStep(1);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Géolocalisation indisponible.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
      },
      () => setError("Impossible de récupérer ta position."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 border-b border-border flex items-center sticky top-0 bg-background/95 backdrop-blur z-10">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/app')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="ml-2 text-lg font-bold text-foreground">Espace Pro</h1>
      </div>

      <div className="p-6">
        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Inscrivez votre établissement</h2>
              <p className="text-muted-foreground mt-2 text-sm">Gagnez en visibilité et attirez plus de clients.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Nom de l'établissement</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Maquis Le Pilier"
                  className="bg-secondary border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-foreground">Catégorie</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                >
                  <option value="maquis">Maquis</option>
                  <option value="bar">Bar</option>
                  <option value="lounge">Lounge</option>
                  <option value="cave">Cave</option>
                  <option value="restaurant">Restaurant</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  placeholder="+225 07..."
                  className="bg-secondary border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc" className="text-foreground">Description</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décris l’ambiance, la spécialité, et les infos utiles."
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-foreground">Adresse</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rue, quartier…"
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commune" className="text-foreground">Commune</Label>
                <Input
                  id="commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="Cocody, Marcory…"
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Position sur la carte</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="Latitude"
                    className="bg-secondary border-border text-foreground"
                  />
                  <Input
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="Longitude"
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={useMyLocation} className="flex-1">
                    Ma position
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                    className="flex-1"
                  >
                    Choisir sur la carte
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={useAsDefault}
                    onChange={(e) => setUseAsDefault(e.target.checked)}
                  />
                  Utiliser cette position comme localisation fixe (par défaut)
                </label>
                <p className="text-xs text-muted-foreground">
                  Pour publier directement sur la carte, il faut être connecté en tant qu’établissement
                  (Profil) + profil complété.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-foreground">Photos</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-4">
                  <label className="flex flex-col items-center justify-center text-muted-foreground hover:bg-secondary/50 cursor-pointer transition-colors rounded-lg p-6">
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-xs text-center">
                      Ajouter 1 à 5 photos (JPG/PNG/WebP). L’upload se fait vers R2.
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const list = Array.from(e.target.files || []);
                        setFiles(list.slice(0, 5));
                        setPhotoUrls([]);
                      }}
                    />
                  </label>

                  {files.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {previews.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`photo-${idx + 1}`}
                          className="h-20 w-full rounded-lg object-cover border border-border"
                        />
                      ))}
                    </div>
                  )}

                  {photoUrls.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {photoUrls.length} photo(s) uploadée(s) ✅
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3">
              <Button
                type="submit"
                disabled={uploading}
                className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90"
              >
                Soumettre pour validation
              </Button>
              <Button
                type="button"
                onClick={handlePublishNow}
                disabled={uploading}
                variant="secondary"
                className="w-full h-12 text-lg font-bold"
              >
                Publier sur la carte (immédiat)
              </Button>
            </div>

            {error && (
              <div className="text-sm text-red-500 text-center">
                {error}
              </div>
            )}
          </form>
        )}

        {step === 2 && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in">
             <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
             <p className="text-foreground font-medium">Traitement en cours...</p>
          </div>
        )}

        {step === 3 && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-500">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Demande reçue !</h2>
            <p className="text-muted-foreground mb-8 max-w-xs">
              Votre établissement a été soumis avec succès. Notre équipe va vérifier les informations avant validation.
            </p>
            {requestId && (
              <p className="text-xs text-muted-foreground mb-4">
                ID demande: <span className="font-semibold">{requestId}</span>
              </p>
            )}
            {publishedId && (
              <p className="text-xs text-emerald-600 mb-4 font-semibold">
                Publié sur la carte ✅ (id: {publishedId})
              </p>
            )}
            <Button onClick={() => setLocation('/app')} variant="outline" className="w-full border-border text-foreground hover:bg-secondary">
              Retour à l'accueil
            </Button>
          </div>
        )}
      </div>
      
      <BottomNav />

      <LocationPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={
          lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
            ? { lat: Number(lat), lng: Number(lng) }
            : null
        }
        onPick={(v) => {
          setLat(String(v.lat));
          setLng(String(v.lng));
        }}
      />
    </div>
  );
}
