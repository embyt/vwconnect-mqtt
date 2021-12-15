import * as api from "./vwconnectapi.cjs";
import nconf from "nconf";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));

// setup configuration
nconf
  .argv()
  .env()
  .file({ file: `${__dirname}/vwconnect-mqtt.conf` })
  .defaults({
    vwc_type: "id",
    vwc_pollInterval: 10 * 60, // s
  });

var vwConn = new api.VwWeConnect();
vwConn.setLogLevel("INFO"); // optional, ERROR (default), INFO, WARN or DEBUG
vwConn.setCredentials(nconf.get("vwc_username"), nconf.get("vwc_password"), undefined);
vwConn.setConfig(nconf.get("vwc_type")); // type

// login, read vehicles and initial read of data
console.log("login and get initial status");
vwConn.getData().then((data) => {
  console.log("data", data.data);
});

// start endless loop
while (true) {
  await new Promise((resolve) => setTimeout(resolve, nconf.get("vwc_pollInterval") * 1000));
  console.log("get status");
  await Promise.all(
    vwConn.vinArray.map((vin) => {
      vwConn.getIdStatus(vin).catch(() => {
        console.error("get id status Failed");
      });
    }),
  );
  console.log("data", vwConn.idData.data);

  console.log("refresh token");
  await vwConn.refreshIDToken().catch(() => {
    console.error("error refreshing id token");
  });
}
