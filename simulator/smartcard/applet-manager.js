/*!
 * api
 *
 * This file simulates the applet manager applet that would be
 * installed on a smart card by the manufacturer. All APDUs are 
 * processed by the applet manager first.
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
var apdu = require('../javacard/framework/APDU.js');
var eeprom = require('./eeprom.js');
var installer = require('./installer.js');
var mnemonics = require('../utilities/mnemonics.js');
var jcvm = require('../jcre/jcvm.js');
var cap = require('./cap.js');
var util = require('../utilities/utilities.js');

/**
 * Module exports.
 * @type {Object}
 */
module.exports = {

    // /**
    //  * Process a single APDU command with the applet manager.
    //  *
    //  * @param  {Smartcard} smartcard
    //  * @param  {Array} buffer
    //  * @param  {Function} cb;
    //  */
    // process: function(smartcard, theAPDU, cb){
    //     var buffer = theAPDU._buffer;
    //     //If select applet command
    //     if (buffer.slice(0,4).join() === [0x00, 0xA4, 0x04, 0x00].join()) {
    //         return this.selectApplet(smartcard, buffer.slice(5,5+theAPDU.lc), cb);
    //     } else if(!smartcard.RAM.selectedApplet.AID){
    //       return cb(new Error('No Applet Selected'), '0x6A82');
    //     }
    //
    //     //If the selected applet is the installer and an install command has been sent, process by installer module
    //     if((smartcard.RAM.selectedApplet.AID.join() === installer.AID.join())){
    //         return installer.process(smartcard, buffer, cb);
    //     }
    //     jcvm.process(smartcard, [0], function(err, res){
    //         if(err){
    //             cb(err, res);
    //         } else {
    //             var output = "";
    //             var apdu = smartcard.EEPROM.objectheap[0];
    //             if (apdu.state >= 3) {
    //                 var outputLength = Math.min(apdu.le, apdu._buffer.length);
    //                 for (var k = 0; k < outputLength ; k++) {
    //                     if(apdu._buffer[k]){
    //                         output += util.addX(util.addpad(apdu._buffer[k])) + " ";
    //                     } else {
    //                         output += "0x00 ";
    //                     }
    //                 }
    //             }
    //             cb(undefined, output + res);
    //         }
    //     });
    // },

    /**
     * Process a single APDU command with the applet manager.
     *
     * @param  {Smartcard} smartcard
     * @param  {Array} buffer
     * @return {Promise}   result      The result of the process.
     * @author Weichao Gong
     * University of Southampton
     */
    process: async function(smartcard, theAPDU){
        var buffer = theAPDU._buffer;
        //If select applet command
        if (buffer.slice(0,4).join() === [0x00, 0xA4, 0x04, 0x00].join()) {
            return await this.selectApplet(smartcard, buffer.slice(5,5+theAPDU.lc))
                .catch(error => {return new Promise(function (resolve, reject) {
                    reject(error);
                });});
        } else if(!smartcard.RAM.selectedApplet.AID){
            return new Promise(function (resolve, reject) {
                reject(new Error('0x6A82'));
            });
        }

        //If the selected applet is the installer and an install command has been sent, process by installer module
        try{
            if((smartcard.RAM.selectedApplet.AID.join() === installer.AID.join())){
                var result = await installer.process(smartcard, buffer)
                    .catch(error => {return new Promise(function (resolve, reject) {
                        reject(error);
                    });});
                //console.log(result);
                return result;
            }
        }catch (e) {
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }


        try{
            var res = await jcvm.process(smartcard, [0])
                .catch(error => {return new Promise(function (resolve, reject) {
                    reject(error);
                });});
            var output = "";
            var apdu = smartcard.EEPROM.objectheap[0];
            if (apdu.state >= 3) {
                var outputLength = Math.min(apdu.le, apdu._buffer.length);
                for (var k = 0; k < outputLength ; k++) {
                    if(apdu._buffer[k]){
                        output += util.addX(util.addpad(apdu._buffer[k])) + " ";
                    } else {
                        output += "0x00 ";
                    }
                }
            }
            return new Promise(function (resolve, reject) {
                resolve(output + res);
            });
        }catch (e) {
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    },


    // /**
    //  * Called by process, to select an applet.
    //  *
    //  * @param  {Smartcard} smartcard The smartcard objet.
    //  * @param  {Array}     appletAID The applet to be deselected.
    //  * @param  {Function}  cb        The callback function.
    //  */
    // selectApplet: function (smartcard, appletAID, cb) {
    //     this.deselectApplet(smartcard, appletAID, function(err, res){
    //         if(err){
    //             return cb(err, res);
    //         }
    //         smartcard.RAM.transientData = [];
    //         smartcard.RAM.selectStatementFlag = 1;
    //
    //         //set applet aid and cap file in eeprom
    //         if (setSelectedApplet(smartcard, appletAID)) {
    //             if (smartcard.RAM.selectedApplet.AID.join() === installer.AID.join()) {
    //                 return cb(undefined, "0x9000");
    //             }
    //
    //             for (var j = 0; j < smartcard.RAM.selectedApplet.CAP.COMPONENT_Import.count; j++) {
    //                 if (smartcard.RAM.selectedApplet.CAP.COMPONENT_Import.packages[j].AID.join() === mnemonics.jframework.join()) {
    //                     eeprom.setHeap(smartcard, 0, 160 + (j * 256) + 10);
    //                     break;
    //                 }
    //             }
    //
    //             var startcode = cap.getStartCode(smartcard.RAM.selectedApplet.CAP, appletAID, 6);
    //
    //             var processSelect = function (err, res) {
    //                 if (err) {
    //                     return cb(err, res);
    //                 }
    //                 jcvm.process(smartcard, [0], function (err, res) {
    //                     if (err) {
    //                         smartcard.RAM.selectedApplet = null;
    //                         return cb(err, res);
    //                     }
    //                     return cb(undefined, res);
    //                 });
    //             };
    //
    //             //if the applet has an install method, run it.
    //             if (startcode > 0) {
    //                 jcvm.selectApplet(smartcard, startcode, processSelect);
    //             } else {
    //                 processSelect();
    //             }
    //
    //         } else {
    //             //@adam no applet found
    //             cb(new Error('Applet Not Found'), "0x6A82");
    //         }
    //     });
    // },

    /**
     * Called by process, to select an applet.
     *
     * @param  {Smartcard} smartcard The smartcard objet.
     * @param  {Array}     appletAID The applet to be deselected.
     * @return {Promise}   result    The result of the process.
     * @author Weichao Gong
     * University of Southampton
     */
    selectApplet: async function (smartcard, appletAID) {
        try{
            var res = await this.deselectApplet(smartcard, appletAID)
                .catch(error => {return new Promise(function (resolve, reject) {
                    reject(error);
                });});
            smartcard.RAM.transientData = [];
            smartcard.RAM.selectStatementFlag = 1;

            //set applet aid and cap file in eeprom
            if (setSelectedApplet(smartcard, appletAID)) {
                if (smartcard.RAM.selectedApplet.AID.join() === installer.AID.join()) {
                    return new Promise(function (resolve, reject) {
                        resolve('0x9000');//success
                    });
                }

                for (var j = 0; j < smartcard.RAM.selectedApplet.CAP.COMPONENT_Import.count; j++) {
                    if (smartcard.RAM.selectedApplet.CAP.COMPONENT_Import.packages[j].AID.join() === mnemonics.jframework.join()) {
                        eeprom.setHeap(smartcard, 0, 160 + (j * 256) + 10);
                        break;
                    }
                }

                var startcode = cap.getStartCode(smartcard.RAM.selectedApplet.CAP, appletAID, 6);

                //if the applet has an install method, run it.
                if (startcode > 0) {
                    try{
                        var flag = false;
                        await jcvm.selectApplet(smartcard, startcode)
                            .catch(error => {return new Promise(function (resolve, reject) {
                                reject(error);
                            });});
                        flag = true;
                        var res3 = await jcvm.process(smartcard, [0])
                            .catch(error => {return new Promise(function (resolve, reject) {
                                reject(error);
                            });});
                        return new Promise(function (resolve, reject) {
                            resolve(res3);//success
                        });
                    }catch (e) {
                        if(flag){
                            smartcard.RAM.selectedApplet = null;
                        }
                        return new Promise(function (resolve, reject) {
                            reject(e);
                        });
                    }

                } else {
                    try{
                        var res4 = await jcvm.process(smartcard, [0])
                            .catch(error => {return new Promise(function (resolve, reject) {
                                reject(error);
                            });});
                        return new Promise(function (resolve, reject) {
                            resolve(res4);//success
                        });
                    }catch (e) {
                        smartcard.RAM.selectedApplet = null;
                        return new Promise(function (resolve, reject) {
                            reject(e);
                        });
                    }
                }

            } else {
                //@adam no applet found
                return new Promise(function (resolve, reject) {
                    reject(new Error('0x6A82'));//Applet Not Found
                });
            }

        }catch (e) {
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    },

    // /**
    //  * Called when an applet is selected, to ensure the previously
    //  * selected applet is deselected correctly first.
    //  *
    //  * @param  {Smartcard} smartcard The smartcard objet.
    //  * @param  {Array}     appletAID The applet to be deselected.
    //  * @param  {Function}  cb        The callback function.
    //  */
    // deselectApplet: function(smartcard, appletAID, cb){
    //     var startcode;
    //     if(smartcard.RAM.selectedApplet.appletRef !== null &&
    //         smartcard.RAM.selectedApplet.appletRef >= 0){
    //         startcode = cap.getStartCode(smartcard.RAM.selectedApplet.CAP, appletAID, 4);
    //         if (startcode > 0) {
    //             jcvm.selectApplet(smartcard, startcode, function (err, res) {
    //                 if (err) {
    //                     smartcard.RAM.selectedApplet = null;
    //                     cb(err);
    //                 } else {
    //                     cb(undefined, res);
    //                 }
    //             });
    //         } else {
    //             cb(undefined, undefined);
    //         }
    //     } else {
    //         cb(undefined, undefined);
    //     }
    // }

    /**
     * Called when an applet is selected, to ensure the previously
     * selected applet is deselected correctly first.
     *
     * @param  {Smartcard} smartcard The smartcard objet.
     * @param  {Array}     appletAID The applet to be deselected.
     * @return {Promise}   result    The result of the process.
     * @author Weichao Gong
     * University of Southampton
     */
    deselectApplet: async function(smartcard, appletAID){
        var startcode;
        if(smartcard.RAM.selectedApplet.appletRef !== null &&
            smartcard.RAM.selectedApplet.appletRef >= 0){
            startcode = cap.getStartCode(smartcard.RAM.selectedApplet.CAP, appletAID, 4);
            if (startcode > 0) {
                try{
                    var res = jcvm.selectApplet(smartcard, startcode)
                        .catch(error => {return new Promise(function (resolve, reject) {
                            reject(error);
                        });});
                    return new Promise(function (resolve, reject) {
                        resolve(res);//success
                    });
                }catch (e) {
                    smartcard.RAM.selectedApplet = null;
                    return new Promise(function (resolve, reject) {
                        reject(e);
                    });
                }

            } else {
                return undefined;
            }
        } else {
            return undefined;
        }
    }
};

/**
 * Sets references in EEPROM for the specified applet AID.
 *
 * @param  {EEPROM} EEPROM    The EEPROM object.
 * @param  {Array}  appletAID The applet's AID.
 */
function setSelectedApplet(smartcard, appletAID){
    smartcard.RAM.selectedApplet.AID = appletAID;
    smartcard.RAM.selectedApplet.CAP = eeprom.getPackage(smartcard.EEPROM,
        appletAID.slice(0, appletAID.length-1));
    smartcard.RAM.selectedApplet.appletRef = smartcard.EEPROM.installedApplets[appletAID];
    return (smartcard.RAM.selectedApplet.appletRef !== undefined);
}