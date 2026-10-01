import { test } from "node:test";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import { sendPush } from "../worker/notifications.ts";
test("push uses Workers-compatible redirects, rejects redirects and removes expired subscriptions", async () => {
  const keys = webpush.generateVAPIDKeys();
  const dh = createECDH("prime256v1");
  dh.generateKeys();
  const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    keys: {
      p256dh: dh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  let deleted = false;
  const env = {
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: "https://example.com",
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            deleted = true;
          },
        }),
      }),
    },
  } as unknown as Parameters<typeof sendPush>[0];
  const original = globalThis.fetch;
  let status = 201;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.redirect, "manual");
    assert.ok(init?.body);
    return new Response(null, { status });
  };
  try {
    assert.equal(
      await sendPush(env, sub, { title: "test", body: "test", tag: "test" }),
      true,
    );
    status = 302;
    await assert.rejects(
      sendPush(env, sub, { title: "test", body: "test", tag: "test" }),
      /302/,
    );
    status = 410;
    assert.equal(
      await sendPush(env, sub, { title: "test", body: "test", tag: "test" }),
      false,
    );
    assert.ok(deleted);
  } finally {
    globalThis.fetch = original;
  }
});
