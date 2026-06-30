// Nom d'équipe -> code ISO2 (pour générer le drapeau emoji)
const ISO = {
  Algeria: 'DZ', Argentina: 'AR', Australia: 'AU', Austria: 'AT', Belgium: 'BE',
  'Bosnia & Herzegovina': 'BA', Brazil: 'BR', Canada: 'CA', 'Cape Verde': 'CV',
  Colombia: 'CO', Croatia: 'HR', 'Curaçao': 'CW', 'Czech Republic': 'CZ',
  'DR Congo': 'CD', Ecuador: 'EC', Egypt: 'EG', France: 'FR', Germany: 'DE',
  Ghana: 'GH', Haiti: 'HT', Iran: 'IR', Iraq: 'IQ', 'Ivory Coast': 'CI',
  Japan: 'JP', Jordan: 'JO', Mexico: 'MX', Morocco: 'MA', Netherlands: 'NL',
  'New Zealand': 'NZ', Norway: 'NO', Panama: 'PA', Paraguay: 'PY', Portugal: 'PT',
  Qatar: 'QA', 'Saudi Arabia': 'SA', Senegal: 'SN', 'South Africa': 'ZA',
  'South Korea': 'KR', Spain: 'ES', Sweden: 'SE', Switzerland: 'CH',
  Tunisia: 'TN', Turkey: 'TR', USA: 'US', Uruguay: 'UY', Uzbekistan: 'UZ',
}

// Drapeaux des nations constitutives (pas de code ISO2 simple)
const SPECIAL = {
  England: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Scotland: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
}

export function flag(name) {
  if (SPECIAL[name]) return SPECIAL[name]
  const code = ISO[name]
  if (!code) return '' // clubs (Ligue 1, etc.) : pas de drapeau
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}
