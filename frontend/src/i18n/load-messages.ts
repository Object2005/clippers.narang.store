import type { AbstractIntlMessages } from "next-intl";

import { applyCurrencySymbol } from "@/lib/billing-provider";

import { NAMESPACES, type Locale } from "./config";

export async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const messages = (await import(`../../messages/${locale}/${namespace}.json`)).default as AbstractIntlMessages;
      return [namespace, messages] as const;
    }),
  );

  return applyCurrencySymbol(Object.fromEntries(entries));
}
