import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`Votify backend running at http://localhost:${env.port}${env.apiPrefix}`);
});
