import type { LoaderFunctionArgs } from "react-router";
import { getAuthUrl } from "../services/googleCalendar.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "najdo-website.myshopify.com";

  try {
    const authUrl = await getAuthUrl(shop);
    if (!authUrl) {
      return Response.json(
        { error: "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
        { status: 500 }
      );
    }
    return Response.redirect(authUrl);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
