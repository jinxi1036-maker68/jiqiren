import { readFileSync } from "node:fs";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// The existing public page reader supplies the downloaded HTML on stdin.
const html = readFileSync(0, "utf8");
const { document } = parseHTML(html);
const article = new Readability(document, { maxElemsToParse: 15_000 }).parse();
const content = article?.content;
process.stdout.write(JSON.stringify(typeof content === "string" ? content : null));
