import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef, type ViewStateChangeEvent } from "react-map-gl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MAPBOX_TOKEN } from "@/lib/mapbox";

type LatLng = { lat: number; lng: number };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value?: LatLng | null;
  onPick: (v: LatLng) => void;
  title?: string;
};

export default function LocationPickerDialog({
  open,
  onOpenChange,
  value,
  onPick,
  title = "Choisir un point sur la carte",
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [picked, setPicked] = useState<LatLng | null>(value ?? null);
  const [viewState, setViewState] = useState({
    latitude: value?.lat ?? 5.3261,
    longitude: value?.lng ?? -4.02,
    zoom: 15,
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    if (!open) return;
    // default to current GPS if no value yet
    if (value) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const v = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPicked(v);
        setViewState((p) => ({ ...p, latitude: v.lat, longitude: v.lng, zoom: Math.max(p.zoom, 16) }));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, [open, value]);

  const canConfirm = Boolean(picked);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-none h-[calc(100vh-2rem)] p-0 overflow-hidden">
        <div className="h-full flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
            <DialogTitle>{title}</DialogTitle>
            <div className="text-xs text-muted-foreground">
              Appuie sur la carte pour placer le point. Tu peux zoomer/rotater.
            </div>
          </DialogHeader>

          <div className="flex-1 relative">
            <Map
              ref={mapRef}
              {...viewState}
              onMove={(e: ViewStateChangeEvent) => setViewState(e.viewState)}
              onClick={(e) => {
                const v = { lat: e.lngLat.lat, lng: e.lngLat.lng };
                setPicked(v);
              }}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              mapboxAccessToken={MAPBOX_TOKEN}
              reuseMaps
              attributionControl={false}
              style={{ width: "100%", height: "100%" }}
            >
              {picked && (
                <Marker latitude={picked.lat} longitude={picked.lng} anchor="center">
                  <div className="h-4 w-4 rounded-full bg-primary border-2 border-white shadow" />
                </Marker>
              )}
            </Map>

            <div className="absolute bottom-4 left-0 right-0 px-4 pb-safe">
              <div className="mx-auto max-w-xl rounded-2xl bg-background/90 backdrop-blur-xl border border-border p-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground min-w-0">
                  {picked ? (
                    <span className="truncate">
                      {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
                    </span>
                  ) : (
                    "Choisis un point"
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    type="button"
                    className="h-10"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => {
                      if (!picked) return;
                      onPick(picked);
                      onOpenChange(false);
                    }}
                    disabled={!canConfirm}
                    type="button"
                    className="h-10"
                  >
                    Confirmer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}




