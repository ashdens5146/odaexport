'use strict';
/*
 * export-da-insights.js
 * Version 1.0.1
 *
 * Exports a digital assistant's insights data, optionally for the specified date
 * range, and downloads ZIP files to the specified directory.
 *
 */

/*
 * Dependencies
 */
const os = require('os');
const fs = require('fs');
const retry = require('@lifeomic/attempt').retry;
const ociUtils = require('./ociUtils');
const utils = require('./utils.js');

/*
 * global variables
 */
const EXPORTDAINSIGHTS = {
  // API info
  basePath: '/api/v1',
  // Max number of tries to check for export task completion
  maxStatusRetries: 20,
  // Active export task statuses
  activeStatuses: 'SUBMITTED IN_PROGRESS',
  // task type
  taskType: 'EXPORT',
  // Just export the essential data
  insightsDataExport: true,
  // maximum number of rows per ZIP file
  maxFileLength: '100000000'
};
var DEBUG;

/*
 * Print message if in debug mode
 * (if user passed --debug as an argument).
 */
function debug (message) {
  if (DEBUG) { console.log(message); }
}

/*
 * Handle promise reject
 */
const failureCallback = function (error) {
  console.error(error);
  process.exit(1);
};

/*
 * Return a promise reject if the  export task
 * is still in progress
 *
 * @param exportId
 */
async function rejectIfRequestActive (exportId) {
  try {
    const result = await getExportTask(exportId);
    debug(`rejectIfRequestActive: ${result.status}`);
    if (EXPORTDAINSIGHTS.activeStatuses.includes(result.status.toUpperCase())) {
      return Promise.reject(new Error(result));
    } else {
      return Promise.resolve(result);
    }
  } catch (error) {
    failureCallback(error);
  }
}

/*
 * Monitor task until it ends or has retried getExportTaskStatus()
 * EXPORTDAINSIGHTS.maxStatusRetries times.
 *
 * Uses exponential backoff with up to 60-second pause between retries.
 *
 * (Oracle recommends that you implement an exponential back-off, starting from a few seconds to a
 * maximum of 60 seconds.)
 *
 * Returns task resource
 *
 * @param exportId
 */
async function waitForTaskCompletion (exportId) {
  debug('waitForTaskCompletion');
  const options = {
    delay: 200,
    factor: 3,
    maxAttempts: EXPORTDAINSIGHTS.maxStatusRetries,
    maxDelay: 60000,
    handleError (err, context) {
      if (context.attemptsRemaining < 1) {
        failureCallback(`Export process is still running.\nYou will have to download the exported data for request ID ${exportId} at a later time.`);
      }
      if (err.retryable === false) {
        // We should abort because error indicates that the request is not retryable
        context.abort();
      }
    }
  };

  try {
    return await retry(async context => {
      return rejectIfRequestActive(exportId);
    }, options);
  } catch (error) {
    failureCallback(error);
  }
}

/*
 * Get Export Task
 *
 * Returns response body
 *
 * @param exportId
 */
async function getExportTask (exportId) {
  try {
    const options = {
      host: utils.DOMAIN,
      path: `${EXPORTDAINSIGHTS.basePath}/bots/insights/dataExports/${encodeURIComponent(exportId)}`
    };
    debug(`getExportTask: GET https://${options.host}${options.path}`);
    return ociUtils.promisifiedSendRequest(options);
  } catch (err) {
    failureCallback(err);
  }
}

/*
 * Start Export Task
 *
 * Starts instance analytics export task with the specified name and date range.
 *
 * Returns export ID (resource ID)
 *
 * @param taskName: user-defined task name
 * @param beginDate: start date
 * @param endDate: end date@
 * @param purge: (optional) true if want to purge after export. Default = false.
 *   defaule export
 */
// Query parms: odaId, maxFileLength, since, until
async function startExportTask (id, taskName, beginDate, endDate) {
  const body = {};
  body.name = taskName;
  body.taskType = EXPORTDAINSIGHTS.taskType;
  body.insightsDataExport = EXPORTDAINSIGHTS.insightsDataExport;
  // The double not basically coerces value into its equal boolean form
  const sinceQueryParm = (!!beginDate)
    ? `&since=${encodeURIComponent(beginDate)}` : '';
  const untilQueryParm = (!!endDate)
    ? `&until=${encodeURIComponent(endDate)}` : '';
  const options = {
    host: utils.DOMAIN,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    //change based on which file you want to download. botId foe Skill ,odaId for digital assistant
    path: `${EXPORTDAINSIGHTS.basePath}/bots/insights/dataExports?botId=${encodeURIComponent(id)}&maxFileLength=${encodeURIComponent(EXPORTDAINSIGHTS.maxFileLength)}${sinceQueryParm}${untilQueryParm}`
  };
  debug(`startExportTask: ${options.method} http://${options.host}${options.path}`);
  debug(`Headers: ${JSON.stringify(options.headers)}`);
  debug(`Body: ${JSON.stringify(body)}`);
  return ociUtils.promisifiedSendRequest(options, JSON.stringify(body));
}

