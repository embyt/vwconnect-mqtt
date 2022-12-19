export interface IIdData {
  charging: {
    batteryStatus: {
      value: {
        carCapturedTimestamp: string;
        currentSOC_pct: number;
        cruisingRangeElectric_km: number;
      };
    };
    chargingStatus: {
      value: {
        carCapturedTimestamp: string;
        remainingChargingTimeToComplete_min: number;
        chargingState: "readyForCharging";
        chargeMode: "manual" | "off";
        chargePower_kW: number;
        chargeRate_kmph: number;
        chargeType: "invalid";
        chargingSettings: "default";
      };
    };
    chargingSettings: {
      value: {
        carCapturedTimestamp: string;
        maxChargeCurrentAC: "maximum";
        autoUnlockPlugWhenCharged: "permanent";
        autoUnlockPlugWhenChargedAC: "permanent";
        targetSOC_pct: number;
      };
    };
    chargeMode: {
      value: {
        preferredChargeMode: "manual";
        availableChargeModes: ["invalid"];
      };
    };
    plugStatus: {
      value: {
        carCapturedTimestamp: string;
        plugConnectionState: "connected";
        plugLockState: "unlocked";
        externalPower: "unavailable";
        ledColor: "none";
      };
    };
  };
  automation: any; // not queried
  userCapabilities: any; // not queried
  climatisation: any; // not queried
  climatisationTimers: any; // not queried
  fuelStatus: any; // not queried
  readiness: any; // not queried
  chargingProfiles: any; // not queried
}

export class VwWeConnect {
  config: {
    userid: number;
    user: string;
    password: string;
    pin: string;
    type: string;
    interval: number;
    forceinterval: number;
    numberOfTrips: number;
    logLevel: string;
    targetTempC: number;
    targetSOC: number;
    chargerOnly: boolean;
  };
  currSession: {
    vin: string;
  };
  boolFinishIdData: boolean;
  boolFinishHomecharging: boolean;
  boolFinishChargeAndPay: boolean;
  boolFinishStations: boolean;
  boolFinishVehicles: boolean;
  boolFinishCarData: boolean;
  log: Log;
  jar: any;
  refreshTokenInterval: NodeJS.Timer | null;
  vwrefreshTokenInterval: NodeJS.Timer | null;
  updateInterval: NodeJS.Timer | null;
  fupdateInterval: number;
  refreshTokenTimeout: NodeJS.Timeout | null;
  homeRegion: {};
  homeRegionSetter: {};
  vinArray: any[];
  etags: {};
  statesArray: (
    | {
        url: string;
        path: string;
        element: string;
        element2?: undefined;
        element3?: undefined;
        element4?: undefined;
      }
    | {
        url: string;
        path: string;
        element: string;
        element2: string;
        element3: string;
        element4: string;
      }
    | {
        url: string;
        path: string;
        element: string;
        element2: string;
        element3?: undefined;
        element4?: undefined;
      }
    | {
        url: string;
        path: string;
        element?: undefined;
        element2?: undefined;
        element3?: undefined;
        element4?: undefined;
      }
  )[];
  finishedReading(): boolean;
  setCredentials(pUser: any, pPass: any, pPin: any): void;
  setConfig(pType: any): void;
  setActiveVin(pVin: any): void;
  stopCharging(): Promise<any>;
  setTargetSOC(pTargetSOC: any): Promise<any>;
  startCharging(): Promise<any>;
  stopClimatisation(): Promise<any>;
  startClimatisation(pTempC: any): Promise<any>;
  setLogLevel(pLogLevel: any): void;
  getData(): Promise<IIdData>;
  type: string | undefined;
  country: string | undefined;
  clientId: string | undefined;
  xclientId: string | undefined;
  scope: string | undefined;
  redirect: string | undefined;
  xrequest: string | undefined;
  responseType: string | undefined;
  xappversion: string | undefined;
  xappname: string | undefined;
  tripTypes: any[] | undefined;
  login(): Promise<any>;
  receiveLoginUrl(): Promise<any>;
  replaceVarInUrl(url: any, vin: any, tripType: any): any;
  getTokens(getRequest: any, code_verifier: any, reject: any, resolve: any): void;
  getVWToken(tokens: any, jwtid_token: any, reject: any, resolve: any): void;
  refreshToken(isVw: any): Promise<any>;
  getPersonalData(): Promise<any>;
  getVehicles(): Promise<any>;
  vehicles: any;
  getWcData(limit: any): void;
  chargeAndPay: any;
  stations: any;
  homechargingRecords: any;
  genericRequest(
    url: any,
    header: any,
    path: any,
    codesToIgnoreArray: any,
    selector1: any,
    selector2: any,
  ): Promise<any>;
  getIdStatus(vin: any): Promise<any>;
  idData: IIdData;
  setIdRemote(vin: any, action: any, value: any, bodyContent: any): Promise<any>;
  refreshIDToken(): Promise<any>;
  getVehicleData(vin: any): Promise<any>;
  getVehicleRights(vin: any): Promise<any>;
  requestStatusUpdate(vin: any): Promise<any>;
  getVehicleStatus(
    vin: any,
    url: any,
    path: any,
    element: any,
    element2: any,
    element3: any,
    element4: any,
    tripType: any,
  ): Promise<any>;
  getStatusKeys(statusJson: any): any[] | null;
  updateUnit(pathString: any, unit: any): void;
  updateName(pathString: any, name: any): void;
  setVehicleStatus(vin: any, url: any, body: any, contentType: any, secToken: any): Promise<any>;
  setVehicleStatusv2(vin: any, url: any, body: any, contentType: any, secToken: any): Promise<any>;
  requestSecToken(vin: any, service: any): Promise<any>;
  generateSecurPin(challenge: any): Promise<any>;
  getCodeChallenge(): string[];
  getNonce(): string;
  toHexString(byteArray: any): string;
  toByteArray(hexString: any): number[];
  stringIsAValidUrl(s: any): boolean;
  randomString(length: any): string;
  extractHidden(body: any): {};
  matchAll(re: any, str: any): any[];
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   * @param {() => void} callback
   */
  onUnload(): void;
}
export class Log {
  constructor(logLevel: any);
  logLevel: any;
  setLogLevel(pLogLevel: any): void;
  debug(pMessage: any): void;
  error(pMessage: any): void;
  info(pMessage: any): void;
  warn(pMessage: any): void;
}
