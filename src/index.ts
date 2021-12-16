import nconf from "nconf";
import { fileURLToPath } from "url";
import { dirname } from "path";
import mqtt, { MqttClient } from "mqtt";
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
  vwConn.setLogLevel("INFO"); // optional, ERROR (default), INFO, WARN or DEBUG
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
}

setupConfig();
const vwConn = setupVwConnectApi();
const mqttclient = setupMqtt();

// login, read vehicles and initial read of data
console.log("login and get initial status");
await vwConn.getData();

// start endless loop
while (true) {
  // publish data to mqtt
  extractData(vwConn.idData);

  // pause
  await new Promise((resolve) => setTimeout(resolve, nconf.get("vwc:pollInterval") * 1000));

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

// mqttclient.end();
