import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useLocationStore } from '../stores/useLocationStore';
import type { Coordinates } from '../types/establishment';
import type { RouteStep } from './mapboxDirections';
import { haversineDistance, formatDistance } from './location';

const TASK_NAME = 'nearplace-nav-location';

type NavSession = {
  active: boolean;
  mode: 'driving' | 'walking' | 'bicycling';
  destinationName?: string;
  steps: RouteStep[];
  nextStepIdx: number;
  lastAnnouncedIdx: number;
  lastAnnouncedAt: number;
};

let session: NavSession | null = null;

function getModeThresholdMeters(mode: NavSession['mode']): number {
  // When to warn user before the maneuver location.
  if (mode === 'driving') return 120;
  if (mode === 'bicycling') return 70;
  return 45; // walking
}

function normalizeTurnText(step: RouteStep): { title: string; body: string } {
  const mod = String(step?.maneuver?.modifier || '').toLowerCase();
  const isLeft = mod.includes('left') || mod.includes('gauche');
  const isRight = mod.includes('right') || mod.includes('droite');
  const dir = isLeft ? 'à gauche' : isRight ? 'à droite' : '';
  const body = step.instruction || 'Continuez';
  const title = dir ? `Tournez ${dir}` : 'Prochaine étape';
  return { title, body };
}

async function ensureNotifPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync().catch(() => null as any);
  if (current?.granted) return true;
  const req = await Notifications.requestPermissionsAsync().catch(() => null as any);
  return !!req?.granted;
}

async function notifyTurn(step: RouteStep, distanceM: number) {
  const ok = await ensureNotifPermission();
  if (!ok) return;
  const t = normalizeTurnText(step);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t.title,
      body: `${t.body} • ${formatDistance(distanceM)}`,
      sound: true,
    },
    trigger: null,
  });
}

function getCoordsFromLocation(loc: Location.LocationObject): Coordinates | null {
  const c = loc?.coords;
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
  return { lat: c.latitude, lng: c.longitude };
}

function computeDistanceToStepManeuver(user: Coordinates, step: RouteStep): number {
  const m = step?.maneuver?.location;
  if (!m || !Array.isArray(m) || m.length < 2) return Number.POSITIVE_INFINITY;
  const to = { lat: Number(m[1]), lng: Number(m[0]) };
  if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng)) return Number.POSITIVE_INFINITY;
  return haversineDistance(user, to);
}

function tickTurnAlerts(user: Coordinates) {
  if (!session?.active) return;
  const steps = session.steps || [];
  if (!steps.length) return;

  const idx = Math.max(0, Math.min(session.nextStepIdx || 0, steps.length - 1));
  const step = steps[idx];
  const dist = computeDistanceToStepManeuver(user, step);

  // Advance step if passed
  if (dist < 18 && idx < steps.length - 1) {
    session.nextStepIdx = idx + 1;
    return;
  }

  const threshold = getModeThresholdMeters(session.mode);
  const now = Date.now();
  const shouldAnnounce = dist <= threshold && idx !== session.lastAnnouncedIdx && now - session.lastAnnouncedAt > 25_000;
  if (shouldAnnounce) {
    session.lastAnnouncedIdx = idx;
    session.lastAnnouncedAt = now;
    // Fire and forget
    void notifyTurn(step, dist);
  }
}

// Background task definition (runs when OS delivers background locations)
TaskManager.defineTask(TASK_NAME, ({ data, error }) => {
  if (error) return;
  const locations = (data as any)?.locations as Location.LocationObject[] | undefined;
  if (!locations?.length) return;
  const last = locations[locations.length - 1];
  const coords = getCoordsFromLocation(last);
  if (!coords) return;
  // Update app-wide store
  useLocationStore.getState().setUserLocation(coords);
  // Turn notifications
  tickTurnAlerts(coords);
});

export async function startNavigationBackgroundTracking() {
  // Expo Go limitation: background tasks are not reliable; we still keep foreground follow.
  if ((Constants as any).appOwnership === 'expo') {
    console.warn('[NavBG] Expo Go detected: background location is limited. Use a dev build for background navigation.');
    return;
  }
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (started) return;
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Highest,
    timeInterval: 2000,
    distanceInterval: 10,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // Android foreground service keeps the task alive during navigation.
    foregroundService: {
      notificationTitle: "O'Show navigation",
      notificationBody: 'Suivi en cours…',
      notificationColor: '#2563eb',
    },
  });
}

export async function stopNavigationBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(TASK_NAME);
}

export async function isNavigationBackgroundTrackingRunning(): Promise<boolean> {
  return await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
}

export function setNavigationSession(input: {
  active: boolean;
  mode: NavSession['mode'];
  destinationName?: string;
  steps: RouteStep[];
}) {
  if (!input.active) {
    session = null;
    return;
  }
  session = {
    active: true,
    mode: input.mode,
    destinationName: input.destinationName,
    steps: input.steps || [],
    nextStepIdx: 0,
    lastAnnouncedIdx: -1,
    lastAnnouncedAt: 0,
  };
}




