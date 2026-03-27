import { Worker } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379)
};

const worker = new Worker(
  "skeleton-queue",
  async () => {
    return;
  },
  { connection }
);

worker.on("ready", () => {
  console.log("Worker is ready");
});

worker.on("error", (error) => {
  console.error("Worker error", error);
});
