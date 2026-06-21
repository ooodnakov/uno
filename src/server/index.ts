import { createServer } from "node:http";

import next from "next";

import { createSocketServer } from "./socket";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer((request, response) => {
    void handle(request, response);
  });

  createSocketServer(httpServer);

  httpServer.listen(port, hostname, () => {
    console.log(`ONE / Odin listening on http://${hostname}:${port}`);
  });
}

void main().catch((error: unknown) => {
  console.error("Failed to start ONE / Odin server", error);
  process.exit(1);
});
