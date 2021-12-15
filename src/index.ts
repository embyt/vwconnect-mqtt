import nconf from "nconf";
import { fileURLToPath } from "url";
import { dirname } from "path";
import mqtt from "mqtt";
import * as api from "./vwconnectapi.cjs";

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
  });

// setup vw connect interface
var vwConn = new api.VwWeConnect();
vwConn.setLogLevel("INFO"); // optional, ERROR (default), INFO, WARN or DEBUG
vwConn.setCredentials(nconf.get("vwc:username"), nconf.get("vwc:password"), undefined);
vwConn.setConfig(nconf.get("vwc:type")); // type

// setup mqtt interface
const mqttclient = mqtt.connect(nconf.get("mqtt:host"), {
  clientId: "vwconnect",
  username: nconf.get("mqtt:user"),
  password: nconf.get("mqtt:password"),
});
mqttclient.on("connect", () => {
  console.log("mqtt: connected");
});
mqttclient.on("error", (error) => {
  console.error("mqtt: Can't connect", error);
});

// login, read vehicles and initial read of data
console.log("login and get initial status");
let data = await vwConn.getData();

// start endless loop
while (true) {
  console.log("batteryStatus", vwConn.idData.data.batteryStatus);
  mqttclient.publish(
    `${nconf.get("mqtt:prefix")}/soc`,
    vwConn.idData.data.batteryStatus.currentSOC_pct,
    { retain: true, qos: 1 },
  );

  console.log("refresh token");
  await vwConn.refreshIDToken().catch(() => {
    console.error("error refreshing id token");
  });

  await new Promise((resolve) => setTimeout(resolve, nconf.get("vwc_pollInterval") * 1000));
  console.log("get status");
  await Promise.all(
    vwConn.vinArray.map((vin) => {
      vwConn.getIdStatus(vin).catch(() => {
        console.error("get id status Failed");
      });
    }),
  );
}

mqttclient.end();
