import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifierIdentifiants } from "@/services/comptes";

// EF-15 : connexion par e-mail et mot de passe. La session est un jeton signé dans un cookie
// httpOnly ; il ne porte que l'identifiant du compte. Le rôle et l'équipe sont relus en base
// à chaque action (src/lib/session.ts), donc un changement de rôle s'applique tout de suite.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(c) {
        const u = await verifierIdentifiants(String(c?.email ?? ""), String(c?.password ?? ""));
        return u ? { id: String(u.id), email: u.email, name: u.nom } : null;
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
