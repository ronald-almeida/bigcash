// Only explicit app origins may mutate data through an external hosting proxy.
// Never infer trust from forwarded headers or from a *.vercel.app wildcard.
export function allowedMutationOrigin(
  origin: string | null,
  requestUrl: string,
  allowedOrigins = "",
): boolean {
  if (!origin || origin === "null") return false;
  return (
    origin === new URL(requestUrl).origin ||
    allowedOrigins.split(",").some((allowed) => allowed.trim() === origin)
  );
}
