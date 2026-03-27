import { auth } from "@/auth";
import Link from "next/link";

export default async function HomePage(): Promise<JSX.Element> {
  const session = await auth();
  const hasDiscordAuth = Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET);

  if (session?.user) {
    return (
      <main>
        <h1>RedBot Dashboard</h1>
        <p>Signed in as {session.user.name ?? "Unknown User"}</p>

        <p>
          <a href="/api/auth/signout?callbackUrl=/">Sign out</a>
        </p>

        <p>
          <Link href="/dashboard">Go to dashboard</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>RedBot Dashboard</h1>

      {hasDiscordAuth ? (
        <p>
          <a href="/api/auth/signin/discord?callbackUrl=/dashboard">Login with Discord</a>
        </p>
      ) : (
        <p>Discord auth is not configured yet.</p>
      )}
    </main>
  );
}
