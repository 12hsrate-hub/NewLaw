export function buildAccountCharactersFocusHref(serverCode: string) {
  return `/account/characters?server=${encodeURIComponent(serverCode)}`;
}

export function buildAccountCharactersBridgeHref(serverCode: string) {
  return `${buildAccountCharactersFocusHref(serverCode)}#create-character-${serverCode}`;
}
