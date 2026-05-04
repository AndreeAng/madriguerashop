import { auth } from "@/auth";

export default auth((req) => {
  // El callback `authorized` en auth.ts ya maneja la redirección.
  // Si no autorizado en /admin o /dashboard, NextAuth redirige a /login automáticamente.

  // Aquí podríamos agregar lógica adicional (ej. logging, rewrite por slug),
  // pero por ahora el comportamiento por default es suficiente.

  return undefined;
});

export const config = {
  // Aplica a todo EXCEPTO archivos estáticos, _next, api/auth (que se maneja solo)
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|uploads|.*\\..*).*)",
  ],
};
