// Vercel Function (single entry) per l'intera API.
//
// In un progetto "Other" (framework: null) le route dinamiche/catch-all file-based
// di Next.js NON sono supportate, quindi usiamo UNA sola function e un rewrite
// `/api/(.*) -> /api` in vercel.json. Con `destination: "/api"` Vercel seleziona
// questa function ma preserva l'URL originale in req.url, così l'app Express —
// montata su "/api" — instrada nativamente tutti i path (anche multi-segmento).
export { default } from "../artifacts/api-server/src/vercel";
