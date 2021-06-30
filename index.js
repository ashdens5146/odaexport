'use strict';
/*
 * index.js
 * Version 1.0.2
 *
 * Gets the run arguments and calls the JavaScript that performs the actions.
 *
 * Requires a config file that contains the OCI signing values in this format:
 * {
 *   "privateKeyPath": "<keypath goes here>",
 *   "tenancyId": "<OCI tenancy ID goes here>",
 *   "userId": "<OCI auth user ID goes here>",
 *   "fingerprint": "<OCI fingerprint goes here>",
 *   "domain": "<domain goes here>.com"
 * }
 *
 * See https://docs.cloud.oracle.com/iaas/Content/API/Concepts/apisigningkey.htm
 * for information about how to get the signing info and private key.
 *
 * Before running this example, install the necessary dependencies by running
 * npm install http-signature jssha argv inquirer @lifeomic/attempt fs os path
 *
 * Run this script with the argument --help to see information about the run parameters,
 * which are set up in scriptArgs.js.
 */

const exportDaInsights = require('./lib/export-da-insights.js');
const utils = require('./lib/utils.js');
const scriptArgs = require('./lib/scriptArgs.js');
const inquirer = require('inquirer');

/*
 * Ask the user to enter any required arguments that weren't
 * provided when the script was invoked.
 *
 * Returns a key/value hash that contains all the run argument
 * values - both from the command line and from the prompted questions.
 *
 * @parm options - an array of argv.option objects.
 * @parm parameters - a key/value hash that contains the arguments that
 *   were passed when the user invoked the script.
 *
 */
const getMissingArguments = async (options, parameters) => {
  var parms = parameters;
  try {
    var questions = scriptArgs.getPromptQuestions(options, parameters);
    if (questions.length > 0) {
      const answers = await promptForQuestions(questions);
      const answerKeys = Object.keys(answers);
      for (var a in answerKeys) {
        parms[answerKeys[a]] = answers[answerKeys[a]];
      };
    }
    return parms;
  } catch (err) {
    console.log(err);
  };
};

/*
 * Prompts the user to provide answers for a set of questions.
 *
 * Returns a key/value hash that contains the user's answers for each prompt.
 *
 * @parm questions - a hash that contains question-related values.
 *
 */

const promptForQuestions = async (questions) => {
  try {
    return inquirer.prompt(questions);
  } catch (error) {
    console.log(error);
  }
};

const run = async () => {
  try {
    const args = await scriptArgs.getArguments();
    const finalParms = await getMissingArguments(args.options, args.input.options);
    utils.getConfigData(finalParms.configpath.trim());
    await exportDaInsights.run(finalParms);
  } catch (err) {
    console.log(err);
  }
};

run();
