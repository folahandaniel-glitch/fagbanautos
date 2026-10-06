/** Simple, consistent product illustrations (centred on 0,0; roughly 280 units wide) used when no real photo exists yet. */
const B = "#0b3a8f", G = "#c9a227", N = "#071f4d", L = "#dbe6fb";

const ICONS: Record<string, string> = {
  seat: `<path d="M-70 -120 q-20 0 -20 22 l0 120 q0 30 30 30 l120 0 q30 0 30 -30 l0 -20 l-110 0 l0 -100 q0 -22 -20 -22z" fill="${B}"/><rect x="-60" y="-100" width="100" height="120" rx="22" fill="${L}"/><rect x="-100" y="62" width="200" height="26" rx="10" fill="${G}"/>`,
  mat: `<path d="M-100 -90 h200 l22 160 h-244z" fill="${B}"/><path d="M-80 -70 h160 l16 120 h-192z" fill="${L}"/><g stroke="${B}" stroke-width="5" opacity=".5"><path d="M-60 -50 l-8 90 M-20 -50 l-4 90 M20 -50 l4 90 M60 -50 l8 90"/></g>`,
  steering: `<circle r="100" fill="none" stroke="${B}" stroke-width="30"/><circle r="26" fill="${G}"/><path d="M-100 0 h-0 M0 -26 v-70 M-24 12 l-64 50 M24 12 l64 50" stroke="${B}" stroke-width="22" stroke-linecap="round"/>`,
  light: `<path d="M-90 -60 q130 -50 180 40 q0 70 -90 80 q-110 -10 -90 -120z" fill="${B}"/><circle cx="20" cy="-10" r="42" fill="${L}"/><circle cx="20" cy="-10" r="20" fill="${G}"/><g stroke="${G}" stroke-width="10" stroke-linecap="round"><path d="M-120 -30 h-30 M-120 10 h-40 M-120 50 h-30"/></g>`,
  camera: `<rect x="-110" y="-60" width="220" height="130" rx="22" fill="${B}"/><circle cx="-10" cy="5" r="46" fill="${L}"/><circle cx="-10" cy="5" r="26" fill="${N}"/><circle cx="-10" cy="5" r="9" fill="${G}"/><rect x="60" y="-40" width="34" height="22" rx="6" fill="${G}"/><rect x="-40" y="-100" width="100" height="40" rx="10" fill="${N}"/>`,
  battery: `<rect x="-110" y="-70" width="220" height="140" rx="16" fill="${B}"/><rect x="-80" y="-100" width="40" height="30" rx="6" fill="${N}"/><rect x="40" y="-100" width="40" height="30" rx="6" fill="${N}"/><path d="M-70 -10 h40 M50 -30 v40 M30 -10 h40" stroke="${G}" stroke-width="14" stroke-linecap="round"/><rect x="-100" y="30" width="200" height="30" rx="8" fill="${L}" opacity=".5"/>`,
  filter: `<rect x="-80" y="-100" width="160" height="200" rx="26" fill="${B}"/><rect x="-96" y="-120" width="192" height="36" rx="14" fill="${N}"/><g stroke="${L}" stroke-width="10" stroke-linecap="round"><path d="M-44 -50 v110 M-14 -50 v110 M16 -50 v110 M46 -50 v110"/></g><rect x="-96" y="86" width="192" height="26" rx="10" fill="${G}"/>`,
  brake: `<circle r="110" fill="${B}"/><circle r="84" fill="${L}"/><circle r="30" fill="${N}"/><g fill="${B}"><circle cx="0" cy="-56" r="11"/><circle cx="48" cy="-28" r="11"/><circle cx="48" cy="28" r="11"/><circle cx="0" cy="56" r="11"/><circle cx="-48" cy="28" r="11"/><circle cx="-48" cy="-28" r="11"/></g><path d="M70 -90 a120 120 0 0 1 60 90 l-40 8 a80 80 0 0 0 -34 -62z" fill="${G}"/>`,
  tyre: `<circle r="115" fill="${N}"/><circle r="82" fill="${B}"/><circle r="52" fill="${L}"/><circle r="14" fill="${G}"/><g stroke="${B}" stroke-width="12" stroke-linecap="round"><path d="M0 -50 v-30 M43 -25 l26 -15 M43 25 l26 15 M0 50 v30 M-43 25 l-26 15 M-43 -25 l-26 -15" opacity=".0"/></g>`,
  charger: `<rect x="-62" y="-110" width="124" height="220" rx="26" fill="${B}"/><rect x="-48" y="-92" width="96" height="150" rx="12" fill="${L}"/><path d="M8 -70 l-34 62 h26 l-10 52 l40 -70 h-28z" fill="${G}"/><circle cy="86" r="10" fill="${L}"/>`,
  speaker: `<rect x="-90" y="-110" width="180" height="220" rx="26" fill="${B}"/><circle cy="-34" r="50" fill="${L}"/><circle cy="-34" r="22" fill="${N}"/><circle cy="58" r="30" fill="${L}"/><circle cy="58" r="12" fill="${N}"/><circle cy="-34" r="64" fill="none" stroke="${G}" stroke-width="8"/>`,
  clean: `<path d="M-30 -60 h60 v30 q40 10 40 60 v70 q0 22 -22 22 h-96 q-22 0 -22 -22 v-70 q0 -50 40 -60z" fill="${B}"/><rect x="-26" y="-100" width="52" height="40" rx="8" fill="${N}"/><rect x="26" y="-96" width="60" height="16" rx="8" fill="${G}"/><rect x="-60" y="10" width="120" height="60" rx="10" fill="${L}"/><g fill="${G}"><circle cx="110" cy="-96" r="7"/><circle cx="128" cy="-76" r="5"/><circle cx="104" cy="-72" r="4"/></g>`,
  security: `<path d="M0 -118 l100 36 v66 q0 78 -100 124 q-100 -46 -100 -124 v-66z" fill="${B}"/><path d="M0 -92 l76 28 v50 q0 56 -76 94 q-76 -38 -76 -94 v-50z" fill="${L}"/><path d="M-34 4 l26 28 l50 -56" fill="none" stroke="${G}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`,
  cover: `<path d="M-130 70 q0 -70 50 -86 l40 -50 q16 -20 46 -20 h40 q40 0 62 36 l24 40 q40 14 40 80 z" fill="${B}"/><path d="M-100 70 q10 -50 48 -62 l32 -40 h100 l30 40 q40 8 46 62z" fill="${L}" opacity=".35"/><rect x="-130" y="66" width="260" height="20" rx="8" fill="${G}"/>`,
  engine: `<rect x="-100" y="-60" width="200" height="130" rx="18" fill="${B}"/><rect x="-60" y="-100" width="120" height="44" rx="10" fill="${N}"/><circle cx="-50" cy="5" r="30" fill="${L}"/><circle cx="50" cy="5" r="30" fill="${L}"/><circle cx="-50" cy="5" r="10" fill="${G}"/><circle cx="50" cy="5" r="10" fill="${G}"/><rect x="-80" y="70" width="160" height="22" rx="8" fill="${G}"/>`,
  wrench: `<path d="M70 -100 a60 60 0 0 0 -70 80 l-90 90 a22 22 0 0 0 32 32 l90 -90 a60 60 0 0 0 80 -70 l-40 40 l-36 -10 l-10 -36z" fill="${B}"/><circle cx="-72" cy="86" r="10" fill="${G}"/>`,
};

