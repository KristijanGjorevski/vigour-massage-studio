/**
 * Google OAuth redirect target. Opened in the top-level browser window (Google
 * can't run inside the Shopify admin iframe), so there's no Shopify session here —
 * the shop comes only from the signed `state` created by the dashboard action.
 */
import type { LoaderFunctionArgs } from "react-router";
import { handleOAuthCallback, verifyOAuthState } from "../services/googleCalendar.server";

/** Absolute URL back to this app inside the shop's admin. */
function adminAppUrl(shop: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}?${qs}`;
}

function errorPage(message: string, status = 400) {
  const safe = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Google Calendar</title>
     <body style="font-family:system-ui;max-width:560px;margin:60px auto;padding:0 16px">
     <h2>Поврзувањето со Google Calendar не успеа</h2><p>${safe}</p>
     <p>Вратете се во апликацијата во Shopify и обидете се повторно.</p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = verifyOAuthState(url.searchParams.get("state"));
  if (!shop) {
    return errorPage("Линкот за поврзување е невалиден или истечен (важи 10 минути).");
  }

  const error = url.searchParams.get("error");
  if (error) {
    return Response.redirect(adminAppUrl(shop, { google_error: error }), 302);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return errorPage("Недостасува авторизациски код од Google.");
  }

  try {
    await handleOAuthCallback(code, shop);
    return Response.redirect(adminAppUrl(shop, { google: "success" }), 302);
  } catch (err) {
    console.error("Error exchanging Google OAuth code:", err);
    return Response.redirect(adminAppUrl(shop, { google_error: err instanceof Error ? err.message : "unknown" }), 302);
  }
};
