import * as api from "./vwconnectapi";
import nconf from "nconf";

// setup configuration
nconf
  .argv()
  .env()
  .file({ file: `${__dirname}/vwconnect-mqtt.conf` })
  .defaults({
    vwc_type: "id",
  });

var vwConn = new api.VwWeConnect();
vwConn.setLogLevel("INFO"); // optional, ERROR (default), INFO, WARN or DEBUG
vwConn.setCredentials(nconf.get("vwc_username"), nconf.get("vwc_password"), undefined);
vwConn.setConfig(nconf.get("vwc_type")); // type
vwConn.getData().then(() => {
  console.log("data", vwConn.idData.data);
  console.log("vinArray", vwConn.vinArray);
});
