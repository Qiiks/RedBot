import { getGuildSettingsForDashboard, updateGuildSettings } from "@/app/dashboard/actions";
import Link from "next/link";

type GuildSettingsPageProps = {
  params: {
    guildId: string;
  };
};

export default async function GuildSettingsPage({ params }: GuildSettingsPageProps): Promise<JSX.Element> {
  if (!process.env.AUTH_DISCORD_ID || !process.env.AUTH_DISCORD_SECRET) {
    return (
      <main>
        <p>Discord auth is not configured for this deployment.</p>
      </main>
    );
  }

  const { guildId } = params;
  const { guild, settings } = await getGuildSettingsForDashboard(guildId);

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to Dashboard</Link>
      </p>

      <h1>{guild.name} Settings</h1>
      <p>Guild ID: {guild.id}</p>

      <form
        action={async (formData) => {
          "use server";
          await updateGuildSettings(guildId, formData);
        }}
      >
        <div>
          <label htmlFor="logChannelId">Log Channel ID</label>
          <input id="logChannelId" name="logChannelId" type="text" defaultValue={settings.logChannelId} />
        </div>

        <div>
          <label htmlFor="contentSnapshotsEnabled">Enable Content Snapshots</label>
          <input
            id="contentSnapshotsEnabled"
            name="contentSnapshotsEnabled"
            type="checkbox"
            defaultChecked={settings.contentSnapshotsEnabled}
          />
        </div>

        <div>
          <label htmlFor="musicQueueFairness">Music Queue Fairness</label>
          <select id="musicQueueFairness" name="musicQueueFairness" defaultValue={settings.musicQueueFairness}>
            <option value="ROUND_ROBIN">ROUND_ROBIN</option>
            <option value="FIFO">FIFO</option>
          </select>
        </div>

        <button type="submit">Save Settings</button>
      </form>
    </main>
  );
}
