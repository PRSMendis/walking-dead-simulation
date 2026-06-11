export type Group = "Lab" | "Precinct";
export type Winner = Group | "Draw";
export type EntityType = "survivor" | "walker";
export type MovementMode = "orthogonal" | "diagonal";
export type ResourceOwnership = "claimed-on-touch" | "dropped-on-death";
export type ActivationParticipant = Group | "Walker";
export type InteractionTiming = "after-each-step" | "after-activation";

export interface Position {
  x: number;
  y: number;
}

export interface ScenarioEntityInput extends Position {
  id: string;
}

export interface ScenarioResourceInput extends Position {
  id: string;
}

export interface Scenario {
  gridSize: number;
  maxTurns?: number;
  rules?: PartialRules;
  walkers: ScenarioEntityInput[];
  labSurvivors: ScenarioEntityInput[];
  precinctSurvivors: ScenarioEntityInput[];
  resources: ScenarioResourceInput[];
}

export interface ActivationRules {
  labMoveSteps: number;
  precinctMoveSteps: number;
  walkerMoveSteps: number;
  interactionTiming: InteractionTiming;
}

export interface ActivationRuleInput {
  labMoveSteps?: number;
  precinctMoveSteps?: number;
  walkerMoveSteps?: number;
  survivorMoveSteps?: number;
  interactionTiming?: InteractionTiming;
}

export interface CombatRules {
  survivorKillWalkerChance: number;
  interGroupSurvivorKillChance: number;
  randomSeed: number;
}

export type CombatRuleInput = Partial<CombatRules>;

export interface ParkMillerConstants {
  multiplier: number;
  modulus: number;
  maxRandomValue: number;
}

export interface Rules {
  movement: MovementMode;
  activation: ActivationRules;
  combat: CombatRules;
  activationOrder: ActivationParticipant[];
  resourceOwnership: ResourceOwnership;
}

export interface PartialRules {
  movement?: MovementMode;
  activation?: ActivationRuleInput;
  combat?: CombatRuleInput;
  activationOrder?: ActivationParticipant[];
  resourceOwnership?: ResourceOwnership;
}

export interface SurvivorEntity {
  id: string;
  type: "survivor";
  group: Group;
  position: Position;
  alive: boolean;
}

export interface WalkerEntity {
  id: string;
  type: "walker";
  position: Position;
  alive: boolean;
}

export type Entity = SurvivorEntity | WalkerEntity;

export interface Resource {
  id: string;
  position: Position;
  claimedBy: Group | null;
  claimedByEntityId: string | null;
}

export interface SimulationState {
  gridSize: number;
  rules: Rules;
  random: () => number;
  entities: Entity[];
  resources: Resource[];
}

export type ScoreByGroup = Record<Group, number>;

export interface TurnSummary {
  scores: ScoreByGroup;
  survivorsRemaining: ScoreByGroup;
  resourcesClaimed: number;
  resourcesTotal: number;
}

export interface TurnLog {
  turn: number;
  events: string[];
  summary: TurnSummary;
}

export interface SimulationResult {
  winner: Winner;
  reason: string;
  turns: number;
  scores: ScoreByGroup;
  survivorsRemaining: ScoreByGroup;
  resources: Resource[];
  rules: Rules;
  log: TurnLog[];
}

export interface OccupiedCell {
  position: Position;
  entities: Entity[];
}

export interface Target {
  id: string;
  position: Position;
}
