# VW-connect to MQTT Forwarder #

This NPM module receives data via the VW connect API and publishes selected messages to an MQTT broker.

It builds upon the [npm-vwconnectapi](https://github.com/nightsha-de/npm-vwconnectapi) library, which is slightly modified and integrated here.


## Installation ##

Install the latest release directly from github:
 - `git clone https://github.com/embyt/vwconnect-mqtt`
 - `npm install`
 - `npm run build`

Adapt the configuration:
 - `cp vwconnect-mqtt.sample.json dist/vwconnect-mqtt.conf.json`
 - edit file, i.e. the vw connect and mqtt credentials.

Start execution
 - `node dist/index.js`
