export function buildAccountTrustorsFocusHref(serverCode: string) {
  return `/account/trustors?server=${encodeURIComponent(serverCode)}`;
}

export function buildAccountTrustorsCreateHref(serverCode: string) {
  return `${buildAccountTrustorsFocusHref(serverCode)}#create-trustor-${serverCode}`;
}
