import { after } from "next/server";
import { createClient } from "redis";
import { createResumableStreamContext } from "resumable-stream";

// Answers run through Redis, so any server can follow or stop them.
const redis = createClient({ url: process.env.REDIS_URL });
const subscriber = redis.duplicate();
const streams = createResumableStreamContext({
  waitUntil: after,
  publisher: redis,
  subscriber,
});
let connecting: Promise<unknown> | undefined;
// On first use, not when the build loads this module.
const connect = () =>
  (connecting ??= Promise.all([
    redis.on("error", console.error).connect(),
    subscriber.on("error", console.error).connect(),
  ]));

// A runner renews its hold, so one whose server died lets go in a minute.
const lifetime = 60;
// Nearly as long as a request may take; the tab then asks again.
const waitFor = 280;
// Notes a message sent, with how to answer it, and claims the chat for a
// runner unless one has it.
const claim = `redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[2])
if redis.call("SET", KEYS[1], "", "NX", "EX", ARGV[2]) then return 1 end
return 0`;
// Lets the chat go, unless a message came since the runner last looked.
const release = `if redis.call("EXISTS", KEYS[2]) == 1 then return 0 end
redis.call("DEL", KEYS[1])
redis.call("PUBLISH", KEYS[1], "")
return 1`;

// The runner's hold, holding the answer it showed last, and the latest
// message's settings.
const keysOf = (chatId: string) => [
  `chat:${chatId}:run`,
  `chat:${chatId}:sent`,
];
const stopChannel = (chatId: string) => `chat:${chatId}:stop`;

/** Notes a message sent with `settings`; true when no runner has the chat, so the caller starts one. */
export async function claimChat(chatId: string, settings: string) {
  await connect();
  const claimed = await redis.eval(claim, {
    keys: keysOf(chatId),
    arguments: [settings, `${lifetime}`],
  });
  return claimed === 1;
}

export async function chatRuns(chatId: string) {
  await connect();
  return (await redis.exists(keysOf(chatId)[0])) === 1;
}

/** A claimed chat, for its runner. Stop from any of the owner's tabs calls `stop`. */
export async function holdChat(chatId: string, stop: () => void) {
  await connect();
  const keys = keysOf(chatId);
  const renew = setInterval(
    () => {
      for (const key of keys) redis.expire(key, lifetime).catch(console.error);
    },
    (lifetime / 3) * 1000,
  );
  await subscriber.subscribe(stopChannel(chatId), stop);
  let held = true;
  return {
    /** The settings of the latest message since the last look, if one came. */
    next: async () => (await redis.getDel(keys[1])) ?? undefined,
    /** Lets tabs follow the answer `stream` carries. */
    async show(id: string, stream: ReadableStream<string>) {
      // Read through Redis, not this copy.
      await (
        await streams.createNewResumableStream(id, () => stream)
      )?.cancel();
      await redis.set(keys[0], id, { condition: "XX", expiration: "KEEPTTL" });
      await redis.publish(keys[0], id);
    },
    /** Lets the chat go, unless a message came since the last look. */
    async release() {
      held = (await redis.eval(release, { keys })) !== 1;
      return !held;
    },
    /** Lets the chat go, leaving what was sent unanswered. */
    async end() {
      clearInterval(renew);
      await subscriber.unsubscribe(stopChannel(chatId), stop);
      if (!held) return;
      await redis.del(keys);
      await redis.publish(keys[0], "");
    },
  };
}

/**
 * The chat's running answer, or without one, the one that starts while this
 * waits, for the tab to follow with a request's full time. A tab that shows
 * the chat `busy` learns at once when nothing runs it anymore.
 */
export async function runningAnswer(
  chatId: string,
  signal: AbortSignal,
  busy: boolean,
) {
  await connect();
  const [key] = keysOf(chatId);
  const start = Promise.withResolvers<string | undefined>();
  const done = (id?: string) => start.resolve(id);
  signal.addEventListener("abort", () => done());
  // Subscribed first, so one starting meanwhile isn't missed.
  await subscriber.subscribe(key, done);
  const shown = await redis.get(key);
  // A runner that died lets go within its lifetime, so a chat one holds is
  // asked about again by then.
  const timer = setTimeout(done, (shown === null ? waitFor : lifetime) * 1000);
  // One that ended is no longer running.
  const running =
    shown && (await streams.hasExistingStream(shown)) === true
      ? shown
      : undefined;
  const rests = shown === null && busy;
  const started =
    running || rests || signal.aborted ? undefined : await start.promise;
  clearTimeout(timer);
  await subscriber.unsubscribe(key, done);
  return { running, started: started || undefined };
}

/** What the answer streamed so far, then the rest. */
export const followAnswer = (id: string) => streams.resumeExistingStream(id);

/** Stops the answer that runs, drops what was sent before, and wakes waiting tabs. */
export async function stopAnswer(chatId: string) {
  await connect();
  const [run, sent] = keysOf(chatId);
  await redis.del(sent);
  await redis.publish(stopChannel(chatId), "");
  // Even when no runner is left to stop.
  await redis.publish(run, "");
}
