'use strict';

var _map = require('lodash/map');
var _filter = require('lodash/filter');
var _bind = require('lodash/bind');
var _each = require('lodash/each');
var _difference = require('lodash/difference');
var _findIndex = require('lodash/findIndex');
var _isUndefined = require('lodash/isUndefined');
var _find = require('lodash/find');
var _first = require('lodash/first');
var _clone = require('lodash/clone');

var upgradesImport = require('../upgrades');
var keyedUpgrades = upgradesImport.keyed;
var pilots = require('../pilots');
var uniquePilots = pilots.unique;

var events = require('../../controllers/events');
var arrayUtils = require('../../utils/array-utils');

var upgradesModel = function (build, upgradeIdList, equippedIdList, pilotIds, equippedAbilityIds) {
    this.build = build;
    // Upgrades in order of purchase
    this.purchased = this.upgradesFromIds(upgradeIdList);
    this.purchasedAbilities = this.abilitiesFromIds(pilotIds);
    this.equippedUpgrades = this.upgradesFromIds(equippedIdList);
    this.equippedAbilities = this.abilitiesFromIds(equippedAbilityIds);
    this.refreshUpgradesState();
};

upgradesModel.prototype.upgradesFromIds = function (upgradeIdList) {
    return _map(upgradeIdList, upgradesImport.getById);
};

upgradesModel.prototype.abilitiesFromIds = function (abilityIdList) {
    return _map(abilityIdList, pilots.getById);
};

upgradesModel.prototype.refreshUpgradesState = function () {
    this.all = this.purchased.concat(this.build.currentShip.startingUpgrades);
    // Validate and equip upgrades to slots
    var validatedEquippedUpgrades = this.validateUpgrades(this.equippedUpgrades);
    var validatedEquippedAbilities = this.validateAbilities(this.equippedAbilities);
    var equipped = this.equipUpgradesToSlots(validatedEquippedUpgrades, validatedEquippedAbilities);
    this.equippedUpgrades = equipped.equippedUpgrades;
    this.equippedAbilities = equipped.equippedAbilities;
    // Can only call getDisabled() once equipped is set, as it needs to look at slots potentially added by equipping
    this.disabled = this.getDisabledUpgrades();
    this.disabledAbilities = this.getDisabledAbilities();
    this.unequipped = this.getUnequippedUpgrades();
    this.unequippedAbilities = this.getUnequippedAbilities();
};

upgradesModel.prototype.validateUpgrades = function (upgradesList) {
    // Make sure equipped list only contains upgrades we have purchased or started with
    var filteredUpgrades = arrayUtils.intersectionSingle(upgradesList, this.all);
    // Make sure equipped list only contains upgrade types allowed on ship
    filteredUpgrades = _filter(filteredUpgrades, _bind(this.upgradeAllowedOnShip, this));
    return filteredUpgrades;
};

upgradesModel.prototype.validateAbilities = function (pilotsList) {
    // Make sure equipped list only contains upgrades we have purchased
    var filteredUpgrades = arrayUtils.intersectionSingle(pilotsList, this.purchasedAbilities);
    // Make sure equipped list only contains abilities allowed in the build
    filteredUpgrades = _filter(filteredUpgrades, _bind(this.abilityAllowedInBuild, this));
    return filteredUpgrades;
};

upgradesModel.prototype.getDisabledUpgrades = function () {
    var thisModel = this;
    var slotsAllowedInBuild = this.build.upgradeSlots.allUsableSlotTypes();

    var disabledUpgrades = [];

    _each(this.purchased, function (upgrade) {
        var allowedOnShip = thisModel.upgradeAllowedOnShip(upgrade);
        var allowedInSlots = (slotsAllowedInBuild.indexOf(upgrade.slot) > -1);

        if (!allowedOnShip || !allowedInSlots) {
            disabledUpgrades.push(upgrade);
        }
    });

    return disabledUpgrades;
};

upgradesModel.prototype.getDisabledAbilities = function () {
    var thisModel = this;
    var slotsAllowedInBuild = this.build.upgradeSlots.allUsableSlotTypes();

    var disabledUpgrades = [];

    // Abilities only go in Elite slots
    var allowedInSlots = (slotsAllowedInBuild.indexOf('Elite') > -1);

    _each(this.purchasedAbilities, function (pilot) {
        var allowedOnShip = thisModel.abilityAllowedInBuild(pilot);

        if (!allowedOnShip || !allowedInSlots) {
            disabledUpgrades.push(pilot);
        }
    });

    return disabledUpgrades;
};

