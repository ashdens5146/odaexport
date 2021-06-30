'use strict';
/*
 * Version 1.0.3
 * utils.js
 * Utility methods
*/
const fs = require('fs');
const os = require('os');
const path = require('path');

/*
 * Gets domain, signing info, private key from config file
 * @param configFile - File's absolute path name
*/
function getConfigData (configFile) {
  let configFilePath = configFile;
  if (configFilePath.indexOf('~/') === 0) { configFilePath = configFilePath.replace('~', os.homedir()); }
  if (!path.isAbsolute(configFilePath.trim())) {
    throw new Error(`Can't access config file ${configFile} because the path isn't an absolute path.`);
  }
  try {
    var configData = require(configFilePath);
  } catch (err) {
    console.log(`There's a problem with the config file ${configFile}: `, err.message);
    throw (err);
  }
  let privateKeyPath = configData.privateKeyPath;
  if (privateKeyPath && privateKeyPath.indexOf('~/') === 0) {
    privateKeyPath = privateKeyPath.replace('~', os.homedir());
  }
  if (privateKeyPath) {
    try {
      exports.PRIVATE_KEY = fs.readFileSync(privateKeyPath, 'ascii');
    } catch (err) {
      throw new Error(`Invalid privateKeyPath in ${configFile}.`);
    }
  }
  exports.DOMAIN = configData.domain;
  exports.TENANCY_ID = configData.tenancyId;
  exports.AUTH_USER_ID = configData.userId;
  exports.KEY_FINGERPRINT = configData.fingerprint;
  if (!exports.DOMAIN ||
    !exports.TENANCY_ID ||
    !exports.AUTH_USER_ID ||
    !exports.KEY_FINGERPRINT ||
    !exports.PRIVATE_KEY) {
    throw new Error(`Missing configuration data from ${configFile}.`);
  }
}
exports.getConfigData = getConfigData;