/*
 * Write exported ZIP files to the output directory
 *
 * @param exportId
 * @param outDir - full path to the output directory
 *
 */

async function writeExportedData (exportId, outDir, fileNames) {
    //console.log(exportId)
  let i;
  for (i = 0; i < fileNames.length; i++) {
    const options = {
      encoding: null,
      host: utils.DOMAIN,
      path: `${EXPORTDAINSIGHTS.basePath}/bots/insights/dataExports/${encodeURIComponent(exportId)}/files/${encodeURIComponent(fileNames[i])}`
    };
    debug(`writeExportedData: GET http://${options.host}${options.path}`);
    console.log(`Downloading ${outDir.trim()}/${fileNames[i]}`);
    return ociUtils.promisifiedWriteZipResponse(options, `${outDir.trim()}/${fileNames[i]}`);
  }
}

/*
 * Main
 *
 * @parameters - object that contains the user-provided script arguments,
 * which are defined in and processed by scriptArgs.js.
 *
 */
const run = async (parameters) => {
  try {
    DEBUG = (parameters.debug === undefined) ? false : parameters.debug;
    const zipFilePath =
    (parameters.outpath.indexOf('~/') === 0)
      ? parameters.outpath.replace('~', os.homedir())
      : parameters.outpath;
    let errorsFound = false;
    // validate zip file path is a directory
    try {
      if (!fs.statSync(zipFilePath.trim()).isDirectory()) {
        console.log(`${zipFilePath} is not a directory.`);
        errorsFound = true;
      }
    } catch (e) {
      console.log(`${zipFilePath} doesn't exist.`);
      errorsFound = true;
    }
    // validate begin and end dates are in the right format and are valid dates
    if (!isDateValid('begin', parameters.begindate)) errorsFound = true;
    if (!isDateValid('end', parameters.enddate)) errorsFound = true;
    if (errorsFound) {
      failureCallback('One or more arguments are invalid. Correct the values and try again.');
    }
    const response = await startExportTask(parameters.id, parameters.taskname, parameters.begindate, parameters.enddate);
    const exportJobId = response.jobId;
    debug(`Export ID: ${exportJobId}`);
    console.log(`The export job ${exportJobId} has started.\nWaiting for the job to finish...`);
    const taskResource = await waitForTaskCompletion(exportJobId);
    const finalStatus = taskResource.status;
    const filenames = taskResource.filenames;
    debug(`run() final export task status: ${finalStatus.toUpperCase()}`);
    console.log(finalStatus);
    switch (finalStatus.toUpperCase()) {
       
      case 'EXPORT_SUCCEEDED': {
          //console.log('im here')
        try {
          await writeExportedData(exportJobId, zipFilePath, filenames);
        } catch (error) {
          console.log('Can\'t download the insights ZIP files. The reported error was:');
          failureCallback(error);
        }
        console.log(`The export is done. The files are in the ${zipFilePath} directory.`);
        break;
      }
      case 'EXPORT_FAILED':
        console.log(taskResource.error);
        break;
      case 'NO_DATA':
        console.log('There isn\'t any data to export.');
        if (('begindate' in parameters) || ('enddate' in parameters)) {
          console.log('Try a different date range.');
        }
        break;
      default:
        console.log(`The export task is still running. You'll have to download the file later. The export task ID = ${exportJobId}`);
    }
  } catch (err) {
    failureCallback(err);
  }
};
exports.run = run;
function isDateValid (type, date) {
  if (date !== undefined) {
    if (date.length) {
      if (!/^\d\d\d\d-[0-1]\d-[0-3]\d$/.test(date)) {
        console.log(`The ${type} date ${date} is not in the format YYYY-MM-DD.`);
        return false;
      }
      const d = new Date(date);
      const dNum = d.getTime();
      // Test for NaN
      if (!dNum && dNum !== 0) {
        console.log(`The ${type} date ${date} is not a valid date.`);
        return false;
      }
    }
  }
  return true;
}
