# RAM STEALIN' SAM

A 3D action-raiding game built on [madness-engine](https://github.com/h1ddenpr0cess20/madness-engine).

## Run locally

```sh
npm install
npm run dev
```

## Five-map campaign

1. **Pacific Heights** — raid homes and businesses across a textured outdoor neighbourhood.
2. **The House Is Home** — search a lived-in house for two desktop computers while the residents swarm Sam.
3. **Office Tower Takeover** — locate and hack six office computers while employees and security pursue Sam.
4. **Electronics Store Raid** — search six gaming-PC display stations through the retail aisles.
5. **RAM Factory Meltdown** — hack four production terminals and escape across the conveyor and press floor.

Collect the RAM released by each raid or computer hack, then carry it to the highlighted pad (in Pacific Heights, drive the box truck onto it). The campaign has 144 RAM to fence.

## Controls

- WASD / arrow keys: move
- Left mouse click: hack/raid a selected target or attack a nearby opponent
- Left mouse drag: move toward the pointer
- Right/middle mouse drag: orbit the camera
- E: hack/raid the nearest target, or get in and out of the box truck (Pacific Heights)
- P / Esc: pause
- F: melee attack
- Space: jump
- Shift: sprint
- M: mute audio
- Mobile: use the on-screen jump, raid and fight buttons

## Gameplay notes

The interior levels use independent floorplans, collision bounds and NPC navigation grids. The house, tower, electronics store and RAM factory each rebuild their own geometry, computer targets, extraction point and crowd spawns. Computer displays are interactable targets; server racks and factory machinery provide the surrounding environment.

RAM pickups are modeled as DIMM modules with a PCB, memory chips, heat spreader details and gold contacts. Residents and security respond more aggressively as the raid escalates.

## Changes in this pass

- Fixed the interior levels: the builder called `clone()` on engine materials and meshes, which don't have it, so levels 2-5 never loaded and RAM drops crashed.
- The house is a 6-person household with a 20 RAM target (was 24 residents for exactly 24 RAM).
- The getaway van is the engine's box truck with working wheels: drive it, grab RAM by driving over it, flatten townsfolk, fence on the pad.
- Being busted drops what you carry where you fell and keeps raids done (no free re-raids).
- Knocked-out opponents drop RAM, doors and computers have glowing beacons, there is a pause screen and a job-complete screen between levels.
- Town lots no longer straddle the roads.
