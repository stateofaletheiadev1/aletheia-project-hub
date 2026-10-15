// node --import ./scripts/lib/register.mjs scripts/<script>.ts
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
