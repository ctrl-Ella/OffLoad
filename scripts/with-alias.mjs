import { register } from "node:module";

// `node --import ./scripts/with-alias.mjs <script.ts>`: see alias-hooks.mjs.
register("./alias-hooks.mjs", import.meta.url);
