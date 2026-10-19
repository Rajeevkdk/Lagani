import { migrate, pool } from "./db";
import { seed } from "./seed";
async function main() {
  if (process.argv[2] === "migrate") await migrate();
  else if (process.argv[2] === "seed") await seed();
  else throw new Error("Usage: db-cli migrate|seed");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
