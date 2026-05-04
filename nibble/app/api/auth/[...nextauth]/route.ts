import { handlers } from "@/auth";

// NextAuth v5 retorna { handlers: { GET, POST }, signIn, signOut, auth } desde NextAuth().
// Re-exportamos GET/POST aquí. Maneja /signin, /signout, /callback, etc.
// Nota: la página de login está en `/login` (configurada en auth.ts → pages.signIn).
export const { GET, POST } = handlers;