upgradesModel.prototype.getUnequippedUpgrades = function () {
    // Remove *All* copies of any upgrades which should be disabled
    var notDisabled = _difference(this.purchased, this.disabled);
    // Remove one copy of each item which is equipped
    var unequipped = arrayUtils.differenceSingle(notDisabled, this.equippedUpgrades);
    return unequipped;
};

upgradesModel.prototype.getUnequippedAbilities = function () {
    // Remove *All* copies of any abiltiies which should be disabled
    var notDisabled = _difference(this.purchasedAbilities, this.disabledAbilities);
    // Remove one copy of each item which is equipped
    var unequipped = arrayUtils.differenceSingle(notDisabled, this.equippedAbilities);
    return unequipped;
};

upgradesModel.prototype.buyCard = function (upgradeId) {
    var upgrade = upgradesImport.getById(upgradeId);
    this.purchased.push(upgrade);
    this.refreshUpgradesState();
    events.trigger('model.build.upgrades.add', this.build);
};

upgradesModel.prototype.buyPilotAbility = function (pilotId) {
    var pilot = pilots.getById(pilotId);
    this.purchasedAbilities.push(pilot);
    this.refreshUpgradesState();
    events.trigger('model.build.pilotAbilities.add', this.build);
};

upgradesModel.prototype.loseCard = function (upgradeId) {
    // remove the first version of this upgrade we find in the purchased list
    var foundIndex = _findIndex(this.purchased, function (item) {
        return item.id === upgradeId;
    });
    if (!_isUndefined(foundIndex)) {
        // remove found upgrade from purchased list
        this.purchased.splice(foundIndex, 1);
    }
    this.refreshUpgradesState();
    events.trigger('model.build.upgrades.lose', this.build);
};

upgradesModel.prototype.loseAbility = function (pilotId) {
    var foundIndex = _findIndex(this.purchasedAbilities, function (item) {
        return item.id === pilotId;
    });
    if (!_isUndefined(foundIndex)) {
        this.purchasedAbilities.splice(foundIndex, 1);
    }
    this.refreshUpgradesState();
    events.trigger('model.build.pilotAbilities.lose', this.build);
};

upgradesModel.prototype.equip = function (upgradeId) {
    var upgrade = upgradesImport.getById(upgradeId);
    this.equippedUpgrades.push(upgrade);
    this.refreshUpgradesState();
    events.trigger('model.build.equippedUpgrades.update', this.build);
};

upgradesModel.prototype.equipAbility = function (pilotId) {
    var pilot = pilots.getById(pilotId);
    this.equippedAbilities.push(pilot);
    this.refreshUpgradesState();
    events.trigger('model.build.equippedUpgrades.update', this.build);
};

upgradesModel.prototype.unequipUpgrade = function (upgradeId) {
    // find the first instance of this upgrade in the equipped list.
    // We only look for the first time it appears, as there may be several of the same card equipped
    var removeIndex = _findIndex(this.equippedUpgrades, function (upgrade) {
        return upgrade.id === upgradeId;
    });
    // Now remove found index from equipped list
    if (removeIndex > -1) {
        this.equippedUpgrades.splice(removeIndex, 1);
        this.refreshUpgradesState();
        events.trigger('model.build.equippedUpgrades.update', this.build);
    }
};

upgradesModel.prototype.unequipAbility = function (pilotId) {
    // find the first instance of this upgrade in the equipped list.
    // We only look for the first time it appears, as there may be several of the same card equipped
    var removeIndex = _findIndex(this.equippedAbilities, function (pilot) {
        return pilot.id === pilotId;
    });
    // Now remove found index from equipped list
    if (removeIndex > -1) {
        this.equippedAbilities.splice(removeIndex, 1);
        this.refreshUpgradesState();
        events.trigger('model.build.equippedUpgrades.update', this.build);
    }
};

// Return array of upgrades of specific type which are legal to purchased for current build
//  (e.g. restricted by chassis, size, already a starting upgrade, already purchased etc.)
upgradesModel.prototype.getAvailableToBuy = function (upgradeType) {
    var upgradesOfType = keyedUpgrades[upgradeType];
    var allowedUpgrades = _filter(upgradesOfType, _bind(this.upgradeAllowedOnShip, this));
    allowedUpgrades = _filter(allowedUpgrades, _bind(this.upgradeAllowedInBuild, this));
    return allowedUpgrades;
};

