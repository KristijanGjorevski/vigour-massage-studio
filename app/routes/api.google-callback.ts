import type { LoaderFunctionArgs } from "react-router";
import { handleOAuthCallback } from "../services/googleCalendar.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("state") || "najdo-website.myshopify.com";
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(`/app?google_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return Response.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    await handleOAuthCallback(code, shop);
    return Response.redirect(`/app?google=success`);
  } catch (err: any) {
    console.error("Error exchanging Google OAuth code:", err);
    return Response.redirect(`/app?google_error=${encodeURIComponent(err.message)}`);
  }
};
