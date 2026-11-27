import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedMutationOrigin } from "../worker/origin.ts";

test("mutations accept the backend origin and the exact configured Vercel origin", () => {
  const backend = "https://bigcash.example.workers.dev/api/login";
  const allowed = "https://bigcash-two.vercel.app";
  assert.equal(allowedMutationOrigin(new URL(backend).origin, backend), true);
  assert.equal(allowedMutationOrigin(allowed, backend, allowed), true);
  assert.equal(
    allowedMutationOrigin(
      "https://extra.example",
      backend,
      allowed + ", https://extra.example",
    ),
    true,
  );
});

test("mutations reject missing origins, other Vercel projects, and lookalike domains", () => {
  const backend = "https://bigcash.example.workers.dev/api/login";
  const allowed = "https://bigcash-two.vercel.app";
  for (const origin of [
    null,
    "",
    "null",
    "https://other.vercel.app",
    "https://bigcash-two.vercel.app.attacker.example",
    "http://bigcash-two.vercel.app",
    "https://bigcash-two.vercel.app:444",
    allowed + "/",
  ]) {
    assert.equal(
      allowedMutationOrigin(origin, backend, allowed),
      false,
      String(origin),
    );
  }
});
