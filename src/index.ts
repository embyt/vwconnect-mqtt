import nconf from "nconf";
import { fileURLToPath } from "url";
import { dirname } from "path";
import mqtt from "mqtt";
import * as api from "./vwconnectapi.cjs";

function setupConfig() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // setup configuration
  nconf
    .argv()
    .env()
    .file({ file: `${__dirname}/vwconnect-mqtt.conf.json` })
    .defaults({
      vwc: {
        type: "id",
        pollInterval: 10 * 60, // s
        fastPollInterval: 1 * 60, // s
      },
      mqtt: {
        prefix: "vwconnect",
      },
      data: {
        timestamp: "batteryStatus.carCapturedTimestamp",
        soc: "batteryStatus.currentSOC_pct",
        range: "batteryStatus.cruisingRangeElectric_km",
        charging_power: "chargingStatus.chargePower_kW",
        remaining_charging_time: "chargingStatus.remainingChargingTimeToComplete_min",
        target_soc: "chargingSettings.targetSOC_pct",
      },
    });
}

function setupVwConnectApi() {
  // setup vw connect interface
  const vwConn = new api.VwWeConnect();
  vwConn.setLogLevel("DEBUG"); // optional, ERROR (default), INFO, WARN or DEBUG
  vwConn.setCredentials(nconf.get("vwc:username"), nconf.get("vwc:password"), undefined);
  vwConn.setConfig(nconf.get("vwc:type")); // type
  return vwConn;
}

function setupMqtt() {
  // setup mqtt interface
  const mqttclient = mqtt.connect(nconf.get("mqtt:host"), {
    clientId: "vwconnect",
    username: nconf.get("mqtt:username"),
    password: nconf.get("mqtt:password"),
  });
  mqttclient.on("connect", () => {
    console.log("mqtt: connected");
  });
  mqttclient.on("error", (error) => {
    console.error("mqtt: Can't connect", error);
  });
  return mqttclient;
}

function extractData(data: api.IIdData) {
  // loop through all subscribed data topics
  const subscriptions = nconf.get("data");
  const topics = Object.keys(subscriptions);
  const values = topics.map((curTopic) => {
    let curObj: any = data.data;
    const topicParts = subscriptions[curTopic].split(".") as string[];
    topicParts.forEach((curSect) => {
      //console.log("it", curObj, curSect, curObj?.[curSect]);
      curObj = curObj?.[curSect];
    });
    return curObj;
  });
  console.log("data", topics, values);

  // publish to mqtt
  for (let i = 0; i < topics.length; i++) {
    if (values[i] !== undefined) {
      mqttclient.publish(`${nconf.get("mqtt:prefix")}/${topics[i]}`, `${values[i]}`);
    } else {
      console.warn("topic not found:", topics[i]);
    }
  }

  let doFastPoll = false; // default

  // check SoC
  const soc = data.data?.batteryStatus?.currentSOC_pct;
  // did state of charge change?
  if (soc !== undefined && soc !== lastSoc) {
    // is this the first data set or a real change?
    if (lastSoc !== undefined) {
      const now = new Date().getTime();
      // if this is not the first change, we can determine the change rate
      if (lastSocChange !== undefined) {
        // determine change rate
        const changeRate = (now - lastSocChange) / (Math.abs(lastSoc - soc) * 1000); // s per percent
        // if we change faster than 1 % in 15 min, we switch to fast polling
        if (changeRate < 15 * 60) {
          doFastPoll = true;
        }
      }
      lastSocChange = now;
    }
    lastSoc = soc;
  }

  // also check if charging, then we always switch to fast polling
  if (data.data?.chargingStatus?.chargePower_kW) {
    doFastPoll = true;
  }
  return doFastPoll;
}

setupConfig();
const vwConn = setupVwConnectApi();
const mqttclient = setupMqtt();
let lastSoc: number | undefined; // SoC in percent
let lastSocChange: number | undefined; // timestamp in ms

// login, read vehicles and initial read of data
console.log("login and get initial status");
await vwConn.getData();

// start endless loop
let doFastPoll = false;
while (vwConn.vinArray.length > 0) {
  // publish data to mqtt
  console.log("publish data");
  doFastPoll = extractData(vwConn.idData);

  // pause
  const timeout = nconf.get(doFastPoll ? "vwc:fastPollInterval" : "vwc:pollInterval") * 1000;
  await new Promise((resolve) => setTimeout(resolve, timeout));

  // renew communication tokens
  console.log("refresh token");
  await vwConn.refreshIDToken().catch(() => {
    console.error("error refreshing id token");
  });

  // get data
  console.log("get status");
  await Promise.all(
    vwConn.vinArray.map((vin) => {
      vwConn.getIdStatus(vin).catch(() => {
        console.error("get id status Failed");
      });
    }),
  );
}

console.error("No vehicles found. Exiting");
mqttclient.end();
