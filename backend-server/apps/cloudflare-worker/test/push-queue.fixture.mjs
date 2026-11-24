import { DurableObject } from "cloudflare:workers";
import { PushDispatch, consumePushQueue } from "../src/pushDispatchDo.ts";

// Only this fixture exposes failure injection and simulated alarm time.
export class FixtureOutbox extends PushDispatch {
  offset = 0;

  constructor(ctx, env) {
    let failPublish = false;
    super(ctx, {
      API_SERVICE: env.API_SERVICE,
      PUSH_QUEUE: {
        send(wake) {
          if (failPublish) {
            failPublish = false;
            throw new Error("fixture broker failure");
          }
          return env.PUSH_QUEUE.send(wake);
        }
      }
    });
    this.failNextPublish = () => { failPublish = true; };
  }

  now() {
    return Date.now() + this.offset;
  }

  async enqueueWithFailure(data) {
    this.failNextPublish();
    try {
      await this.enqueue(data);
      return false;
    } catch {
      return true;
    }
  }

  async recover(offset) {
    this.offset += offset;
    await super.alarm();
  }
}

export class FixtureDelivery extends DurableObject {
  async sendQueuedPush(data) {
    const key = `attempts:${data.data.notificationId}`;
    const attempts = (await this.ctx.storage.get(key)) ?? [];
    attempts.push(data.retryDeviceIds ?? []);
    await this.ctx.storage.put(key, attempts);
    const failed = (data.title === "partial" && attempts.length === 1)
      || (data.title === "terminal" && attempts.length <= 3);
    return { retryDeviceIds: failed ? ["transient-device"] : [], permanentFailures: data.title === "permanent" ? 1 : 0 };
  }

  async recordProcessed(ids) {
    await this.ctx.storage.transaction(async (txn) => {
      for (const id of ids) {
        const key = `processed:${id}`;
        await txn.put(key, ((await txn.get(key)) ?? 0) + 1);
      }
    });
  }

  async observation(id) {
    const attempts = (await this.ctx.storage.get(`attempts:${id}`)) ?? [];
    const processed = (await this.ctx.storage.get(`processed:${id}`)) ?? 0;
    return { attempts, processed };
  }
}

export default {
  async queue(batch, env) {
    await consumePushQueue(batch, env.PUSH_OUTBOX);
    await env.API_SERVICE.getByName("yugm-global-api").recordProcessed(batch.messages.map((message) => message.body.notificationId));
  },
  async fetch(request, env) {
    const { pathname, searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const outbox = env.PUSH_OUTBOX.getByName(id);
    const data = { userId: "fixture-user", title: searchParams.get("title"), body: "Fixture push", data: { notificationId: id } };
    if (pathname === "/observe") {
      return Response.json({ status: await outbox.status(),
        ...await env.API_SERVICE.getByName("yugm-global-api").observation(id) });
    }
    if (pathname === "/recover") {
      await outbox.recover(Number(searchParams.get("ms")));
    } else if (pathname === "/duplicate") {
      await env.PUSH_QUEUE.send({ notificationId: id });
    } else if (pathname === "/replay") {
      return Response.json(await outbox.replayFailed());
    } else if (pathname === "/fail-enqueue") {
      return new Response(null, { status: await outbox.enqueueWithFailure(data) ? 503 : 500 });
    } else {
      await outbox.enqueue(data);
    }
    return new Response(null, { status: 204 });
  }
};
