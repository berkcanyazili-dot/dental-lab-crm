type PusherServerInstance = {
  trigger: (channel: string, event: string, data: Record<string, unknown>) => Promise<unknown>;
};

type PusherClientInstance = {
  subscribe: (channelName: string) => {
    bind: (eventName: string, callback: () => void) => void;
    unbind: (eventName: string, callback?: () => void) => void;
  };
  unsubscribe: (channelName: string) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __dentalLabPusherClient: PusherClientInstance | undefined;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

let serverInstancePromise: Promise<PusherServerInstance | null> | null = null;

export async function getPusherServer() {
  if (serverInstancePromise) {
    return serverInstancePromise;
  }

  serverInstancePromise = (async () => {
    const appId = getRequiredEnv("PUSHER_APP_ID");
    const key = getRequiredEnv("NEXT_PUBLIC_PUSHER_KEY");
    const secret = getRequiredEnv("PUSHER_SECRET");
    const cluster = getRequiredEnv("NEXT_PUBLIC_PUSHER_CLUSTER");

    if (!appId || !key || !secret || !cluster) {
      return null;
    }

    const { default: PusherServer } = await import("pusher");
    return new PusherServer({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    }) as PusherServerInstance;
  })();

  return serverInstancePromise;
}

export async function triggerCaseUpdate(caseId: string, payload?: Record<string, unknown>) {
  const pusher = await getPusherServer();
  if (!pusher) {
    return;
  }

  await pusher.trigger(`case-${caseId}`, "update", {
    caseId,
    ...payload,
  });
}

export async function getPusherClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (globalThis.__dentalLabPusherClient) {
    return globalThis.__dentalLabPusherClient;
  }

  const key = getRequiredEnv("NEXT_PUBLIC_PUSHER_KEY");
  const cluster = getRequiredEnv("NEXT_PUBLIC_PUSHER_CLUSTER");

  if (!key || !cluster) {
    return null;
  }

  const { default: PusherClient } = await import("pusher-js");
  globalThis.__dentalLabPusherClient = new PusherClient(key, {
    cluster,
    forceTLS: true,
  }) as unknown as PusherClientInstance;

  return globalThis.__dentalLabPusherClient;
}
