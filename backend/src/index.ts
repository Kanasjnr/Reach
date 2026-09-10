import "dotenv/config";
import { app } from "./api.js";
import { startIndexer } from "./indexer.js";

const PORT = process.env.PORT ?? 3001;

startIndexer().catch((err) => {
  console.error("indexer failed to start", err);
  process.exit(1);
});

app.listen(PORT, () => console.log(`reach backend listening on ${PORT}`));
