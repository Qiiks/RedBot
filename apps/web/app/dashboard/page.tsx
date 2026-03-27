import { auth, signOut } from "@/auth";
import { getDashboardGuilds } from "@/app/dashboard/actions";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const user = session.user;
  const guilds = await getDashboardGuilds();

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name ?? "Unknown User"}</p>

      {user.image ? (
        <Image
          src={user.image}
          alt={`${user.name ?? "User"} avatar`}
          width={96}
          height={96}
        />
      ) : null}

      <section>
        <h2>Manageable Guilds</h2>
        {guilds.length === 0 ? (
          <p>No guilds with MANAGE_GUILD permission found.</p>
        ) : (
          <ul>
            {guilds.map((guild) => (
              <li key={guild.id}>
                <Link href={`/dashboard/${guild.id}`}>{guild.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
