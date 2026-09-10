import { config } from "./config.js";
import { app } from "./api.js";
import { startIndexer } from "./indexer.js";

startIndexer().catch((err) => {
  console.error("indexer failed to start", err);
  process.exit(1);
});

app.listen(config.port, () => console.log(`reach backend listening on ${config.port}`));
