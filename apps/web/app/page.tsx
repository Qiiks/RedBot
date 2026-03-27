import { auth, signIn, signOut } from "@/auth";
import Link from "next/link";

export default async function HomePage(): Promise<JSX.Element> {
  const session = await auth();

  if (session?.user) {
    return (
      <main>
        <h1>RedBot Dashboard</h1>
        <p>Signed in as {session.user.name ?? "Unknown User"}</p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit">Sign out</button>
        </form>

        <p>
          <Link href="/dashboard">Go to dashboard</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>RedBot Dashboard</h1>

      <form
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/dashboard" });
        }}
      >
        <button type="submit">Login with Discord</button>
      </form>
    </main>
  );
}
