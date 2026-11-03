import { authenticate } from "../shopify.server";

/**
 * Authenticates a storefront request that came through the Shopify App Proxy
 * (storefront /apps/vigour/* → app /proxy/*) and returns the verified shop domain.
 *
 * - Invalid/missing signature → 400 (thrown by authenticate.public.appProxy).
 * - Valid signature but the app isn't installed on that shop → 401.
 *
 * The shop comes from Shopify's signed query string, so callers can't spoof it.
 */
export async function requireProxyShop(request: Request): Promise<string> {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw Response.json({ error: "App is not installed on this shop." }, { status: 401 });
  }
  return session.shop;
}
