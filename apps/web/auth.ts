import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@redbot/db";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database"
  },
  providers: [
    Discord({
      clientId: requireEnv("AUTH_DISCORD_ID"),
      clientSecret: requireEnv("AUTH_DISCORD_SECRET")
    })
  ],
  pages: {
    signIn: "/"
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    }
  }
});
