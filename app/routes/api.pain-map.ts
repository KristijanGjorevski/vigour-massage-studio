import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "najdo-website.myshopify.com";

  let zones = await prisma.painZone.findMany({
    where: { shop },
    orderBy: { sortOrder: "asc" },
  });

  return Response.json(
    {
      success: true,
      zones,
    },
    { headers: corsHeaders }
  );
};