const RULES: [RegExp, string][] = [
  [/seat|cushion|headrest|pillow/i, "seat"], [/mat|carpet|liner/i, "mat"], [/steering/i, "steering"], [/dashcam|camera|reverse|parking|gps|tracker|monitor/i, "camera"],
  [/light|lamp|led|ambient|headlight|fog|tail/i, "light"], [/battery|alternator|starter|ignition|spark|coil/i, "battery"], [/filter/i, "filter"], [/brake|disc|rotor|pad|caliper/i, "brake"],
  [/tyre|tire|wheel|rim/i, "tyre"], [/charger|phone|holder|usb|carplay|android|wi-?fi|head unit|screen/i, "charger"], [/speaker|amplifier|subwoofer|audio/i, "speaker"],
  [/clean|polish|wash|wax|shine|towel|vacuum|detail|freshener|spray|kit/i, "clean"], [/security|alarm|immobil|guard|tint|film|protection/i, "security"], [/cover|shade|visor|flap|moulding/i, "cover"],
  [/engine|radiator|pump|belt|gasket|piston|exhaust|fuel|sensor|shock|suspension|control arm|joint|transmission/i, "engine"],
];

export function iconFor(label: string): string {
  for (const [re, id] of RULES) if (re.test(label)) return ICONS[id];
  return ICONS.wrench;
}
