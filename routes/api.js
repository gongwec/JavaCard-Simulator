/*!
 * api
 *
 * This is the RESTful api. This file handles all requests for 
 * the simulator application.
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
var express = require('express');
var validator = require('validator');
var router = express.Router();
var smartcard = require('../simulator/smartcard/smartcard.js');
var eeprom = require('../simulator/smartcard/eeprom.js');

/**
 * Module exports.
 * @return {Router}
 */
module.exports = function () {
    var router = express.Router();

    /* GET smartcards -> Return available smart cards. */
    router.get('/smartcards', function (req, res) {
        if (!req.session.smartcards) {
            req.session.smartcards = {};
        }
        res.send(Object.keys(req.session.smartcards));
    });

    /* POST smartcards -> New smart card. */
    router.post('/smartcards', async function (req, res) {
        if (!req.session.smartcards) {
            req.session.smartcards = {};
        }
        //validate name
        if (!validator.isAlphanumeric(req.body.cardName))
            res.send({
                'result': false,
                'message': "Alphanumeric characters only."
            });

        //Check if the cardname already exists
        if (req.session.smartcards[req.body.cardName]) {
            res.send({
                'result': false,
                'message': "Virtual smart card with name " + req.body.cardName + " already exists."
            });
        } else {
            var newcard = new smartcard.Smartcard(req.body.cardName);
            try{
                var result = await addCard(req, newcard);
                //success
                req.session.smartcards[req.body.cardName] = newcard._id;
                res.send({
                    'result': true,
                    'card': result,
                });
            }catch (e) {
                console.log(e);
                // If it failed, return error
                res.send({
                    'result': false,
                    'message': "There was a problem adding the card to the database."
                });
            }

            // req.db.collection('smartcards').insert(newcard, function (err, doc) {
            //     if (err) {
            //         console.log(err);
            //         // If it failed, return error
            //         res.send({
            //             'result': false,
            //             'message': "There was a problem adding the information to the database."
            //         });
            //     } else {
            //         //success
            //         req.session.smartcards[req.body.cardName] = newcard._id;
            //         res.send({
            //             'result': true,
            //             'cardName': newcard.EEPROM.cardName
            //         });
            //     }
            // });
        }
    });

    /* GET  smartcards/:cardName -> Load smart card, specified by cardName */
    router.get('/smartcards/:cardName', function (req, res) {
        if (!req.session.smartcards) {
            req.session.smartcards = {};
        }
        if (req.session.smartcards[req.params.cardName]) {
            req.session.loadedCard = req.session.smartcards[req.params.cardName];
            res.send({
                'result': true,
                'cardName': req.params.cardName
            });
        } else {
            res.send({
                'result': false,
                'message': "Virtual smart card with name " + req.params.cardName + " could not be found."
            });
        }
    });

    /* DELETE  smartcards/:cardName -> Delete smart card, specified by cardName */
    router.delete('/smartcards/:cardName', async function (req, res) {
        if (!req.session.smartcards) {
            req.session.smartcards = {};
        }
        var smartcardId = req.session.smartcards[req.params.cardName];
        if (smartcardId) {
            try{
                await deleteCard(req, smartcardId);
                req.session.smartcards[req.params.cardName] = undefined;
                res.send({
                    'result': true,
                    'cardName': req.params.cardName
                });
            }catch (e) {
                console.log(e);
                res.send({
                    'result': false,
                    'message': "An error occured trying to remove " + req.params.cardName + "."
                });

            }
            // req.db.collection('smartcards').remove(
            //     {_id: require('mongodb').ObjectID(smartcardId)}, function (err, docs) {
            //         if (err) {
            //             console.log(err);
            //             res.send({
            //                 'result': false,
            //                 'message': "An error occured trying to remove " + req.params.cardName + "."
            //             });
            //         } else {
            //             req.session.smartcards[req.params.cardName] = undefined;
            //             res.send({
            //                 'result': true,
            //                 'cardName': req.params.cardName
            //             });
            //         }
            //     }
            // );
        } else {
            res.send({
                'result': false,
                'message': "No card with name: " + req.params.cardName + "."
            });
        }

    });

    /* POST apdu -> Send APDU to card's processor for execution. */
    router.post('/apdu', async function (req, res) {
        if (!req.session.loadedCard) {
            //no card selected apdui
            res.send({
                'APDU': "0x6A82",
                'error': 'No smartcard currently loaded.'
            });
        } else {
            //Load the smartcard from the user's session
            try{
                var loadedCard = await findCard(req, req.session.loadedCard);
            }catch (e) {
                console.log(e);
                res.send({
                    'APDU': "0X6A82",
                    'error': 'Could not find smartcard'
                });
            }
            if(!loadedCard){
                res.send({
                    'APDU': "0X6A82",
                    'error': 'Could not find smartcard'
                });
            }
            try{
                var result = await smartcard.process(loadedCard, req.body.APDU)
                    .catch(error => {
                        console.log(error);
                        res.send({
                            'APDU': error.message,
                            'error': 'some error'
                        });
                    });
                await updateCard(req, loadedCard);
                res.send({
                    'APDU': result,
                });
            }catch (e) {
                res.send({
                    'APDU': e.message,
                    'error': 'some error'
                });
            }



            // req.db.collection('smartcards').findOne(
            //     {_id: require('mongodb').ObjectID(req.session.loadedCard)},
            //     function (err, loadedCard) {
            //         //Check smartcard was loaded successfully
            //         if (err || !loadedCard) {
            //             console.log(err);
            //             res.send({
            //                 'APDU': "0x6A82",
            //                 'error': 'Could not find smartcard'
            //             });
            //         } else {
            //             console.log(loadedCard);
            //             smartcard.process(loadedCard, req.body.APDU, function (executionError, apduResponse) {
            //                 //Update the smartcard object
            //                 req.db.collection('smartcards').update(
            //                     {_id: require('mongodb').ObjectID(req.session.loadedCard)},
            //                     loadedCard,
            //                     {upsert: true}, function (err, result) {
            //                         if (err) {
            //                             console.log(err);
            //                         } else if (executionError) {
            //                             res.send({
            //                                 'APDU': apduResponse,
            //                                 'error': executionError.message
            //                             });
            //                         } else {
            //                             res.send({'APDU': apduResponse});
            //                         }
            //                     }
            //                 );
            //             });
            //         }
            //     }
            // );
        }
    });
    return router;
};

