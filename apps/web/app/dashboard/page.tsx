import { auth, signOut } from "@/auth";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const user = session.user;

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
