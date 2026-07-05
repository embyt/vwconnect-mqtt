// Reads the state of charge of a VW ID vehicle and publishes it to MQTT.
//
// VW retired the WeConnect app API for third-party clients in June 2026, so this
// reads from the EU Data Act portal instead, which publishes a dataset of the
// vehicle every 15 minutes. A one-time browser setup is required, see README.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import mqtt from "mqtt";

const args = process.argv.slice(2);
const scanMode = args.includes("--scan"); // diagnostic: list SoC-related fields of all datasets, then exit
const conf = JSON.parse(
  readFileSync(args.find((a) => !a.startsWith("--")) ?? "vwconnect-mqtt.conf.json", "utf8"),
);
const POLL_MS = (conf.vwc.pollInterval ?? 60) * 1000;
const TOPIC = `${conf.mqtt.prefix ?? "vwconnect"}/soc`;

const PORTAL = "https://eu-data-act.drivesomethinggreater.com";
const CLIENT_ID = "9b58543e-1c15-4193-91d5-8a14145bebb0@apps_vw-dilab_com"; // the portal's OIDC client for VW passenger cars
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

// --- minimal http client: shared cookie jar, follows redirects across hosts ---
const cookies = new Map<string, string>();

async function http(
  url: string,
  opts: { form?: Record<string, string>; headers?: Record<string, string> } = {},
) {
  let body = opts.form && new URLSearchParams(opts.form).toString();
  for (;;) {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      body,
      redirect: "manual",
      headers: {
        "user-agent": UA,
        cookie: [...cookies].map((c) => c.join("=")).join("; "),
        ...(body && { "content-type": "application/x-www-form-urlencoded" }),
        ...opts.headers,
      },
    });
    for (const c of res.headers.getSetCookie()) {
      const [name, ...value] = c.split(";")[0].split("=");
      cookies.set(name, value.join("="));
    }
    const location = res.headers.get("location");
    if (location) {
      url = new URL(location, url).href;
      body = undefined;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.status >= 400)
      throw new Error(`${url}: HTTP ${res.status} ${buf.toString("utf8").slice(0, 200)}`);
    return { url, buf, text: () => buf.toString("utf8") };
  }
}

async function apiJson(path: string, headers?: Record<string, string>): Promise<any> {
  return JSON.parse(
    (await http(PORTAL + path, { headers: { accept: "application/json", ...headers } })).text(),
  );
}

// --- login: OIDC code flow on identity.vwgroup.io, lands back on the portal ---
function formFields(page: { url: string; text: () => string }) {
  const fields: Record<string, string> = {};
  for (const m of page.text().matchAll(/<input[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"/g))
    fields[m[1]] = m[2];
  // csrf/hmac/relayState live in the inline window._IDK script of the identity pages
  const scripted: [string, RegExp][] = [
    ["_csrf", /csrf_token\s*[:=]\s*['"]([^'"]+)/],
    ["hmac", /"hmac"\s*:\s*"([^"]+)"/],
    ["relayState", /"relayState"\s*:\s*"([^"]+)"/],
  ];
  for (const [key, re] of scripted) {
    const value = page.text().match(re)?.[1];
    if (value) fields[key] = value;
  }
  return fields;
}

function formAction(page: { url: string; text: () => string }) {
  const action = page.text().match(/<form[^>]*\baction="([^"]+)"/)?.[1];
  return action ? new URL(action, page.url).href : undefined;
}

async function login() {
  console.log("logging in");
  cookies.clear();
  await http(PORTAL + "/"); // prime the portal session cookies
  const authorize = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: "openid cars profile",
    state: "de__en__VOLKSWAGEN_PASSENGER_CARS",
    redirect_uri: `${PORTAL}/login`,
    prompt: "login",
  });
  let page = await http(`https://identity.vwgroup.io/oidc/v1/authorize?${authorize}`); // ends on the e-mail form
  const emailAction = formAction(page);
  if (!emailAction) throw new Error(`login form not found on ${page.url}`);
  page = await http(emailAction, { form: { ...formFields(page), email: conf.vwc.username } });
  // the password page renders its form via JS, so there may be no <form action>:
  // its POST target is then the landing URL itself (without the query string)
  page = await http(formAction(page) ?? page.url.split("?")[0], {
    form: { ...formFields(page), email: conf.vwc.username, password: conf.vwc.password },
  });
  if (!page.url.startsWith(PORTAL))
    throw new Error(
      `login failed (wrong credentials, or portal not yet set up — see README): ended on ${page.url}`,
    );
  console.log("login successful");
}

