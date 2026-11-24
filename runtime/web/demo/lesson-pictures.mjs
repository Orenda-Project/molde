// The pictures the three example lessons (lang/lessons/*.json) refer to, drawn as small SVGs so the
// page needs no outside files. A real lesson bundle ships its own pictures; the host maps each
// `ref` to one (render.mjs opts.resolveImage).
const svg = (w, h, body) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="16" fill="#f6f3ec"/>${body}</svg>`);
const ink = '#2b3440';

export const PICTURES = {
  // a round roti cut into two equal halves, pulled a little apart
  'img/roti-cut-in-two.png': svg(320, 180, `
    <path d="M152 40 A62 62 0 0 0 152 164 Z" fill="#e2b46a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M168 40 A62 62 0 0 1 168 164 Z" fill="#e2b46a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <g fill="#b9853a" opacity=".55"><circle cx="122" cy="80" r="5"/><circle cx="132" cy="128" r="4"/><circle cx="108" cy="110" r="3"/><circle cx="196" cy="92" r="4"/><circle cx="210" cy="126" r="5"/><circle cx="186" cy="140" r="3"/></g>
    <text x="110" y="24" font-family="sans-serif" font-size="16" fill="${ink}" text-anchor="middle">1/2</text>
    <text x="210" y="24" font-family="sans-serif" font-size="16" fill="${ink}" text-anchor="middle">1/2</text>`),
  // a square in four equal parts, one shaded
  'img/square-in-four.png': svg(320, 180, `
    <rect x="90" y="20" width="140" height="140" fill="#fff" stroke="${ink}" stroke-width="3"/>
    <rect x="90" y="20" width="70" height="70" fill="#3d7fd6"/>
    <path d="M160 20 V160 M90 90 H230" stroke="${ink}" stroke-width="3"/>
    <rect x="90" y="20" width="140" height="140" fill="none" stroke="${ink}" stroke-width="3"/>
    <text x="125" y="61" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">1/4</text>`),
  // the water cycle: sun, sea, evaporation arrows, cloud, rain on a hill, a river back to the sea
  'img/water-cycle.png': svg(320, 200, `
    <circle cx="48" cy="44" r="20" fill="#f4b740"/>
    <g stroke="#f4b740" stroke-width="3" stroke-linecap="round"><path d="M48 12v-6M48 82v-6M16 44h-6M86 44h-6M25 21l-4-4M75 71l-4-4M25 67l-4 4M75 17l-4 4"/></g>
    <path d="M0 160 Q40 152 80 160 T160 160 V200 H0 Z" fill="#3d7fd6"/>
    <path d="M150 200 L230 110 L320 160 V200 Z" fill="#7fb069"/>
    <path d="M230 110 L246 128 L214 128 Z" fill="#fff"/>
    <path d="M300 200 C280 186 230 186 160 182" stroke="#3d7fd6" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g fill="#fff" stroke="#9aa7b5" stroke-width="2"><ellipse cx="200" cy="52" rx="44" ry="20"/><ellipse cx="236" cy="44" rx="30" ry="18"/><ellipse cx="170" cy="48" rx="26" ry="16"/></g>
    <g stroke="#3d7fd6" stroke-width="3" stroke-linecap="round"><path d="M190 80l-5 12M210 82l-5 12M230 80l-5 12M250 76l-5 12"/></g>
    <g stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="5 6"><path d="M60 150 C70 120 110 90 150 70"/><path d="M90 152 C104 126 132 104 160 86"/></g>
    <g font-family="sans-serif" font-size="12" fill="${ink}"><text x="8" y="104">evaporation</text><text x="166" y="24">condensation</text><text x="252" y="100">rain</text><text x="10" y="190" fill="#fff">sea</text></g>`),
};
export const resolvePicture = ref => PICTURES[ref] || null;
