// Keep transformations separate from the DOM so they can be tested directly.

export function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "date not published");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date).replace(/\./g, "");
}

export function shortService(name) {
  return String(name || "")
    .replace(/, British Columbia, Royal Canadian Mounted Police, municipal \[[^\]]+\]/, " RCMP")
    .replace(/, British Columbia, Royal Canadian Mounted Police, rural \[[^\]]+\]/, " RCMP, rural")
    .replace(/, British Columbia, municipal \[[^\]]+\]/, "")
    .replace(/ \[[^\]]+\]$/, "");
}

export function findService(services, query) {
  const wanted = String(query || "").trim().toLowerCase();
  if (!wanted) return null;
  return (services || []).find((service) => service.name.toLowerCase() === wanted)
    || (services || []).find((service) => service.name.toLowerCase().includes(wanted))
    || null;
}

export function pointsFor(sheet, serviceId, violationId) {
  const years = Array.isArray(sheet?.years) ? sheet.years : [];
  const bucket = sheet?.cells?.[serviceId]?.[violationId] || {};
  return years.map((year) => {
    const pair = bucket[String(year)];
    return {
      year: Number(year),
      incidents: pair && pair[0] != null && pair[0] !== "" ? Number(pair[0]) : null,
      rate: pair && pair[1] != null && pair[1] !== "" ? Number(pair[1]) : null,
    };
  });
}

export function publishedEnds(points) {
  const published = (points || []).filter((point) => point.incidents != null || point.rate != null);
  return {
    latest: published.at(-1) || null,
    previous: published.length > 1 ? published.at(-2) : null,
  };
}

export function rateChange(latest, previous) {
  if (!latest || !previous || latest.rate == null || previous.rate == null || previous.rate === 0) return null;
  return (latest.rate - previous.rate) / previous.rate;
}

function number(value) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
}

export function describe(serviceName, violationName, latest, previous, bcRate) {
  if (!latest) {
    return `StatCan did not publish ${violationName.toLowerCase()} for ${serviceName} in this extract. A missing year is not counted as zero.`;
  }
  const who = shortService(serviceName);
  const bits = [];
  if (latest.incidents == null) bits.push(`${who} reported no incident count for ${violationName.toLowerCase()} in ${latest.year}.`);
  else bits.push(`${who} reported ${number(latest.incidents)} ${violationName.toLowerCase()} incidents in ${latest.year}.`);
  if (latest.rate == null) bits.push("The rate per 100,000 was not published.");
  else bits.push(`The rate was ${number(latest.rate)} per 100,000.`);
  const change = rateChange(latest, previous);
  if (change == null) bits.push("The previous published rate is not here, so this is not called a rise or a fall.");
  else {
    const percent = `${number(Math.abs(change * 100))}%`;
    bits.push(change === 0
      ? `That rate is unchanged from ${previous.year}.`
      : `That rate is ${change > 0 ? "up" : "down"} ${percent} from ${previous.year}.`);
  }
  if (bcRate == null) bits.push("A British Columbia rate was not published for this offence and year.");
  else if (latest.rate == null) bits.push(`British Columbia’s rate that year was ${number(bcRate)} per 100,000.`);
  else if (latest.rate === bcRate) bits.push("That matches the British Columbia rate.");
  else bits.push(`The British Columbia rate was ${number(bcRate)} per 100,000.`);
  return bits.join(" ");
}
