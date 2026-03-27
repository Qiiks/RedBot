import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@redbot/db";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Discord from "next-auth/providers/discord";

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
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

const discordClientId = getOptionalEnv("AUTH_DISCORD_ID");
const discordClientSecret = getOptionalEnv("AUTH_DISCORD_SECRET");

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db as never),
  secret: getOptionalEnv("AUTH_SECRET") ?? getOptionalEnv("NEXTAUTH_SECRET"),
  session: {
    strategy: "database"
  },
  providers:
    discordClientId && discordClientSecret
      ? [
          Discord({
            clientId: discordClientId,
            clientSecret: discordClientSecret
          })
        ]
      : [],
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
};

export function auth() {
  return getServerSession(authOptions);
}