upgradesModel.prototype.getAbilitiesAvailableToBuy = function () {
    var allAbilities = uniquePilots;
    var allowedPilots = _difference(allAbilities, this.purchasedAbilities);
    var sortedPilots = pilots.sortList(allowedPilots);
    return sortedPilots;
};

upgradesModel.prototype.upgradeAllowedOnShip = function (upgrade) {
    // Remove any upgrades for different ships
    if (upgrade.ship && upgrade.ship.indexOf(this.build.currentShip.shipData.name) < 0) {
        return false;
    }

    // Remove any upgrades for different ship sizes
    if (upgrade.size && upgrade.size.indexOf(this.build.currentShip.shipData.size) < 0) {
        return false;
    }

    return true;
};

upgradesModel.prototype.abilityAllowedInBuild = function (pilot) {
    // Remove pilots whose PS is higher than build
    if (pilot.skill > this.build.pilotSkill) {
        return false;
    }

    return true;
};

upgradesModel.prototype.upgradeAllowedInBuild = function (upgrade) {
    // Don't show anything which is a starting upgrade for the ship
    if (this.build.currentShip.startingUpgrades) {
        var found = _find(this.build.currentShip.startingUpgrades, function (startingUpgrade) {
            return startingUpgrade.xws === upgrade.xws;
        });
        if (found) {
            return false;
        }
    }

    // Remove any upgrades the build already has
    var upgradeExists = _find(this.all, function (existingUpgrade) {
        // Check xws instead of ID so we remove both sides of dual cards
        return existingUpgrade.xws === upgrade.xws;
    });

    if (upgradeExists) {
        var upgradeIsAllowed = false;
        // filter out any upgrades the player already has
        // except
        // * secondary weapons & bombs
        if (upgrade.slot === 'Bomb' || upgrade.slot === 'Torpedo' || upgrade.slot === 'Cannon' || upgrade.slot === 'Turret' || upgrade.slot === 'Missile') {
            upgradeIsAllowed = true;
        // * hull upgrade and shield upgrade
        } else if (upgrade.xws === 'hullupgrade' || upgrade.xws === 'shieldupgrade') {
            upgradeIsAllowed = true;
        }
        if (!upgradeIsAllowed) {
            return false;
        }
    }

    return true;
};

upgradesModel.prototype.abilityAlreadyInBuild = function (abilityPilot) {
    // Remove any abilities the build already has
    var abilityExists = _find(this.purchasedAbilities, function (existingAbility) {
        return existingAbility.id === abilityPilot.id;
    });

    if (abilityExists) {
        return true;
    }

    return false;
};

upgradesModel.prototype.canEquipUpgrade = function (upgradeId) {
    var upgradeSlots = this.build.upgradeSlots;
    var upgrade = upgradesImport.getById(upgradeId);

    var canEquip = false;

    _each(upgradeSlots.enabled, function (upgradeSlot) {
        if (upgradeSlot.type === upgrade.slot) {
            // this slot is the right type for the upgrade
            if (!upgradeSlot.equipped) {
            // This slot is free
                canEquip = true;
            }
        }
    });

    return canEquip;
};

upgradesModel.prototype.canEquipAbilties = function () {
    var upgradeSlots = this.build.upgradeSlots;

    var canEquip = false;

    _each(upgradeSlots.enabled, function (upgradeSlot) {
        if (upgradeSlot.type === 'Elite') {
            // this slot is the right type for the upgrade
            if (!upgradeSlot.equipped) {
            // This slot is free
                canEquip = true;
            }
        }
    });

    return canEquip;
};

