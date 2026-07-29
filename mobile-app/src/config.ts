const rawWebAppUrl = process.env.EXPO_PUBLIC_TRADEFX_URL?.trim();

export const WEB_APP_URL =
  rawWebAppUrl && rawWebAppUrl.length > 0
    ? rawWebAppUrl.replace(/\/$/, "")
    : "https://your-tradefx-domain.com";

export const WEB_APP_ORIGIN = (() => {
  try {
    return new URL(WEB_APP_URL).origin;
  } catch {
    return WEB_APP_URL;
  }
})();
