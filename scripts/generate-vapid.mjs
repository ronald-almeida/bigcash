import webpush from "web-push";
import { writeFileSync } from "node:fs";
// Run locally. Never commit the generated file or expose the private key.
const keys = webpush.generateVAPIDKeys();
writeFileSync(
  ".vapid-secrets.json",
  JSON.stringify(
    { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey },
    null,
    2,
  ) + "\n",
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Chaves criadas em .vapid-secrets.json (ignorado pelo Git). Configure VAPID_SUBJECT e envie as chaves com wrangler secret bulk.",
);
