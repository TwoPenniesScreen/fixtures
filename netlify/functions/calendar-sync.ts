import type { Context } from "@netlify/functions";
import { syncCalendar } from "./_shared/sync-calendar.ts";

export default async (_req: Request, context: Context) => {
  await syncCalendar(context);
};