upgradesModel.prototype.equipUpgradesToSlots = function (upgradesToEquip, abilitiesToEquip) {
    var thisModel = this;

    var remainingUpgradesToEquip = _clone(upgradesToEquip);
    var remainingAbilitiesToEquip = _clone(abilitiesToEquip);
    var equippedUpgrades = [];
    var equippedAbilities = [];

    var upgradeSlots = this.build.upgradeSlots;
    // Reset additonal slots as we are about to repopulate through equipping
    upgradeSlots.resetAdditionalSlots();

    var newSlotIndices = [];

    _each(upgradeSlots.free, function (upgradeSlot) {
        var matchingUpgrade = thisModel.matchFreeSlot(upgradeSlot, remainingUpgradesToEquip);
        var slotsAddedIndices = thisModel.equipSlot(upgradeSlot, matchingUpgrade, equippedUpgrades, equippedAbilities, remainingUpgradesToEquip, remainingAbilitiesToEquip);
        // If we added any new slots as part of equipping this upgrade, add them to the list
        newSlotIndices = newSlotIndices.concat(slotsAddedIndices);
    });

    _each(upgradeSlots.enabled, function (upgradeSlot) {
        var matchingUpgrade = thisModel.matchSlot(upgradeSlot, remainingUpgradesToEquip, remainingAbilitiesToEquip);
        var slotsAddedIndices = thisModel.equipSlot(upgradeSlot, matchingUpgrade, equippedUpgrades, equippedAbilities, remainingUpgradesToEquip, remainingAbilitiesToEquip);
        // If we added any new slots as part of equipping this upgrade, add them to the list
        newSlotIndices = newSlotIndices.concat(slotsAddedIndices);
    });

    // If we added any slots via upgrades, equip to them now
    while (newSlotIndices.length > 0) {
        // get the first item index from the array
        var itemIndex = newSlotIndices.shift();
        // try to equip to the additional slot at that index
        var matchingUpgrade = this.matchSlot(this.build.upgradeSlots.slotsFromUpgrades[itemIndex], remainingUpgradesToEquip, remainingAbilitiesToEquip);
        var slotsAddedIndices = this.equipSlot(this.build.upgradeSlots.slotsFromUpgrades[itemIndex], matchingUpgrade, equippedUpgrades, equippedAbilities, remainingUpgradesToEquip, remainingAbilitiesToEquip);
        // If we added yet more slots as part of equipping this upgrade, add them to the list
        newSlotIndices = newSlotIndices.concat(slotsAddedIndices);
    }

    return {
        equippedUpgrades: equippedUpgrades,
        equippedAbilities: equippedAbilities
    };
};

upgradesModel.prototype.matchFreeSlot = function (upgradeSlot, remainingUpgradesToEquip) {
    // Is there an equipped upgrade for this slot?
    var matchingUpgrade = _find(remainingUpgradesToEquip, function (upgrade) {
        return upgrade.id === upgradeSlot.upgrade.id;
    });
    return matchingUpgrade;
};

upgradesModel.prototype.matchSlot = function (upgradeSlot, remainingUpgradesToEquip, remainingAbilitiesToEquip) {
    // Is there an equipped upgrade for this slot?
    var matchingUpgrade = _find(remainingUpgradesToEquip, function (upgrade) {
        return upgrade.slot === upgradeSlot.type;
    });

    if (!matchingUpgrade && upgradeSlot.type === 'Elite') {
        // We didn't find a match, and this is elite, so also check for matching abilities
        matchingUpgrade = _first(remainingAbilitiesToEquip);
    }
    return matchingUpgrade;
};

upgradesModel.prototype.equipSlot = function (upgradeSlot, upgradeToEquip, equippedUpgrades, equippedAbilities, remainingUpgradesToEquip, remainingAbilitiesToEquip) {
    var addedSlotsIndices = [];

    // clear existing upgrade from slot
    delete upgradeSlot.equipped;

    if (upgradeToEquip) {
        if (this.upgradeisAbility(upgradeToEquip)) {
            // remove this upgrade from the list available to match slots
            arrayUtils.removeFirstMatchingValue(remainingAbilitiesToEquip, upgradeToEquip);
            equippedAbilities.push(upgradeToEquip);
        } else {
            // remove this upgrade from the list available to match slots
            arrayUtils.removeFirstMatchingValue(remainingUpgradesToEquip, upgradeToEquip);
            equippedUpgrades.push(upgradeToEquip);
            // Add any extra slots granted by the upgrade
            addedSlotsIndices = this.addUpgradeGrantsSlot(upgradeToEquip);
        }
        upgradeSlot.equipped = upgradeToEquip;
    }

    // If we added additional slots via a grant on this upgrade, let the caller know
    return addedSlotsIndices;
};

upgradesModel.prototype.addUpgradeGrantsSlot = function (upgrade) {
    var thisModel = this;
    var addedSlotIndices = [];
    _each(upgrade.grants, function (grant) {
        if (grant.type === 'slot') {
            var addedSlotIndex = thisModel.build.upgradeSlots.addAdditionalSlot(grant.name);
            addedSlotIndices.push(addedSlotIndex);
        }
    });
    return addedSlotIndices;
};

// Return boolean whether upgrade is an ability. Can be used to differentiate between equipped upgrades
//  which are card and which are pilot abilities
upgradesModel.prototype.upgradeisAbility = function (upgrade) {
    if (upgrade.skill) {
        // only pilot cards have skill property, not upgrade cards
        return true;
    }
    return false;
};

module.exports = upgradesModel;
