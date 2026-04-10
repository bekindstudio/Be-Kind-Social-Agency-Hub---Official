export {};

declare global {
  namespace Express {
    interface Request {
      /** `sub` del JWT Supabase dopo verifica del Bearer token */
      supabaseUserId?: string | null;
    }
  }
}
