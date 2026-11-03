/** Storefront exercise programs, via the App Proxy: GET /apps/vigour/exercises[?category=…] */
import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { requireProxyShop } from "../services/proxy.server";

const DEFAULT_PROGRAMS = [
  {
    title: "Програма за врат и рамена (Канцелариска декомпресија)",
    description: "Кратки и ефективни дневни вежби за ослободување на напнатоста во горниот трапез и вратот по долго седење.",
    price: 0,
    category: "neck_shoulders",
    difficulty: "почетник",
    sortOrder: 1,
    exercises: [
      {
        title: "Истегнување на вратна мускулатура и трапез",
        description: "Латерално истегнување со фокус на дишење за олабавување на спазмите.",
        videoId: "dQw4w9WgXcQ", // Placeholder YouTube ID / Vigour unlisted video
        duration: 120, // 2 mins
        sortOrder: 1,
      },
      {
        title: "Кружна мобилизација на лопатките",
        description: "Враќање на природната подвижност на рамениот зглоб и отворање на градниот кош.",
        videoId: "dQw4w9WgXcQ",
        duration: 180, // 3 mins
        sortOrder: 2,
      },
      {
        title: "Изометриско зајакнување на длабоките вратни флексори",
        description: "Спречува повторна појава на болка и го стабилизира држењето на главата.",
        videoId: "dQw4w9WgXcQ",
        duration: 150, // 2.5 mins
        sortOrder: 3,
      },
    ],
  },
  {
    title: "Програма за долен грб и мобилност на колкови",
    description: "Таргетирани вежби за декомпресија на лумбалниот 'рбет и ослободување на затегнатите колкови.",
    price: 0,
    category: "lower_back",
    difficulty: "среден",
    sortOrder: 2,
    exercises: [
      {
        title: "Мачка-Крава (Cat-Cow) со сегментално движење",
        description: "Флуидна мобилизација на 'рбетниот столб за подобра циркулација на дискусите.",
        videoId: "dQw4w9WgXcQ",
        duration: 180,
        sortOrder: 1,
      },
      {
        title: "Пириформис истегнување (Олеснување на ишијас)",
        description: "Ослободување на длабокиот мускул под глутеусот кој врши притисок врз ишијасниот нерв.",
        videoId: "dQw4w9WgXcQ",
        duration: 240,
        sortOrder: 2,
      },
      {
        title: "Глутеален мост со задршка",
        description: "Активација на седалните мускули кои го штитат долниот грб при одење и стоење.",
        videoId: "dQw4w9WgXcQ",
        duration: 210,
        sortOrder: 3,
      },
    ],
  },
  {
    title: "Пост-масажна рутина за регенерација на цело тело",
    description: "Како правилно да го продолжите ефектот од масажата со лесни фасцијални движења и рехидратација.",
    price: 0,
    category: "post_massage",
    difficulty: "почетник",
    sortOrder: 3,
    exercises: [
      {
        title: "Фасцијално истегнување на целото тело",
        description: "Нежни позиции за опуштање на површинската мускулна обвивка.",
        videoId: "dQw4w9WgXcQ",
        duration: 300,
        sortOrder: 1,
      },
    ],
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const shop = await requireProxyShop(request);

  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  // Query programs from DB
  let programs = await prisma.program.findMany({
    where: {
      shop,
      ...(category ? { category } : {}),
    },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Seed default Vigour programs if empty
  if (programs.length === 0) {
    for (const progData of DEFAULT_PROGRAMS) {
      const { exercises, ...programFields } = progData;
      await prisma.program.create({
        data: {
          shop,
          ...programFields,
          exercises: {
            create: exercises.map((ex) => ({
              shop,
              ...ex,
            })),
          },
        },
      });
    }

    programs = await prisma.program.findMany({
      where: { shop },
      include: {
        exercises: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  return Response.json(
    {
      success: true,
      programs,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
};
