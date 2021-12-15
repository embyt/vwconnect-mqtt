import * as api from "./vwconnectapi";

// check command line args
if (process.argv.length !== 4) {
  console.error(`Usage: ${process.argv[1]} <username> <password>`);
  process.exit();
}
const username = process.argv[2];
const password = process.argv[3];

var vwConn = new api.VwWeConnect();
vwConn.setLogLevel("INFO"); // optional, ERROR (default), INFO, WARN or DEBUG
vwConn.setCredentials(username, password, "");
vwConn.setConfig("id"); // type
vwConn.getData().then(() => {
  console.log("SOC", vwConn.idData.data.batteryStatus.currentSOC_pct + "%");
  console.log("batteryStatus", vwConn.idData.data.batteryStatus);
  console.log("data", vwConn.idData.data);
  console.log("iddata", vwConn.idData);
  console.log("con", vwConn);
});
