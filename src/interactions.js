import {
  ENTITY_TYPES,
  RESOURCE_OWNERSHIP,
} from "./constants.js";
import {
  formatPosition,
  positionsEqual,
} from "./movement.js";
import {
  compareEntities,
  occupiedCells,
} from "./state.js";

export function resolveInteractions(state, events, actorId = null) {
  for (const cell of occupiedCells(state.entities)) {
    const walkers = cell.entities.filter(
      (entity) => entity.type === ENTITY_TYPES.WALKER && entity.alive,
    );
    const survivors = cell.entities.filter(
      (entity) => entity.type === ENTITY_TYPES.SURVIVOR && entity.alive,
    );

    if (walkers.length > 0 && survivors.length > 0) {
      resolveSurvivorWalkerCombat(state, survivors, walkers, events);
    }

    resolveInterGroupSurvivorCombat(state, survivors, events);
  }

  for (const resource of state.resources) {
    if (resource.claimedBy !== null) {
      continue;
    }

    const survivorsAtResource = state.entities
      .filter(
        (entity) =>
          entity.type === ENTITY_TYPES.SURVIVOR &&
          entity.alive &&
          positionsEqual(entity.position, resource.position),
      )
      .sort((a, b) => compareEntities(a, b, state.rules.activationOrder));

    if (survivorsAtResource.length === 0) {
      continue;
    }

    const actor = survivorsAtResource.find((survivor) => survivor.id === actorId);
    const claimant = actor ?? survivorsAtResource[0];
    resource.claimedBy = claimant.group;
    resource.claimedByEntityId = claimant.id;
    events.push(
      `${claimant.id} claimed ${resource.id} for ${claimant.group} at ${formatPosition(resource.position)}.`,
    );
  }
}

function resolveSurvivorWalkerCombat(state, survivors, walkers, events) {
  const orderedSurvivors = [...survivors].sort((a, b) =>
    compareEntities(a, b, state.rules.activationOrder),
  );

  for (const survivor of orderedSurvivors) {
    if (!survivor.alive) {
      continue;
    }

    const livingWalkers = walkers
      .filter((walker) => walker.alive)
      .sort((a, b) => a.id.localeCompare(b.id));

    if (livingWalkers.length === 0) {
      return;
    }

    if (state.random() < state.rules.combat.survivorKillWalkerChance) {
      const walker = livingWalkers[0];
      walker.alive = false;
      events.push(
        `${survivor.id} (${survivor.group}) killed ${walker.id} at ${formatPosition(survivor.position)}.`,
      );
    } else {
      killSurvivor(state, survivor, livingWalkers, events);
    }
  }
}

function resolveInterGroupSurvivorCombat(state, survivors, events) {
  if (state.rules.combat.interGroupSurvivorKillChance <= 0) {
    return;
  }

  const orderedSurvivors = [...survivors].sort((a, b) =>
    compareEntities(a, b, state.rules.activationOrder),
  );

  for (const survivor of orderedSurvivors) {
    if (!survivor.alive) {
      continue;
    }

    const opponents = survivors
      .filter(
        (candidate) =>
          candidate.alive &&
          candidate.group !== survivor.group,
      )
      .sort((a, b) => compareEntities(a, b, state.rules.activationOrder));

    if (opponents.length === 0) {
      return;
    }

    if (state.random() < state.rules.combat.interGroupSurvivorKillChance) {
      const target = opponents[0];
      killSurvivor(state, target, [survivor], events);
    }
  }
}

function killSurvivor(state, survivor, killers, events) {
  survivor.alive = false;
  events.push(
    `${survivor.id} (${survivor.group}) was killed by ${killers.map((killer) => killer.id).join(", ")} at ${formatPosition(survivor.position)}.`,
  );

  if (state.rules.resourceOwnership !== RESOURCE_OWNERSHIP.DROPPED_ON_DEATH) {
    return;
  }

  for (const resource of state.resources) {
    if (resource.claimedByEntityId !== survivor.id) {
      continue;
    }

    resource.claimedBy = null;
    resource.claimedByEntityId = null;
    resource.position = { ...survivor.position };
    events.push(
      `${survivor.id} dropped ${resource.id}; it is now unclaimed at ${formatPosition(resource.position)}.`,
    );
  }
}
