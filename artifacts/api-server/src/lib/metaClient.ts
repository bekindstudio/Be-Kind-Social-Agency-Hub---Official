export async function exchangeForLongLivedToken(
  shortToken: string,
): Promise<{ token: string; expires: Date }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID o META_APP_SECRET non configurati");
  }

  const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  const token = String(payload.access_token ?? "");
  if (!token) {
    throw new Error("Meta token exchange returned an empty token");
  }
  const expiresIn = Number(payload.expires_in ?? 5_184_000);
  const expires = new Date(Date.now() + expiresIn * 1000);
  return { token, expires };
}
