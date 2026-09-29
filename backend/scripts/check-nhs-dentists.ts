// Shows what the NHS dentists parser makes of the nhs.uk find-a-dentist pages,
// without starting the server. Run it first whenever the log says an NHS
// dentists sync failed - that almost always means nhs.uk changed its markup.
//
//   cd backend
//   npx tsx scripts/check-nhs-dentists.ts             # the live results page
//   npx tsx scripts/check-nhs-dentists.ts page.html   # a saved copy
//   npx tsx scripts/check-nhs-dentists.ts --pages     # also every practice's page (about 4 minutes)
//
// Exits non-zero if the results page does not parse.

import { readFileSync } from "fs";
import {
  CRAWL_DELAY_MS,
  NHS_DENTISTS_RESULTS_URL,
  NhsDentist,
  parsePracticePage,
  parseResults,
} from "../src/nhsDentists";

const args = process.argv.slice(2);
const withPages = args.includes("--pages");
const file = args.find((arg) => !arg.startsWith("--"));

const get = async (url: string) => {
  const res = await fetch(url, { headers: { "User-Agent": "StocktonHeathApp/1.0 (check script)" } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.text();
};

const groups = (accepting: NhsDentist["accepting"]) =>
  [accepting.adults && "adults", accepting.children && "children", accepting.freeCare && "free care"]
    .filter(Boolean)
    .join(", ");

const main = async () => {
  const html = file ? readFileSync(file, "utf8") : await get(NHS_DENTISTS_RESULTS_URL);
  const dentists = parseResults(html);

  console.table(
    dentists.map((d) => ({
      ods: d.odsCode,
      miles: d.distanceMiles,
      status: d.status,
      accepting: groups(d.accepting),
      urgent: d.urgentCare,
      name: d.name,
    })),
  );

  const count = (status: string) => dentists.filter((d) => d.status === status).length;
  console.log(
    `Results page: ${dentists.length} practices up to ${dentists[dentists.length - 1].distanceMiles} miles. ` +
      `${count("accepting")} accepting (${dentists.filter((d) => d.accepting.adults).length} adults, ` +
      `${dentists.filter((d) => d.accepting.children).length} children), ${count("not_accepting")} not accepting, ` +
      `${count("not_confirmed")} not confirmed, ${count("referral_only")} referral only.`,
  );

  if (!withPages) return;

  let unreadable = 0;
  for (const d of dentists.filter((d) => d.status !== "referral_only")) {
    await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));
    let line: string;
    try {
      const page = parsePracticePage(await get(d.nhsUrl));
      if (!page) {
        unreadable++;
        line = "NOT RECOGNISED";
      } else {
        const differs =
          page.status !== d.status || groups(page.accepting) !== groups(d.accepting);
        line = `${page.status}${page.accepting.adults || page.accepting.children || page.accepting.freeCare ? ` (${groups(page.accepting)})` : ""}, last confirmed ${page.lastConfirmed ?? "-"}${differs ? `  <- results page said ${d.status}` : ""}`;
      }
    } catch (error) {
      unreadable++;
      line = `FAILED: ${error instanceof Error ? error.message : error}`;
    }
    console.log(`${d.name}: ${line}`);
  }
  console.log(`${unreadable} practice page(s) could not be read.`);
};

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