/**
 * Add a new card into the database in an async way, return a promise
 * @param {Request}   req      The request
 * @param {Smartcard} newcard  The new card
 * @author Weichao Gong
 * University of Southampton
 */
async function addCard(req, newcard) {
    try{
        var collection = await req.db.collection('smartcards');
        var result = await collection.insert(newcard);
        return result;
    }catch (e) {
        console.log(e);
    }

}

/**
 * @param {Request}       req           The request
 * @param {Smartcard_Id}  smartcardId   The id of the card
 * @author Weichao Gong
 * University of Southampton
 */
async function deleteCard(req, smartcardId){
    try{
        var collection = await req.db.collection('smartcards');
        await collection.remove({_id: require('mongodb').ObjectID(smartcardId)});
    }catch (e) {
        console.log(e);
    }

}

/**
 * @param {Request}      req           The request
 * @param {Smartcard}    LoadedCard    Currently loaded card
 * @author Weichao Gong
 * University of Southampton
 */
async function findCard(req, loadedCard){
    try{
        var collection = await req.db.collection('smartcards');
        var result = await collection.findOne({_id: require('mongodb').ObjectID(loadedCard)});
        return result;
    }catch (e) {
        console.log(e);
    }
}

/**
 * @param {Request}      req           The request
 * @param {Smartcard}    LoadedCard    Currently loaded card
 * @author Weichao Gong
 * University of Southampton
 */
async function updateCard(req, loadedCard){
    try{
        var collection = await req.db.collection('smartcards');
        await collection.update(
            {_id: require('mongodb').ObjectID(req.session.loadedCard)},
            loadedCard,
            {upsert: true});
    }catch (e) {
        console.log(e);
    }
}