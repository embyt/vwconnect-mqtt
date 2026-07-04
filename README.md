# VW-connect to MQTT Forwarder #

Reads the state of charge (SoC) of a VW ID vehicle and publishes it to an MQTT broker
(topic `vwconnect/soc`).

VW retired the WeConnect app API for third-party clients in June 2026, so this tool reads
from the [EU Data Act portal](https://eu-data-act.drivesomethinggreater.com/) instead. The
portal publishes a dataset of the vehicle every 15 minutes; the tool polls for new datasets
once a minute and publishes the SoC whenever one arrives.

## One-time portal setup ##

The portal must be set up once in a browser (the tool cannot do this, it involves a legal
consent screen):

1. Log in at <https://eu-data-act.drivesomethinggreater.com/> with your VW ID credentials
   and accept the consent screen.
2. Link your vehicle under *Data clusters → Vehicle overview*.
3. Enable a continuous data request: *Get customised data → All data, frequency 15 minutes*.

## Installation ##

Requires Node.js ≥ 23 (runs TypeScript directly, no build step).

- `git clone https://github.com/embyt/vwconnect-mqtt`
- `npm install`
- `cp vwconnect-mqtt.sample.json vwconnect-mqtt.conf.json` and edit the credentials
- `node src/index.ts [path/to/config.json]`

## Configuration ##

```json
{
  "vwc": {
    "username": "<your vw id email address>",
    "password": "<your vw id password>",
    "pollInterval": 60
  },
  "mqtt": {
    "host": "mqtt://broker.example.com",
    "username": "<mqtt username>",
    "password": "<mqtt password>",
    "prefix": "vwconnect"
  }
}
```

`pollInterval` (seconds) and `prefix` are optional and default to the values shown.
