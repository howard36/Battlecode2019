import { Queue } from './Queue.src.js';

export function addPair(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y
    };
}

export function subtractPair(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y
    };
}

export function sqDist(a, b) {
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
}

export function pairEq(a, b) {
    return a.x === b.x && a.y === b.y;
}

export function pairToString(p) {
    return "(" + p.x + ", " + p.y + ")";
}

export function empty(loc, map, robots = null) {
    if (loc.x < 0 || loc.y < 0 || loc.x >= map.length || loc.y >= map.length)
        return false;
    return map[loc.y][loc.x] && (robots === null || robots[loc.y][loc.x] <= 0);
}

export function bfs(start, map) {
    let q = new Queue();
    let visited = new Array(map.length);
    let dist = new Array(map.length);
    for (let i = 0; i < map.length; i++) {
        visited[i] = new Array(map.length).fill(false);
        dist[i] = new Array(map.length).fill(1000000);
    }
    q.enqueue(start);
    visited[start.y][start.x] = true;
    dist[start.y][start.x] = 0;
    while (!q.isEmpty()) {
        let v = q.dequeue();
        let adj = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        for (let i = 0; i < 4; i++) {
            let u = { x: v.x + adj[i][0], y: v.y + adj[i][1] };
            if (empty(u, map) && !visited[u.y][u.x]) {
                q.enqueue(u);
                visited[u.y][u.x] = true;
                dist[u.y][u.x] = dist[v.y][v.x] + 1;
            }
        }
    }
    return dist;
}

export function move(loc, bfsGrid, map, robots, speed, forceMove = false) {
    let minDist = 1000000;
    let minCost = 1000000;
    let bestMove = { x: -100, y: -100 };
    for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
            let next = { x: loc.x + dx, y: loc.y + dy };
            if (sqDist(loc, next) <= speed && (empty(next, map, robots) || (dx === 0 && dy === 0 && !forceMove))) {
                // prioritize fast over cost
                if (bfsGrid[next.y][next.x] < minDist || (bfsGrid[next.y][next.x] === minDist && sqDist(loc, next) < minCost)) {
                    minDist = bfsGrid[next.y][next.x];
                    minCost = sqDist(loc, next);
                    bestMove = { x: dx, y: dy };
                }
            }
        }
    }
    return bestMove;
}

export function findClosestKarbonite(loc, kmap) {
    let closest = { x: -1, y: -1 };
    let minDist = 1000000;
    for (let x = 0; x < kmap.length; x++) {
        for (let y = 0; y < kmap.length; y++) {
            let pt = { x: x, y: y };
            if (kmap[y][x] && sqDist(pt, loc) < minDist) {
                minDist = sqDist(pt, loc);
                closest = pt;
            }
        }
    }
    return closest;
}

export function findClosestFuel(loc, fmap) {
    let closest = { x: -1, y: -1 };
    let minDist = 1000000;
    for (let x = 0; x < fmap.length; x++) {
        for (let y = 0; y < fmap.length; y++) {
            let pt = { x: x, y: y };
            if (fmap[y][x] && sqDist(pt, loc) < minDist) {
                minDist = sqDist(pt, loc);
                closest = pt;
            }
        }
    }
    return closest;
}

export function findClosestPosition(loc, positionList) {
    let closest = { x: -1, y: -1 };
    let minDist = 1000000;
    for (let i = 0; i < positionList.length; i++) {
        let pt = positionList[i];
        if (sqDist(pt, loc) < minDist) {
            minDist = sqDist(pt, loc);
            closest = pt;
        }
    }
    return closest;
}

export function dir(from, to) {
    return { x: Math.sign(to.x - from.x), y: Math.sign(to.x - from.x) };
}

export function norm(v) {
    return v.x * v.x + v.y * v.y;
}

const shifts = [
    { x: -1, y: -1 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 }
];

export function hashShift(shift) {
    for (let i = 0; i < 8; i++) {
        if (pairEq(shifts[i], shift)) {
            return i;
        }
    }
}

export function unhashShift(hash) {
    return shifts[hash];
}

// for sorting targetKarb and targetFuel
export function customSort(a, b) {
    if (a.dist !== b.dist)
        return a.dist - b.dist;
    else if (a.assignedCastle !== b.assignedCastle)
        return a.assignedCastle - b.assignedCastle;
    else if (a.pos.x !== b.pos.x)
        return a.pos.x - b.pos.x;
    else
        return a.pos.y - b.pos.y;
}

// export default { addPair, sqDist, findClosestKarbonite, findClosestFuel, findClosestPosition };