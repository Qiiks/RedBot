import { db } from "@redbot/db";
import { LoadType, type Player, type Shoukaku, type Track } from "shoukaku";

type QueueFairness = "FIFO" | "ROUND_ROBIN";

type QueueItem = {
  track: Track;
  requestedByUserId: string;
  enqueuedAt: number;
};

type GuildMusicState = {
  queue: QueueItem[];
  nowPlaying: QueueItem | null;
  idleTimer: NodeJS.Timeout | null;
};

export type ResolveTrackResult = {
  track: Track;
  sourceQuery: string;
  loadType: LoadType;
};

const DEFAULT_IDLE_TIMEOUT_MS = 300_000;
const SEARCH_PREFIX_PATTERN = /^[a-z]+search:/i;

function hasSearchPrefix(query: string): boolean {
  return SEARCH_PREFIX_PATTERN.test(query.trim());
}

function normalizeQuery(query: string): string {
  return query.trim();
}

function isTrackLike(value: unknown): value is Track {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Track>;
  return typeof candidate.encoded === "string" && !!candidate.info && typeof candidate.info === "object";
}

function compareQueueOrder(a: QueueItem, b: QueueItem): number {
  return a.enqueuedAt - b.enqueuedAt;
}

export class MusicManager {
  private readonly shoukaku: Shoukaku;
  private readonly states = new Map<string, GuildMusicState>();

  public constructor(shoukaku: Shoukaku) {
    this.shoukaku = shoukaku;
  }

  public async resolveTrack(query: string): Promise<ResolveTrackResult> {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) {
      throw new Error("Track query is required");
    }

    const node = this.shoukaku.getIdealNode();
    if (!node) {
      throw new Error("No Lavalink nodes are currently available");
    }

    const primaryQuery = normalizedQuery;
    const primaryResult = await node.rest.resolve(primaryQuery);
    const primaryTrack = this.pickTrackFromLoadResult(primaryResult?.loadType, primaryResult?.data);
    if (primaryTrack) {
      return {
        track: primaryTrack,
        sourceQuery: primaryQuery,
        loadType: primaryResult?.loadType ?? LoadType.SEARCH
      };
    }

    if (!hasSearchPrefix(normalizedQuery)) {
      const fallbackQuery = `ytsearch:${normalizedQuery}`;
      const fallbackResult = await node.rest.resolve(fallbackQuery);
      const fallbackTrack = this.pickTrackFromLoadResult(fallbackResult?.loadType, fallbackResult?.data);

      if (fallbackTrack) {
        return {
          track: fallbackTrack,
          sourceQuery: fallbackQuery,
          loadType: fallbackResult?.loadType ?? LoadType.SEARCH
        };
      }
    }

    throw new Error(`No playable track found for query: ${normalizedQuery}`);
  }

  public async enqueueTrack(input: {
    guildId: string;
    userId: string;
    track: Track;
  }): Promise<number> {
    const state = this.getOrCreateState(input.guildId);
    state.queue.push({
      track: input.track,
      requestedByUserId: input.userId,
      enqueuedAt: Date.now()
    });

    this.clearIdleTimer(input.guildId);
    return state.queue.length;
  }

  public async getNextTrack(guildId: string): Promise<QueueItem | null> {
    const state = this.getOrCreateState(guildId);
    if (state.queue.length === 0) {
      return null;
    }

    const fairness = await this.getGuildQueueFairness(guildId);
    const next = fairness === "ROUND_ROBIN" ? this.dequeueRoundRobin(state) : this.dequeueFifo(state);

    state.nowPlaying = next;
    return next;
  }

  public async onPlaybackStopped(input: {
    guildId: string;
    player: Player;
  }): Promise<void> {
    const state = this.getOrCreateState(input.guildId);
    state.nowPlaying = null;

    if (state.queue.length > 0) {
      return;
    }

    const idleTimeoutMs = await this.getGuildIdleTimeoutMs(input.guildId);
    this.startIdleTimer(input.guildId, idleTimeoutMs, input.player);
  }

  public clearGuildState(guildId: string): void {
    this.clearIdleTimer(guildId);
    this.states.delete(guildId);
  }

  private getOrCreateState(guildId: string): GuildMusicState {
    const existing = this.states.get(guildId);
    if (existing) {
      return existing;
    }

    const created: GuildMusicState = {
      queue: [],
      nowPlaying: null,
      idleTimer: null
    };

    this.states.set(guildId, created);
    return created;
  }

  private pickTrackFromLoadResult(loadType: LoadType | undefined, data: unknown): Track | null {
    if (!loadType || !data) {
      return null;
    }

    if (loadType === LoadType.TRACK && isTrackLike(data)) {
      return data;
    }

    if ((loadType === LoadType.SEARCH || loadType === LoadType.PLAYLIST) && Array.isArray((data as any).tracks)) {
      const playlistTracks = (data as { tracks: unknown[] }).tracks;
      const first = playlistTracks.find(isTrackLike);
      return first ?? null;
    }

    if (Array.isArray(data)) {
      const first = data.find(isTrackLike);
      return first ?? null;
    }

    return null;
  }

  private dequeueFifo(state: GuildMusicState): QueueItem {
    const next = state.queue.shift();
    if (!next) {
      throw new Error("Queue is empty");
    }

    return next;
  }

  private dequeueRoundRobin(state: GuildMusicState): QueueItem {
    if (!state.nowPlaying) {
      return this.dequeueFifo(state);
    }

    const sorted = [...state.queue].sort(compareQueueOrder);
    const differentUserItem = sorted.find((item) => item.requestedByUserId !== state.nowPlaying?.requestedByUserId);

    if (!differentUserItem) {
      return this.dequeueFifo(state);
    }

    const index = state.queue.findIndex(
      (item) =>
        item.enqueuedAt === differentUserItem.enqueuedAt &&
        item.requestedByUserId === differentUserItem.requestedByUserId &&
        item.track.encoded === differentUserItem.track.encoded
    );

    if (index === -1) {
      return this.dequeueFifo(state);
    }

    const [selected] = state.queue.splice(index, 1);
    if (!selected) {
      return this.dequeueFifo(state);
    }

    return selected;
  }

  private async getGuildQueueFairness(guildId: string): Promise<QueueFairness> {
    const settings = await db.guildSettings.findUnique({
      where: { guildId },
      select: { musicQueueFairness: true }
    });

    return settings?.musicQueueFairness ?? "ROUND_ROBIN";
  }

  private async getGuildIdleTimeoutMs(guildId: string): Promise<number> {
    const settings = await db.guildSettings.findUnique({
      where: { guildId },
      select: { musicIdleTimeoutMs: true }
    });

    const value = settings?.musicIdleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    return value > 0 ? value : DEFAULT_IDLE_TIMEOUT_MS;
  }

  private startIdleTimer(guildId: string, timeoutMs: number, player: Player): void {
    this.clearIdleTimer(guildId);

    const state = this.getOrCreateState(guildId);
    state.idleTimer = setTimeout(async () => {
      try {
        const currentState = this.states.get(guildId);
        if (!currentState || currentState.queue.length > 0) {
          return;
        }

        await this.shoukaku.leaveVoiceChannel(guildId);
      } catch (error) {
        console.error(`[music] idle timeout cleanup failed for guild ${guildId}:`, error);
      } finally {
        this.clearGuildState(guildId);
      }
    }, timeoutMs);
  }

  private clearIdleTimer(guildId: string): void {
    const state = this.states.get(guildId);
    if (!state?.idleTimer) {
      return;
    }

    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
}
