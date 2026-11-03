import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { getDarkoBusySlots, createGoogleCalendarEvent } from "../services/googleCalendar.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Vigour Massage Studio Default Seed Services (from Flyer in MKD)
const VIGOUR_SERVICES = [
  {
    name: "Релакс масажа - Цело тело",
    description: "Нежни и флуидни движења за ослободување од акумулиран стрес, подобра циркулација и длабока смиреност за целото тело.",
    price: 1300.0,
    duration: 60,
  },
  {
    name: "Спортска масажа - Цело тело",
    description: "Длабоко-ткивен притисок, истегнување и таргетирање на мускулните јазли за забрзано закрепнување по тренинг.",
    price: 1500.0,
    duration: 60,
  },
  {
    name: "Релакс масажа - Грб",
    description: "Фокусиран третман на грбот, рамениот појас и вратот за брзо олеснување на затегнатоста од седење пред компјутер.",
    price: 800.0,
    duration: 45,
  },
  {
    name: "Спортска масажа - Грб",
    description: "Интензивна терапија за 'рбетниот столб, лопатките и трапезите. Го зголемува опсегот на движење.",
    price: 1000.0,
    duration: 45,
  },
  {
    name: "Масажа на стапала (Рефлексологија)",
    description: "Стимулација на акупресурните рефлексни точки на стапалото што го ослободува заморот и тежината во нозете.",
    price: 500.0,
    duration: 45,
  },
  {
    name: "Премиум масажа - Цело тело напред и назад",
    description: "Најкомплетниот спа ритуал: комбинација на терапевтски притисок и релакс техники за целото тело и скалпот.",
    price: 2500.0,
    duration: 75,
  },
];

const WORKING_SLOTS = [
  "10:00",
  "11:15",
  "12:30",
  "14:00",
  "15:15",
  "16:30",
  "17:45",
  "19:00",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "najdo-website.myshopify.com";
  const dateStr = url.searchParams.get("date");
  const nextSlotReq = url.searchParams.get("nextSlot") === "true";

  // Fetch or Seed Services
  let services = await prisma.service.findMany({
    where: { shop },
    orderBy: { price: "asc" },
  });

  if (services.length === 0) {
    await prisma.service.createMany({
      data: VIGOUR_SERVICES.map((s) => ({
        shop,
        ...s,
      })),
    });

    services = await prisma.service.findMany({
      where: { shop },
      orderBy: { price: "asc" },
    });
  }

  // Handle Next Free Slot request for Hero banner
  if (nextSlotReq) {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Check today first
    let targetDateStr = todayStr;
    const currentHour = today.getHours();
    
    // If after 18:00, recommend tomorrow morning
    if (currentHour >= 18) {
      targetDateStr = tomorrowStr;
    }

    // Get busy slots from DB and Google Calendar
    const [existingAppointments, gcalBusy] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          shop,
          status: { in: ["confirmed", "pending"] },
          startTime: {
            gte: new Date(`${targetDateStr}T00:00:00.000Z`),
            lt: new Date(`${targetDateStr}T23:59:59.000Z`),
          },
        },
      }),
      getDarkoBusySlots(shop, targetDateStr),
    ]);

    const bookedHours = new Set<string>();
    existingAppointments.forEach((app) => {
      const d = new Date(app.startTime);
      bookedHours.add(`${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`);
    });
    gcalBusy.forEach((s) => bookedHours.add(s));

    // Find next available slot
    let nextAvailableTime = WORKING_SLOTS.find((slot) => {
      if (bookedHours.has(slot)) return false;
      if (targetDateStr === todayStr) {
        const [h, m] = slot.split(":").map(Number);
        if (h <= currentHour) return false;
      }
      return true;
    });

    if (!nextAvailableTime) {
      // Look at tomorrow
      targetDateStr = tomorrowStr;
      nextAvailableTime = WORKING_SLOTS[0] || "10:00";
    }

    return Response.json(
      {
        success: true,
        nextSlot: {
          date: targetDateStr,
          time: nextAvailableTime,
          serviceName: services[0]?.name || "Релакс масажа",
        },
      },
      { headers: corsHeaders }
    );
  }

  // Calculate available slots for given date
  let availableSlots: string[] = [];
  if (dateStr) {
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const [existingAppointments, gcalBusy] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          shop,
          status: { in: ["confirmed", "pending"] },
          startTime: {
            gte: targetDate,
            lt: nextDay,
          },
        },
      }),
      getDarkoBusySlots(shop, dateStr),
    ]);

    const bookedHours = new Set<string>();
    existingAppointments.forEach((app) => {
      const d = new Date(app.startTime);
      bookedHours.add(`${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`);
    });
    gcalBusy.forEach((slot) => bookedHours.add(slot));

    availableSlots = WORKING_SLOTS.filter((slot) => !bookedHours.has(slot));
  }

  return Response.json(
    {
      success: true,
      shop,
      services,
      availableSlots,
    },
    { headers: corsHeaders }
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const {
      shop,
      serviceId,
      customerName,
      customerEmail,
      customerPhone,
      date,
      timeSlot,
      notes,
    } = body;

    if (!shop || !serviceId || !customerName || !customerEmail || !date || !timeSlot) {
      return Response.json(
        { error: "Недостасуваат задолжителни податоци за резервација." },
        { status: 400, headers: corsHeaders }
      );
    }

    let service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      // Fallback: look up by name or return first active service
      service = await prisma.service.findFirst({
        where: { shop },
      });
    }

    const duration = service ? service.duration : 60;
    const startDateTime = new Date(`${date}T${timeSlot}:00.000Z`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    // Check collision in DB
    const collision = await prisma.appointment.findFirst({
      where: {
        shop,
        status: { in: ["confirmed", "pending"] },
        startTime: startDateTime,
      },
    });

    if (collision) {
      return Response.json(
        { error: "Овој термин е веќе зафатен. Ве молиме изберете друг час." },
        { status: 409, headers: corsHeaders }
      );
    }

    // Google Calendar Sync: insert event
    let googleEventId: string | null = null;
    try {
      googleEventId = await createGoogleCalendarEvent(shop, {
        customerName,
        customerEmail,
        customerPhone,
        notes,
        serviceName: service ? service.name : "Масажа",
        startTime: startDateTime,
        endTime: endDateTime,
      });
    } catch (gcalErr) {
      console.warn("Could not sync appointment to Google Calendar:", gcalErr);
    }

    // Create DB Appointment
    const appointment = await prisma.appointment.create({
      data: {
        shop,
        serviceId: service ? service.id : serviceId,
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        notes: notes || null,
        startTime: startDateTime,
        endTime: endDateTime,
        status: "confirmed",
        googleEventId,
      },
      include: {
        service: true,
      },
    });

    return Response.json(
      {
        success: true,
        message: "Терминот е успешно потврден!",
        appointment,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error creating appointment:", error);
    return Response.json(
      { error: "Грешка при процесирање на резервацијата. Обидете се повторно." },
      { status: 500, headers: corsHeaders }
    );
  }
};
