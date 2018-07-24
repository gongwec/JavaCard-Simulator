/*!
 * smartcard
 *
 * Contains the Smartcard structure and methods used to process
 * an array of APDU commands.
 *
 * The refactoring incorporates asynchronous functionality.
 *
 * @author Adam Noakes
 * @refactored by Weichao Gong
 * University of Southampton
 */

/**
 * Module dependencies.
 * @private
 */
var eeprom = require('./eeprom.js');
var apdu = require('../javacard/framework/APDU.js');
var ram = require('./ram.js');
var appletManager = require('./applet-manager.js');

/**
 * Module exports.
 * @type {Object}
 */
module.exports = {
	/**
	 * Represents a a virtual smart card.
	 * 
	 * @param {String} cardName The name of the card, used in the card manager
	 */
    Smartcard: function(cardName){
        this.EEPROM = new eeprom.EEPROM();
        this.RAM = new ram.RAM();
        //set the card na me
        this.EEPROM.cardName = cardName;
    },

    // /**
	//  * Wrapper function for processScript.
	//  *
	//  * @param  {Smartcard} smartcard  The Smartcard object.
	//  * @param  {Array}     apduScript An array of apdu commands.
	//  * @param  {Function}  cb         The callback function
	//  */
    // process: function(smartcard, apduScript, cb){
	// 	processScript(smartcard, apduScript, cb);
    // }

	/**
	 * Async Wrapper function for processScript.
	 *
	 * @param  {Smartcard} smartcard   The Smartcard object.
	 * @param  {Array}     apduScript  An array of apdu commands.
	 * @return {Promise}   result      The result of the process.
	 * @author Weichao Gong
	 * University of Southampton
	 */
	process: async function(smartcard, apduScript){
		try{
            var result = await processScript(smartcard, apduScript);
            return result;
		}catch (e) {
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
	}
};

// /**
//  * Takes an array of APDU commands and calls processAPDU on each one,
//  * one by one.
//  *
//  * @param  {Smartcard} smartcard  The Smartcard object.
//  * @param  {Array}     apduScript An array of apdu commands.
//  * @param  {Function}  cb         The callback function
//  */
// function processScript(smartcard, apduScript, cb){
// 	if(!(apduScript instanceof Array)){
// 		return cb(new Error('Unrecognised APDU format'), '0x6FFF');
// 	}
//
// 	processAPDU(smartcard, apduScript.shift(), function(err, res){
// 		if(err){
// 			setImmediate(function() {
// 				cb(err, res);
// 			});
// 		} else if(apduScript.length > 0 && apduScript[0].constructor === Array &&
// 			apduScript[0][0] !== null && apduScript[0][0] !== undefined){
// 			processScript(smartcard, apduScript, cb);
// 		} else {
// 			setImmediate(function() {
// 				cb(null, res);
// 			});
// 		}
// 	});
// }

/**
 * Takes an array of APDU commands and calls processAPDU on each one,
 * one by one.
 *
 * @param  {Smartcard} smartcard  The Smartcard object.
 * @param  {Array}     apduScript An array of apdu commands.
 * @return {Promise}   result      The result of the process.
 * @author Weichao Gong
 * University of Southampton
 */
async function processScript(smartcard, apduScript){
    if(!(apduScript instanceof Array)){
        return new Promise(function (resolve, reject) {
            reject(new Error('0x6FFF'));
        });
    }
    try{
        var result = await processAPDU(smartcard, apduScript.shift())
            .catch(error => {return new Promise(function (resolve, reject) {
                reject(error);
            });});
        if(apduScript.length > 0 && apduScript[0].constructor === Array &&
            apduScript[0][0] !== null && apduScript[0][0] !== undefined){
            return await processScript(smartcard, apduScript)
                .catch(error => {return new Promise(function (resolve, reject) {
                    reject(error);
                });});
		}else{
        	return result;
		}
	}catch (e) {
        return new Promise(function (resolve, reject) {
                reject(e);
        });
    }
}


// /**
//  * Takes a single APDU commands as an array sends it to the applet manager
//  * one by one to be processed.
//  *
//  * @param  {Smartcard} smartcard The Smartcard object.
//  * @param  {Array}     apduArray An apdu command as a byte array.
//  * @param  {Function}  cb        The callback function
//  */
// function processAPDU(smartcard, apduArray, cb){
//     var tmpApdu = new apdu.APDU(); //contruct an APDU objects
//     apdu.constr(tmpApdu, apduArray);
//     if(tmpApdu.broken){
//         return cb(new Error("Broken APDU"), "0x6F00");
//     }
//
//     //Set the APDU object on the first position of the object heap
//     smartcard.EEPROM.objectheap[0] = tmpApdu;
//
//     //Reset variables
//     smartcard.RAM.transaction_buffer = [];
//     smartcard.RAM.transactionFlag = false;
//     smartcard.RAM.selectStatementFlag = 0;
//
//     appletManager.process(smartcard, tmpApdu, cb);
// }

/**
 * Takes a single APDU commands as an array sends it to the applet manager
 * one by one to be processed.
 *
 * @param  {Smartcard} smartcard The Smartcard object.
 * @param  {Array}     apduArray An apdu command as a byte array.
 * @return {Promise}   result      The result of the process.
 * @author Weichao Gong
 * University of Southampton
 */
async function processAPDU(smartcard, apduArray){
    var tmpApdu = new apdu.APDU(); //contruct an APDU objects
    apdu.constr(tmpApdu, apduArray);
    if(tmpApdu.broken){
        return new Promise(function (resolve, reject) {
            reject(new Error('0x6F00'));
        });
    }

    //Set the APDU object on the first position of the object heap
    smartcard.EEPROM.objectheap[0] = tmpApdu;

    //Reset variables
    smartcard.RAM.transaction_buffer = [];
    smartcard.RAM.transactionFlag = false;
    smartcard.RAM.selectStatementFlag = 0;

    try{
        var result = await appletManager.process(smartcard, tmpApdu)
            .catch(error => {return new Promise(function (resolve, reject) {
                reject(error);
            });});
        return result;
	}catch (e) {
        return new Promise(function (resolve, reject) {
            reject(e);
        });
    }
}