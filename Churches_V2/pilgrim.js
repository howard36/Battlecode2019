import { BCAbstractRobot, SPECS } from 'battlecode';
import nav from './nav.js';
import util from './util.js';
import pilgrimUtil from './pilgrimUtil.js';
import resource from './resource.js';
import signalling from './signalling.js';

const pilgrim = {};

pilgrim.takeTurn = (self) => {
    self.loc = { x: self.me.x, y: self.me.y };
    self.log("Pilgrim Position: " + util.pairToString(self.loc));
    self.log("I have " + self.me.karbonite + " karb and " + self.me.fuel + " fuel");

    if (self.me.turn === 1) {
        resource.mainInit(self);
        self.foundCastles = [];
        self.foundChurches = [];
        self.foundEnemyCastles = [];
        self.foundEnemyChurches = [];
        // self.baseInitialized = false;
    }

    pilgrimUtil.searchCastlesOrChurches(self);

    if (self.me.turn === 1) {
        let receivedMessage = false;
        for (let i = 0; i < self.visible.length; i++) {
            let r = self.visible[i];
            if (r.team === self.me.team
                && (r.unit === SPECS.CASTLE || r.unit === SPECS.CHURCH)
                && self.isRadioing(r) && (r.signal >> 15)
                && util.sqDist(self.loc, { x: r.x, y: r.y })) {
                // signal is meant for me!
                self.log("I got a message!");
                receivedMessage = true;

                let message = r.signal - (1 << 15);
                if (message < self.allResources.length) { // resource pilgrim
                    self.targetMineID = message;
                    self.targetResource = self.allResources[self.targetMineID].type;
                    self.targetMinePos = self.allResources[message].pos;
                    self.myClusterID = self.allResources[message].cluster;
                    self.base = { x: r.x, y: r.y };
                    self.state = "going to mine";
                }
                else {
                    self.myClusterID = message - self.allResources.length;
                    self.targetMineID = self.clusters[self.myClusterID].karb[0];
                    self.targetResource = 0;
                    self.targetMinePos = self.allResources[self.targetMineID].pos;
                    self.base = self.clusters[self.myClusterID].churchPos;
                    self.state = "going to build church";
                }
                self.castleTalk(message);
                util.findSymmetry(self); // why does the pilgrim need this?
                pilgrimUtil.initAvoidMinesMap(self);
                self.bfsFromMine = nav.fullBFS(self.targetMinePos, self.avoidMinesMap, SPECS.UNITS[self.me.unit].SPEED);
                self.bfsFromBase = nav.fullBFS(self.base, self.avoidMinesMap, SPECS.UNITS[self.me.unit].SPEED, true);
                self.log("I am a pilgrim that just got initialized");
                self.log("Target Resource: " + self.targetResource);
                self.log("Base castle or church: " + util.pairToString(self.base));
                self.log("Target Mine: " + util.pairToString(self.targetMinePos));
            }
        }
        if (!receivedMessage) {
            self.log("ERROR! I'm a new pilgrim that didn't get an init message");
        }
    }

    if (self.state === "going to build church") {
        self.log("Pilgrim state: " + self.state);
        if (util.sqDist(self.loc, self.base) <= 2) {
            self.state = "building church";
            self.log("Already arrived at build location, state switching to " + self.state);
        }
        else {
            let chosenMove = nav.move(self.loc, self.bfsFromBase, self.map, self.robotMap, SPECS.UNITS[self.me.unit].SPEED);
            self.log("Move: " + util.pairToString(chosenMove));
            if (util.pairEq(chosenMove, { x: 0, y: 0 })) {
                // TODO: find solution
                self.log("New move: " + util.pairToString(chosenMove));
                if (util.pairEq(chosenMove, { x: 0, y: 0 })) {
                    // TODO: pilgrim is stuck, turn stationary robots into impassable
                    return pilgrimUtil.pilgrimDontDoNothing(self);
                }
            }
            if (util.sqDist(util.addPair(self.loc, chosenMove), self.base) <= 2 && util.enoughFuelToMove(self, chosenMove)) {
                self.state = "building church";
                self.log("Will arrive at build location next turn, state switching to " + self.state);
            }
            return self.move(chosenMove.x, chosenMove.y);
        }
    }

    if (self.state === "building church") { // combine with above state?
        if (util.sqDist(self.loc, self.base) > 2) {
            self.log("ERROR! state is " + self.state + " but not currently adjacent to build location");
            self.state = "going to mine";
            // TODO: set mine as closest karb
        }
        else {
            self.log("Building church at " + util.pairToString(self.base));
            let shift = util.subtractPair(self.base, self.loc);
            signalling.pilgrimToNewChurch(self, self.targetResource, shift);
            self.state = "going to mine";
            return self.buildUnit(SPECS.CHURCH, shift.x, shift.y);
        }
    }

    if (self.state === "going to mine") {
        self.log("Pilgrim state: " + self.state);
        if (util.pairEq(self.loc, self.targetMinePos)) {
            self.state = "mining"; // can start mining on the same turn
            self.log("Already arrived at mine, state changed to " + self.state);
        }
        else {
            let chosenMove = nav.move(self.loc, self.bfsFromMine, self.map, self.robotMap, SPECS.UNITS[self.me.unit].SPEED);
            self.log("Move: " + util.pairToString(chosenMove));
            if (util.pairEq(chosenMove, { x: 0, y: 0 })) {
                // TODO: alternate move
                self.log("New move: " + util.pairToString(chosenMove));
                if (util.pairEq(chosenMove, { x: 0, y: 0 })) {
                    // TODO: signal when stuck
                    return pilgrimUtil.pilgrimDontDoNothing(self);
                }
            }
            // TODO: make pilgrims follow fuel buffer
            if (util.pairEq(util.addPair(self.loc, chosenMove), self.targetMinePos)
                && util.enoughFuelToMove(self, chosenMove))
                self.state = "mining";
            return self.move(chosenMove.x, chosenMove.y);
        }
    }

    if (self.state === "mining") {
        self.log("Pilgrim state: " + self.state);
        if (self.fuel >= SPECS.MINE_FUEL_COST) {
            // self.lastMoveNothing = false;
            if (self.targetResource === 0) { // karb
                if (self.me.karbonite + SPECS.KARBONITE_YIELD >= SPECS.UNITS[self.me.unit].KARBONITE_CAPACITY) {
                    self.log("Storage will be full next round, swiching state to go to base");
                    self.state = "going to base";
                }
            }
            else {
                self.log("Mining my target fuel");
                if (self.me.fuel + SPECS.FUEL_YIELD >= SPECS.UNITS[self.me.unit].FUEL_CAPACITY) {
                    self.log("Storage will be full next round, swiching state to go to base");
                    self.state = "going to base";
                }
            }
            return self.mine();
        }
        else {
            self.log("Not enough fuel to mine");
            // self.lastMoveNothing = true;
            return pilgrimUtil.pilgrimDontDoNothing(self);
        }
    }

    if (self.state === "going to base") {
        // if (!self.baseInitialized) {
        //     let minDist = 1000000;
        //     for (let i = 0; i < self.foundCastles.length; i++) {
        //         if (util.sqDist(self.foundCastles[i], self.targetMinePos) < minDist) {
        //             minDist = util.sqDist(self.foundCastles[i], self.targetMinePos);
        //             self.base = self.foundCastles[i];
        //         }
        //     }
        //     for (let i = 0; i < self.foundChurches.length; i++) {
        //         if (util.sqDist(self.foundChurches[i], self.targetMinePos) < minDist) {
        //             minDist = util.sqDist(self.foundChurches[i], self.targetMinePos);
        //             self.base = self.foundChurches[i];
        //         }
        //     }
        //     self.baseInitialized = true;
        // }
        self.log("Pilgrim state: " + self.state);
        if (util.sqDist(self.loc, self.base) <= 2) {
            self.state = "depositing";
            self.log("Already arrived at base, state switching to " + self.state);
        }
        else {
            let chosenMove = nav.move(self.loc, self.bfsFromBase, self.map, self.robotMap, SPECS.UNITS[self.me.unit].SPEED);
            self.log("Move: " + util.pairToString(chosenMove));
            if (util.pairEq(chosenMove, { x: 0, y: 0 })) {
                // TODO: alternate move
                self.log("New move: " + util.pairToString(chosenMove));
                if (util.pairEq(chosenMove, { x: 0, y: 0 })) {
                    // TODO: handle stuck pilgrims
                    return pilgrimUtil.pilgrimDontDoNothing(self);
                }
            }
            if (util.sqDist(util.addPair(self.loc, chosenMove), self.base) <= 2 && util.enoughFuelToMove(self, chosenMove)) {
                self.state = "depositing";
                self.log("Will arrive at base next turn, state switching to " + self.state);
            }
            return self.move(chosenMove.x, chosenMove.y);
        }
    }

    if (self.state === "depositing") {
        self.log("Pilgrim state: " + self.state);
        if (self.me.karbonite > 0 || self.me.fuel > 0) {
            self.log("Depositing resources at base");
            self.state = "going to mine";
            self.log("State for next round changed to " + self.state);
            return self.give(self.base.x - self.loc.x, self.base.y - self.loc.y, self.me.karbonite, self.me.fuel);
        }
        else {
            self.log("ERROR! pilgrim was in state deposit without any resources");
            self.state = "going to mine";
            return pilgrimUtil.pilgrimDontDoNothing(self);
        }
    }

    self.log("ERROR! self is the end of pilgrim's turn(), it shouldn't get self far");
    return pilgrimUtil.pilgrimDontDoNothing(self);
}

export default pilgrim;
