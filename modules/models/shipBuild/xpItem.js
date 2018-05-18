'use strict';

var itemTypes = require('./itemTypes');
var ships = require('../ships');
var upgrades = require('../upgrades');
var pilots = require('../pilots');
var missions = require('../missions');

var XpItem = function (upgradeType, data) {
    this.upgradeType = upgradeType;
    this.data = data;
};

XpItem.prototype.cost = function () {
    if (this.upgradeType === itemTypes.SHIP_TYPE) {
        return -5;
    } else if (this.upgradeType === itemTypes.STARTING_SHIP_TYPE) {
        var startingShip = ships.getById(this.data.shipId);
        return startingShip.startingXp;
    } else if (this.upgradeType === itemTypes.PILOT_SKILL) {
        // pilot skill costs double skill level upgrading to
        return (this.data.pilotSkill * 2) * -1;
    } else if (this.upgradeType === itemTypes.XP) {
        return this.data.xp;
    } else if (this.upgradeType === itemTypes.BUY_UPGRADE) {
        var upgrade = upgrades.getById(this.data.upgradeId);
        if (upgrade.points === 0) {
            return 0;
        }
        if (upgrade.slot === 'Elite') {
            // Elites are double printed points cost
            return upgrade.points * -2;
        }
        return upgrade.points * -1;
    } else if (this.upgradeType === itemTypes.BUY_PILOT_ABILITY) {
        var pilot = pilots.getById(this.data.pilotId);
        return pilot.skill * -1;
    }
    return 0;
};

XpItem.prototype.label = function () {
    if (this.upgradeType === itemTypes.SHIP_TYPE) {
        var ship = ships.getById(this.data.shipId);
        return 'Change ship: ' + ship.shipData.name;
    } else if (this.upgradeType === itemTypes.STARTING_SHIP_TYPE) {
        var startingShip = ships.getById(this.data.shipId);
        return 'Starting ship: ' + startingShip.shipData.name;
    } else if (this.upgradeType === itemTypes.PILOT_SKILL) {
        return 'Upgrade pilot skill: PS ' + this.data.pilotSkill;
    } else if (this.upgradeType === itemTypes.MISSION) {
        var mission = missions.getById(this.data.missionId);
        return 'Completed mission: ' + mission.name;
    } else if (this.upgradeType === itemTypes.XP) {
        return 'Gain XP';
    } else if (this.upgradeType === itemTypes.BUY_UPGRADE) {
        var upgrade = upgrades.getById(this.data.upgradeId);
        return upgrade.slot + ': ' + (upgrade.dualCardName || upgrade.name);
    } else if (this.upgradeType === itemTypes.BUY_PILOT_ABILITY) {
        var pilot = pilots.getById(this.data.pilotId);
        return 'Pilot Ability: ' + pilot.name;
    } else if (this.upgradeType === itemTypes.LOSE_UPGRADE) {
        var lostUpgrade = upgrades.getById(this.data.upgradeId);
        return 'Lose upgrade: ' + (lostUpgrade.dualCardName || lostUpgrade.name);
    } else if (this.upgradeType === itemTypes.LOSE_PILOT_ABILITY) {
        var lostPilot = pilots.getById(this.data.pilotId);
        return 'Lose pilot ability: ' + lostPilot.name;
    }
    return '';
};

XpItem.prototype.exportString = function () {
    var idString = '';
    var dataString = '';
    if (this.upgradeType === itemTypes.SHIP_TYPE) {
        dataString = this.data.shipId;
        idString = 'ST';
    } else if (this.upgradeType === itemTypes.STARTING_SHIP_TYPE) {
        dataString = this.data.shipId;
        idString = 'SST';
    } else if (this.upgradeType === itemTypes.PILOT_SKILL) {
        dataString = this.data.pilotSkill;
        idString = 'PS';
    } else if (this.upgradeType === itemTypes.MISSION) {
        dataString = this.data.missionId;
        idString = 'MIS';
    } else if (this.upgradeType === itemTypes.XP) {
        dataString = this.data.xp;
        idString = 'XP';
    } else if (this.upgradeType === itemTypes.BUY_UPGRADE) {
        dataString = this.data.upgradeId;
        idString = 'UP';
    } else if (this.upgradeType === itemTypes.BUY_PILOT_ABILITY) {
        dataString = this.data.pilotId;
        idString = 'PA';
    } else if (this.upgradeType === itemTypes.LOSE_UPGRADE) {
        dataString = this.data.upgradeId;
        idString = 'LUP';
    } else if (this.upgradeType === itemTypes.LOSE_PILOT_ABILITY) {
        dataString = this.data.pilotId;
        idString = 'LPA';
    }
    return {
        key: idString,
        value: dataString
    };
};

XpItem.prototype.parseExportString = function (exportObject) {
    var idString = exportObject.key;
    var dataString = exportObject.value;
    this.data = {};

    if (idString === 'SST') {
        this.data.shipId = dataString;
        this.upgradeType = itemTypes.STARTING_SHIP_TYPE;
    } else if (idString === 'ST') {
        this.data.shipId = dataString;
        this.upgradeType = itemTypes.SHIP_TYPE;
    } else if (idString === 'PS') {
        this.data.pilotSkill = parseInt(dataString, 10);
        this.upgradeType = itemTypes.PILOT_SKILL;
    } else if (idString === 'MIS') {
        this.data.missionId = parseInt(dataString, 10);
        this.upgradeType = itemTypes.MISSION;
    } else if (idString === 'XP') {
        this.data.xp = parseInt(dataString, 10);
        this.upgradeType = itemTypes.XP;
    } else if (idString === 'UP') {
        this.data.upgradeId = parseInt(dataString, 10);
        this.upgradeType = itemTypes.BUY_UPGRADE;
    } else if (idString === 'PA') {
        this.data.pilotId = parseInt(dataString, 10);
        this.upgradeType = itemTypes.BUY_PILOT_ABILITY;
    } else if (idString === 'LUP') {
        this.data.upgradeId = parseInt(dataString, 10);
        this.upgradeType = itemTypes.LOSE_UPGRADE;
    } else if (idString === 'LPA') {
        this.data.pilotId = parseInt(dataString, 10);
        this.upgradeType = itemTypes.LOSE_PILOT_ABILITY;
    }
};

XpItem.prototype.parseExportStringLessV3 = function (exportString) {
    var splitItems = exportString.split('=');
    var splitObject = {
        key: splitItems[0],
        value: splitItems[1]
    };
    this.parseExportString(splitObject);
};

module.exports = XpItem;
