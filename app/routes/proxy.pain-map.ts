/** Storefront pain-map zones, via the App Proxy: GET /apps/vigour/pain-map */
import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { requireProxyShop } from "../services/proxy.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const shop = await requireProxyShop(request);

  const zones = await prisma.painZone.findMany({
    where: { shop },
    orderBy: { sortOrder: "asc" },
  });

  return Response.json({ success: true, zones }, { headers: { "Cache-Control": "no-store" } });
};
