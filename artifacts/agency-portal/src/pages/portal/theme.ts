/**
 * Palette del portale cliente: base calda color crema + accento verde salvia
 * Be Kind attenuato. Uguale per tutti i clienti (l'identità arriva da logo, nome
 * e foto di copertina). Isola auto-contenuta: hex diretti, non i token del
 * cockpit, così il look "app" non dipende dal tema dell'agenzia.
 */
export const T = {
  sage: "#7a8f5c",
  sageDark: "#5f7047",
  forest: "#2f3c21",
  sageSoft: "rgba(122,143,92,0.12)",
  cream: "#f6f2e9",
  creamDeep: "#efe9dc",
  card: "#ffffff",
  cardBorder: "#ece6d8",
  ink: "#2c2a24",
  muted: "#8c8674",
  softMuted: "#b8b2a2",
};

/** Stack serif elegante per i titoli hero, stile magazine di viaggio. */
export const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';

/** Gradiente di fallback quando manca la foto di copertina. */
export const heroGradient = `linear-gradient(150deg, ${T.sage}, ${T.forest})`;
