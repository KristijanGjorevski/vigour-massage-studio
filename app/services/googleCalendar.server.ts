import prisma from "../db.server";

// Dynamic import or require for googleapis so it runs cleanly across build & runtime environments
let googleModule: any = null;
async function getGoogleApi() {
  if (!googleModule) {
    try {
      googleModule = await import("googleapis");
    } catch (e) {
      console.warn("googleapis package is still being installed or unavailable", e);
    }
  }
  return googleModule?.google || null;
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export async function getOAuth2Client() {
  const google = await getGoogleApi();
  if (!google) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID || "vigour-google-client-id";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "vigour-google-client-secret";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google-callback";

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthUrl(shop: string) {
  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) return null;

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: shop,
  });
}

export async function handleOAuthCallback(code: string, shop: string) {
  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) throw new Error("Google OAuth client unavailable");

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing tokens in Google OAuth response");
  }

  const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

  return await prisma.googleAuth.upsert({
    where: { shop },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: expiry,
      updatedAt: new Date(),
    },
    create: {
      shop,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: expiry,
    },
  });
}

export async function getAuthenticatedCalendar(shop: string) {
  const authRecord = await prisma.googleAuth.findUnique({
    where: { shop },
  });

  if (!authRecord) return null;

  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) return null;

  oauth2Client.setCredentials({
    access_token: authRecord.accessToken,
    refresh_token: authRecord.refreshToken,
  });

  // Token refresh handling
  if (authRecord.tokenExpiry.getTime() <= Date.now()) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      const newTokens = refreshed.credentials;
      if (newTokens.access_token) {
        await prisma.googleAuth.update({
          where: { shop },
          data: {
            accessToken: newTokens.access_token,
            tokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
          },
        });
      }
    } catch (err) {
      console.error("Failed to refresh Google access token for shop:", shop, err);
      return null;
    }
  }

  const google = await getGoogleApi();
  return google.calendar({ version: "v3", auth: oauth2Client });
}

async function getCalendarId(shop: string): Promise<string> {
  const rec = await prisma.googleAuth.findUnique({ where: { shop }, select: { calendarId: true } });
  return rec?.calendarId || "primary";
}

/**
 * Busy intervals from Darko's Google Calendar between two instants.
 * Uses the FreeBusy API, so events marked "free"/transparent are ignored and
 * events of any length or start time block every slot they overlap.
 */
export async function getBusyIntervals(
  shop: string,
  timeMin: Date,
  timeMax: Date,
): Promise<{ start: Date; end: Date }[]> {
  try {
    const calendar = await getAuthenticatedCalendar(shop);
    if (!calendar) return [];

    const calendarId = await getCalendarId(shop);
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: "Europe/Skopje",
        items: [{ id: calendarId }],
      },
    });

    const busy = response.data.calendars?.[calendarId]?.busy || [];
    return busy
      .filter((b: any) => b.start && b.end)
      .map((b: any) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch (err) {
    console.error("Error fetching Google Calendar busy intervals:", err);
    return [];
  }
}

/**
 * Creates an event in Darko's Google Calendar for confirmed appointments
 */
export async function createGoogleCalendarEvent(
  shop: string,
  appointment: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string | null;
    notes?: string | null;
    serviceName: string;
    startTime: Date;
    endTime: Date;
  }
): Promise<string | null> {
  try {
    const calendar = await getAuthenticatedCalendar(shop);
    if (!calendar) return null;

    const event = {
      summary: `Масажа: ${appointment.customerName} (${appointment.serviceName})`,
      description: `Клиент: ${appointment.customerName}\nТел: ${appointment.customerPhone || "Не е наведен"}\nЕ-пошта: ${appointment.customerEmail}\nУслуга: ${appointment.serviceName}\nНапомена: ${appointment.notes || "Нема"}\n\nVigour Massage Studio - Автоматска онлајн резервација`,
      location: "Vigour Massage Studio, Скопје",
      start: {
        dateTime: appointment.startTime.toISOString(),
        timeZone: "Europe/Skopje",
      },
      end: {
        dateTime: appointment.endTime.toISOString(),
        timeZone: "Europe/Skopje",
      },
      colorId: "2", // Sage/Green color in Google Calendar
    };

    const res = await calendar.events.insert({
      calendarId: await getCalendarId(shop),
      requestBody: event,
    });

    return res.data.id || null;
  } catch (err) {
    console.error("Error creating Google Calendar event:", err);
    return null;
  }
}
