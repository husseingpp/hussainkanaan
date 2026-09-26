import { getRequestConfig } from "next-intl/server";
import { findLocale, getDefaultLocale } from "./locales";
import { loadMessages } from "./messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const fallback = await getDefaultLocale();
  const locale = (requested && (await findLocale(requested))?.code) || fallback.code;

  return {
    locale,
    messages: await loadMessages(locale, fallback.code),
    timeZone: "Asia/Beirut",
  };
});
