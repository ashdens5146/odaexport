'use strict';
/**
 * Version 1.0.1
 *
 * Functions to define and process the runtime arguments and to
 * define prompts for missing required arguments.
 **/

const fs = require('fs');
const os = require('os');
const argv = require('argv');
const path = require('path');

/*
 * Gets the script arguments.
 *
 * Returns data object with these properties
 *   options: Array of argument options (name, short, type, description)
 *   input: The result from argv.option(argvOptions).run()
 */
const getScriptArguments = async () => {
  try {
    argv.info('Export a digital assistant\'s insights data.');
    const argvOptions = [{
      name: 'id',
      short: 'i',
      type: 'string',
      description: 'ID of the digital assistant from which to get the data.'
    },
    {
      name: 'taskname',
      short: 't',
      type: 'string',
      description: 'Your name for the export task. Defaults to a generated task name.'
    },
    {
      name: 'begindate',
      short: 'b',
      type: 'string',
      description: '(Optional) The begin date for the data to export, inclusive. Format: yyyy-mm-dd. Defaults to the earliest date for the requested data.',
      example: '--begindate = YYYY-MM-DD'
    },
    {
      name: 'enddate',
      short: 'e',
      type: 'string',
      description: '(Optional) The end date for the data to export, inclusive. Format: yyyy-mm-dd. Defaults to today.',
      example: '--enddate = YYYY-MM-DD'
    },
    {
      name: 'outpath',
      short: 'o',
      type: 'string',
      description: 'The full pathname of the directory to store the downloaded ZIP files in.'
    },
    {
      name: 'configpath',
      short: 'c',
      type: 'string',
      description: 'The full path to your OCI configuration file.'
    },
    {
      name: 'debug',
      type: 'boolean',
      description: '(Optional) Print debug messages.',
      example: '--debug'
    }
    ];
    const args = {};
    args.input = argv.option(argvOptions).run();
    args.options = argvOptions;
    return args;
  } catch (err) {
    console.log(err);
  }
};

/*
  * Compiles prompts for required run parameters that weren't supplied in the script args
  *
  * Returns questions for inquirer.prompt
  *
  * @parm argvOptions - argvOptions object for argv.option(argvOptions).run()
  * @parm inputArgs - the result of calling argv.option(argvOptions).run().
  *   That is, the actual args that the user ran the script with.
  */
function getPromptQuestions (argvOptions, inputArgs) {
  const questions = [];
  for (let argI in argvOptions) {
    if (inputArgs[argvOptions[argI].name] === undefined) {
      switch (argvOptions[argI].name) {
        case 'id':
          questions.push({
            name: 'id',
            type: 'input',
            message: 'Enter the digital assistant\'s ID:',
            validate: function (value) {
              if (value.length) {
                return true;
              } else {
                return 'Please enter the digital assistant\'s ID.';
              }
            }
          });
          break;
        case 'taskname':
          questions.push({
            name: 'taskname',
            type: 'input',
            message: '(Optional) Enter a name to identify the export task:'
          });
          break;
        case 'outpath':
          questions.push({
            name: 'outpath',
            type: 'input',
            message: 'Where should the ZIP files go (full directory path)?',
            validate: function (value) {
              if (value.length) {
                const opath = (value.indexOf('~/') === 0)
                  ? value.replace('~', os.homedir())
                  : value;
                let flag = true;
                try {
                  if (!fs.statSync(opath.trim()).isDirectory()) {
                    return value + ' is not a directory.';
                  }
                } catch (e) {
                  flag = value + ' doesn\'t exist.';
                }
                return flag;
              } else {
                return 'Please enter the full path of the directory to put the ZIP files in.';
              }
            }
          });
          break;
        case 'configpath':
          questions.push({
            name: 'configpath',
            type: 'input',
            message: 'Enter the full OCI config file path:',
            validate: function (value) {
              if (value.length) {
                const cpath =
                  (value.indexOf('~/') === 0)
                    ? value.replace('~', os.homedir())
                    : value;
                let flag = true;
                try {
                  // require() doesn't work with relative paths
                  if (!path.isAbsolute(cpath.trim())) {
                    return 'Please enter the file\'s absolute path.';
                  }
                  if (fs.statSync(cpath.trim()).isDirectory()) {
                    return value + ' is not a file.';
                  }
                } catch (e) {
                  flag = value + ' doesn\'t exist.';
                }
                return flag;
              } else {
                return 'Please enter the config file\'s full path';
              }
            }
          });
          break;
        case 'begindate':
          questions.push({
            name: 'begindate',
            type: 'input',
            message: '(Optional) Enter the begin date in the format YYYY-MM-DD. Defaults to the earliest date:',
            validate: function (value) {
              if (value.length) {
                if (!/^\d\d\d\d-[0-1]\d-[0-3]\d$/.test(value)) {
                  return 'Please use the format YYYY-MM-DD. ' +
                  'You can omit the date to default to the earliest date.';
                }
                const d = new Date(value);
                const dNum = d.getTime();
                // Test for NaN
                if (!dNum && dNum !== 0) {
                  return 'Please enter a valid date in the format YYYY-MM-DD. ' +
                    'You can omit the date to default to the earliest date.';
                }
              }
              return true;
            }
          });
          break;
        case 'enddate':
          questions.push({
            name: 'enddate',
            type: 'input',
            message: '(Optional) Enter the end date in the format YYYY-MM-DD. Defaults to the earliest date:',
            validate: function (value) {
              if (value.length) {
                // if(!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString))
                if (!/^\d\d\d\d-[0-1]\d-[1-3]\d$/.test(value)) {
                  return 'Please use the format YYYY-MM-DD. ' +
                  'You can omit the date to default to today.';
                }
                const d = new Date(value);
                const dNum = d.getTime();
                // Test for NaN
                if (!dNum && dNum !== 0) {
                  return 'Please enter a valid date in the format YYYY-MM-DD. ' +
                    'You can omit the date to default to today.';
                }
              }
              return true;
            }
          });
          break;
      }
    }
  }
  return questions;
}

exports.getArguments = getScriptArguments;
exports.getPromptQuestions = getPromptQuestions;
