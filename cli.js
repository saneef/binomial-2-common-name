#!/usr/bin/env node
import cheerio from "cheerio";
import pLimit from "p-limit";
import fs from "fs";
import binomials from "./binomialNames.json" assert { type: "json" };

const baseWikiUrl = "https://en.wikipedia.org/wiki/";

function getWikiUrl(keyword) {
  const url = `${baseWikiUrl}${keyword}`;
  return encodeURI(url);
}

function parseWikiPage(text) {
  const $ = cheerio.load(text);

  const commonName = $("#firstHeading").text().trim();

  const dataTableEl = $("table.biota");
  const conservationStatus = $(
    "a[title*='IUCN status'],a[title*='Vulnerable'],a[title*='endangered'],a[title*='Concern']",
    dataTableEl
  )
    .text()
    .trim();

  const kingdom = $("tr", dataTableEl)
    .map(function (i, el) {
      if ($("td:first-child", el).text().trim() === "Kingdom:") {
        return $("td:nth-child(2)", el).text().trim();
      }
    })
    .toArray()[0];

  return {
    commonName,
    conservationStatus,
    kingdom,
  };
}

async function getCommonNameFromBinomial(name) {
  if (name === null || name.trim() === "") return;

  const url = getWikiUrl(name);

  const html = await fetch(url).then((res) => res.text());
  const result = await parseWikiPage(html);

  if (result) {
    const obj = {
      binomial: name,
      ...result,
    };

    console.log(obj);
    return obj;
  }
}

async function bulkGetCommonNameFromBinomial(array, { limit = 1 } = {}) {
  const limitPromises = pLimit(5);

  const input = array.map((b) =>
    limitPromises(() => getCommonNameFromBinomial(b))
  );

  return Promise.all(input);
}

(async () => {
  let results = (await bulkGetCommonNameFromBinomial(binomials)) || [];

  results = results.filter(Boolean);

  const data = JSON.stringify(results);

  fs.writeFileSync("./commonNames.json", data);
})();
