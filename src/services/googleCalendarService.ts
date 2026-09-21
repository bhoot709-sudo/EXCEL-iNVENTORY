import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { app } from '../lib/firebase';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
CALENDAR_SCOPES.forEach(scope => provider.addScope(scope));

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might have expired or refreshed; if not cached, auth state listener notifies
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleCalendar = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No OAuth access token was returned from Google sign in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Calendar sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCalendarAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedCalendarAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signOutGoogleCalendar = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO String
  endDateTime: string;   // ISO String
  timeZone?: string;
}

/**
 * Fetch calendar events within a given timeframe (default: current month +/- 15 days)
 */
export async function listGoogleCalendarEvents(
  token: string,
  timeMin?: string,
  timeMax?: string,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent[]> {
  const min = timeMin || new Date(Date.now() - 15 * 86400000).toISOString();
  const max = timeMax || new Date(Date.now() + 30 * 86400000).toISOString();

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('timeMin', min);
  url.searchParams.set('timeMax', max);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '50');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('Google Calendar access token expired or invalid. Please sign in again.');
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Google Calendar API error: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.items || []) as GoogleCalendarEvent[];
}

/**
 * Create a new event on Google Calendar
 */
export async function createGoogleCalendarEvent(
  token: string,
  input: CreateEventInput,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const payload = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: {
      dateTime: input.startDateTime,
      timeZone: input.timeZone || 'Asia/Kathmandu',
    },
    end: {
      dateTime: input.endDateTime,
      timeZone: input.timeZone || 'Asia/Kathmandu',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('Google Calendar access token expired or invalid. Please sign in again.');
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to create event: ${res.statusText}`);
  }

  return (await res.json()) as GoogleCalendarEvent;
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  token: string,
  eventId: string,
  calendarId: string = 'primary'
): Promise<boolean> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 204 && res.status !== 410) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('Google Calendar access token expired. Please sign in again.');
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to delete calendar event: ${res.statusText}`);
  }

  return true;
}