// --- dataset handling ---
function datasetJson(zip: Buffer): { Data: { dataFieldName: string; value: string }[] } {
  // the dataset is a zip holding a single JSON file: decode via its local file header
  const nameLen = zip.readUInt16LE(26);
  const extraLen = zip.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  let size = zip.readUInt32LE(18);
  if (size === 0) size = zip.indexOf(Buffer.from("PK\x07\x08", "latin1"), start) - start; // streamed entry: size is only in the trailing descriptor
  const raw = zip.subarray(start, start + size);
  return JSON.parse((zip.readUInt16LE(8) === 8 ? inflateRawSync(raw) : raw).toString("utf8"));
}

function extractSoc(dataset: {
  Data: { dataFieldName: string; value: string }[];
}): number | undefined {
  const fields = [
    "state_of_charge",
    "hv_soc",
    "battery_state_report.soc",
    "BMC_NutzbarerSOC_XIX_BMC_HV_02_XIX_HCP4_CANFD03", // raw CAN SoC, reads a few % above the displayed value
  ];
  for (const field of fields) {
    const values = dataset.Data.filter((d) => d.dataFieldName === field)
      .map((d) => Number(d.value))
      .filter((v) => v >= 0 && v <= 100);
    if (values.length) return values.at(-1); // last occurrence is the freshest reading
  }
}

async function getIdentifier(vin: string): Promise<string> {
  const meta = await apiJson(`/proxy_api/euda-apim/datarequest/vehicles/${vin}/metadata/partial`);
  if (!meta.Identifier)
    throw new Error("no continuous data request configured on the portal — see README");
  return meta.Identifier;
}

// --- main ---
await login();
const vehicles = await apiJson("/proxy_api/consent/me/vehicles?viewPosition=FRONT_LEFT");
const vin = (Array.isArray(vehicles) ? vehicles : (vehicles.vehicles ?? []))[0]?.vin;
if (!vin) throw new Error("no vehicle linked on the EU Data Act portal — see README");
console.log("using vehicle", vin);
let identifier = await getIdentifier(vin);

// datasets with content, newest first
async function listDatasets(): Promise<{ name: string; createdOn?: string }[]> {
  const list = await apiJson(
    `/proxy_api/euda-apim/datadelivery/vehicles/${vin}/${identifier}/list`,
    { type: "partial" },
  );
  return (Array.isArray(list) ? list : (list.files ?? []))
    .filter((f: any) => f.name && !f.name.endsWith("_no_content_found.zip"))
    .sort((a: any, b: any) =>
      String(b.createdOn ?? b.name).localeCompare(String(a.createdOn ?? a.name)),
    );
}

async function downloadDataset(name: string) {
  const zip = await http(
    `${PORTAL}/proxy_api/euda-apim/datadelivery/vehicles/${vin}/${identifier}/download`,
    { headers: { filename: name, type: "partial" } },
  );
  return datasetJson(zip.buf);
}

if (scanMode) {
  // print every SoC-related field of every available dataset, then exit
  for (const file of await listDatasets()) {
    for (const d of (await downloadDataset(file.name)).Data)
      if (/soc/i.test(d.dataFieldName)) console.log(file.name, "|", d.dataFieldName, "=", d.value);
  }
  process.exit(0);
}

const mqttclient = mqtt.connect(conf.mqtt.host, {
  clientId: "vwconnect",
  username: conf.mqtt.username,
  password: conf.mqtt.password,
});
mqttclient.on("connect", () => console.log("mqtt: connected"));
mqttclient.on("error", (error) => console.error("mqtt:", error.message));

let lastDataset = "";
for (;;) {
  try {
    console.log("polling for new dataset");
    const datasets = await listDatasets();
    console.log("found", datasets.length, "datasets with content");
    // not every dataset carries the battery report: walk the unseen ones,
    // newest first, and publish the SoC of the freshest one that has it
    for (const file of datasets) {
      if (file.name === lastDataset) break;
      console.log("downloading dataset", file.name, "created on", file.createdOn ?? "unknown");
      const soc = extractSoc(await downloadDataset(file.name));
      if (soc !== undefined) {
        console.log(new Date().toISOString(), "soc:", soc, `(${file.name})`);
        mqttclient.publish(TOPIC, String(soc));
        break;
      }
      console.log("no SoC field in this dataset");
    }
    if (datasets.length) lastDataset = datasets[0].name;
  } catch (error) {
    console.error((error as Error).message);
    // recover from expired sessions and rotated data requests; retry next cycle otherwise
    await login()
      .then(async () => (identifier = await getIdentifier(vin)))
      .catch((err) => console.error(err.message));
  }
  console.log("polling done, sleeping for", POLL_MS / 1000, "seconds");
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
