export function buildAccountTrustorsFocusHref(serverCode: string) {
  return `/account/trustors?server=${encodeURIComponent(serverCode)}`;
}
