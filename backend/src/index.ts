import { config } from "./config.js";
import { app } from "./api.js";
import { startIndexer } from "./indexer.js";

startIndexer().catch((err) => {
  console.error("indexer failed to start", err);
  process.exit(1);
});

const server = app.listen(config.port, () =>
  console.log(`reach backend listening on ${config.port}`)
);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `port ${config.port} is already in use by something else — set PORT in .env to a free one`
    );
  } else {
    console.error("server failed to start", err);
  }
  process.exit(1);
});
