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

Collect the RAM released by each raid or computer hack, then carry it to the highlighted exit pad. The campaign has 148 RAM to fence.

## Controls

- WASD / arrow keys: move
- Left mouse click: hack/raid a selected target or attack a nearby opponent
- Left mouse drag: move toward the pointer
- Right/middle mouse drag: orbit the camera
- E: hack/raid the nearest target
- F: melee attack
- Space: jump
- Shift: sprint
- M: mute audio
- Mobile: use the on-screen jump, raid and fight buttons

## Gameplay notes

The interior levels use independent floorplans, collision bounds and NPC navigation grids. The house, tower, electronics store and RAM factory each rebuild their own geometry, computer targets, extraction point and crowd spawns. Computer displays are interactable targets; server racks and factory machinery provide the surrounding environment.

RAM pickups are modeled as DIMM modules with a PCB, memory chips, heat spreader details and gold contacts. Residents and security respond more aggressively as the raid escalates.
