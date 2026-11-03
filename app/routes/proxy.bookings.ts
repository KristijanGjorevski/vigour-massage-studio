/**
 * Storefront booking API, reached via the Shopify App Proxy:
 *   GET  /apps/vigour/bookings?date=YYYY-MM-DD[&serviceId=…]  → services + free slots
 *   GET  /apps/vigour/bookings?nextSlot=true                  → next free slot
 *   POST /apps/vigour/bookings                                → create appointment
 * Every request is signature-verified; the shop comes from Shopify, not the client.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { createGoogleCalendarEvent } from "../services/googleCalendar.server";
import { requireProxyShop } from "../services/proxy.server";
import {
  WORKING_SLOTS,
  findNextFreeSlot,
  getAvailableSlots,
  isValidDateStr,
  isValidTimeStr,
  studioTimeToUtc,
} from "../services/schedule.server";

const DEFAULT_DURATION_MIN = 60;

const MAX_LEN = { name: 100, email: 254, phone: 40, notes: 1000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function json(body: unknown, status = 200) {
  // No caching: availability changes with every booking.
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function getOrSeedServices(shop: string) {
  let services = await prisma.service.findMany({ where: { shop }, orderBy: { price: "asc" } });
  if (services.length === 0) {
    await prisma.service.createMany({ data: VIGOUR_SERVICES.map((s) => ({ shop, ...s })) });
    services = await prisma.service.findMany({ where: { shop }, orderBy: { price: "asc" } });
  }
  return services;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const shop = await requireProxyShop(request);

  const url = new URL(request.url);
  const dateStr = url.searchParams.get("date");
  const serviceId = url.searchParams.get("serviceId");
  const nextSlotReq = url.searchParams.get("nextSlot") === "true";

  const services = await getOrSeedServices(shop);

  // Next free slot for the hero banner (based on the entry-level service)
  if (nextSlotReq) {
    const featured = services[0];
    const next = await findNextFreeSlot(shop, featured?.duration ?? DEFAULT_DURATION_MIN);
    return json({
      success: true,
      nextSlot: next && {
        date: next.date,
        time: next.time,
        serviceName: featured?.name || "Релакс масажа",
      },
    });
  }

  // Available slots for a date, sized to the chosen service (if given)
  let availableSlots: string[] = [];
  if (dateStr) {
    if (!isValidDateStr(dateStr)) {
      return json({ error: "Невалиден датум." }, 400);
    }
    const selected = serviceId ? services.find((s) => s.id === serviceId) : undefined;
    availableSlots = await getAvailableSlots(shop, dateStr, selected?.duration ?? DEFAULT_DURATION_MIN);
  }

  return json({ success: true, shop, services, availableSlots });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const shop = await requireProxyShop(request);

  try {
    const body = await request.json().catch(() => null);
    const { serviceId, date, timeSlot } = body ?? {};
    const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
    const customerEmail = typeof body?.customerEmail === "string" ? body.customerEmail.trim() : "";
    const customerPhone = typeof body?.customerPhone === "string" ? body.customerPhone.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (typeof serviceId !== "string" || !serviceId || !customerName || !customerEmail || !date || !timeSlot) {
      return json({ error: "Недостасуваат задолжителни податоци за резервација." }, 400);
    }

    if (
      !EMAIL_RE.test(customerEmail) ||
      customerName.length > MAX_LEN.name ||
      customerEmail.length > MAX_LEN.email ||
      customerPhone.length > MAX_LEN.phone ||
      notes.length > MAX_LEN.notes
    ) {
      return json({ error: "Проверете ги внесените податоци (име, е-пошта, телефон)." }, 400);
    }

    if (!isValidDateStr(date) || !isValidTimeStr(timeSlot) || !WORKING_SLOTS.includes(timeSlot)) {
      return json({ error: "Невалиден датум или термин." }, 400);
    }

    const service = await prisma.service.findFirst({ where: { id: serviceId, shop } });
    if (!service) {
      return json({ error: "Избраниот третман не постои. Освежете ја страната и обидете се повторно." }, 400);
    }

    // Re-check availability (DB + Google Calendar) at booking time
    const freeSlots = await getAvailableSlots(shop, date, service.duration);
    if (!freeSlots.includes(timeSlot)) {
      return json({ error: "Овој термин е веќе зафатен. Ве молиме изберете друг час." }, 409);
    }

    const startTime = studioTimeToUtc(date, timeSlot);
    const endTime = new Date(startTime.getTime() + service.duration * 60_000);

    // Create the appointment, guarding against a parallel booking for the same time
    const appointment = await prisma.$transaction(async (tx) => {
      const clash = await tx.appointment.findFirst({
        where: {
          shop,
          status: { in: ["confirmed", "pending"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (clash) return null;

      return tx.appointment.create({
        data: {
          shop,
          serviceId: service.id,
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          notes: notes || null,
          startTime,
          endTime,
          status: "confirmed",
        },
        include: { service: true },
      });
    });

    if (!appointment) {
      return json({ error: "Овој термин е веќе зафатен. Ве молиме изберете друг час." }, 409);
    }

    // Google Calendar sync (best effort — booking stands even if this fails)
    const googleEventId = await createGoogleCalendarEvent(shop, {
      customerName: appointment.customerName,
      customerEmail: appointment.customerEmail,
      customerPhone: appointment.customerPhone,
      notes: appointment.notes,
      serviceName: service.name,
      startTime,
      endTime,
    });
    if (googleEventId) {
      await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId } });
    }

    return json(
      {
        success: true,
        message: "Терминот е успешно потврден!",
        appointment: { ...appointment, googleEventId },
      },
      201,
    );
  } catch (error) {
    console.error("Error creating appointment:", error);
    return json({ error: "Грешка при процесирање на резервацијата. Обидете се повторно." }, 500);
  }
};
