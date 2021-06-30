/**
 * ociUtils.js
 * Version 1.0.2
 * Sign and send request.
 *
 * See https://docs.cloud.oracle.com/iaas/Content/API/Concepts/signingrequests.htm
 */

 const https = require('https');
 const httpSignature = require('http-signature');
 const jsSHA = require('jssha');
 const utils = require('./utils.js');
 const fs = require('fs');
 
 /*
  * Send request
  *
  * Returns response body
  *
  * Requires utils.js PRIVATE_KEY, KEY_FINGERPRINT, TENANCY_ID, AUTH_USER_ID
  *
  * @param options - request options
  * @param body - request body if POST, PUT, or PATCH
  */
 
 function promisifiedSendRequest (options, body) {
   return new Promise((resolve, reject) => {
     const request = https.request(options, function (response) {
       let responseBody = '';
       response.on('data', function (chunk) {
         responseBody += chunk;
       });
       response.on('error', function (error) {
         reject(new Error(error));
       });
       response.on('end', function () {
         if (response.statusCode < 300) {
           (response.headers['content-type'] === 'application/json') ? resolve(JSON.parse(responseBody)) : resolve(responseBody);
         } else {
           if (response.headers['content-type'] === 'application/json') {
             const errorResponse = JSON.parse(responseBody);
             reject(new Error(`${errorResponse.status}: ${errorResponse.title}: ${errorResponse.detail}`));
           } else {
             reject(new Error(`${response.statusCode}: ${response.statusMessage}`));
           };
         }
       });
     });
     const signOptions = {
       privateKey: utils.PRIVATE_KEY,
       keyFingerprint: utils.KEY_FINGERPRINT,
       tenancyId: utils.TENANCY_ID,
       userId: utils.AUTH_USER_ID
     };
     if (body) {
       signOptions.body = body;
     }
     ;
     sign(request, signOptions);
     (body) ? request.end(body) : request.end();
     request.on('error', function (error) {
       reject(new Error(error));
     });
   });
 }
 exports.promisifiedSendRequest = promisifiedSendRequest;
 
 /*
  * Send request for ZIP data and then write response to the specified ZIP file
  *
  * Returns the content that was written to the ZIP file
  *
  * Requires utils.js PRIVATE_KEY, KEY_FINGERPRINT, TENANCY_ID, AUTH_USER_ID
  *
  * @param options - request options
  * @param full path to output ZIP file
  */
 
 function promisifiedWriteZipResponse (options, outFile) {
   return new Promise((resolve, reject) => {
     const request = https.request(options, function (response) {
       let responseBody = '';
       const writableStream = fs.createWriteStream(outFile);
       response.on('data', function (chunk) {
         responseBody += chunk;
         writableStream.write(chunk);
       });
       response.on('error', function (error) {
         reject(new Error(error));
       });
       response.on('end', function () {
         writableStream.end();
         if (response.statusCode < 300) {
           (response.headers['content-type'] === 'application/json') ? resolve(JSON.parse(responseBody)) : resolve(responseBody);
         } else {
           if (response.headers['content-type'] === 'application/json') {
             const errorResponse = JSON.parse(responseBody);
             reject(new Error(`${errorResponse.status}: ${errorResponse.title}: ${errorResponse.detail}`));
           } else {
             reject(new Error(`${response.statusCode}: ${response.statusMessage}`));
           };
         }
       });
     });
     const signOptions = {
       privateKey: utils.PRIVATE_KEY,
       keyFingerprint: utils.KEY_FINGERPRINT,
       tenancyId: utils.TENANCY_ID,
       userId: utils.AUTH_USER_ID
     };
     sign(request, signOptions);
     request.end();
     request.on('error', function (error) {
       reject(new Error(error));
     });
   });
 }
 exports.promisifiedWriteZipResponse = promisifiedWriteZipResponse;
 
 /*
  * Sign request
  *
  * @param request
  * @param options
  *   privateKey
  *   keyFingerprint
  *   tenancyId
  *   userId
  */
 
 function sign (request, options) {
   const apiKeyId = `${options.tenancyId}/${options.userId}/${options.keyFingerprint}`;
   let headersToSign = [
     'host',
     'date',
     '(request-target)'
   ];
   const methodsThatRequireExtraHeaders = ['POST', 'PUT', 'PATCH'];
   if (methodsThatRequireExtraHeaders.indexOf(request.method.toUpperCase()) !== -1) {
     options.body = options.body || '';
     // eslint-disable-next-line new-cap
     const shaObj = new jsSHA('SHA-256', 'TEXT');
     shaObj.update(options.body);
     request.setHeader('Content-Length', options.body.length);
     request.setHeader('x-content-sha256', shaObj.getHash('B64'));
     headersToSign = headersToSign.concat([
       'content-type',
       'content-length',
       'x-content-sha256'
     ]);
   }
   httpSignature.sign(request, {
     key: options.privateKey,
     keyId: apiKeyId,
     headers: headersToSign
   });
   const newAuthHeaderValue = request.getHeader('Authorization').replace('Signature ', 'Signature version="1",');
   request.setHeader('Authorization', newAuthHeaderValue);
 }
 