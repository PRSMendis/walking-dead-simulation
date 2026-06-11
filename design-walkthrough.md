# Design Walkthrough

## Key Assumptions

- Movement is orthogonal by default because the brief describes a grid but does not explicitly allow diagonals. Diagonal movement is configurable because either interpretation is reasonable.
- Activation is sequential rather than simultaneous. This keeps the event log explainable: an entity moves, interactions resolve, then the next entity acts.
- Lab survivors, Precinct survivors, and walkers all activate once per turn by default. Their order and movement speed are configurable because the brief leaves activation behaviour open.
- Resources are dropped on death by default. I chose this because it treats resources as physical items carried by survivors, which feels more realistic than permanent points on first touch.
- Random combat is seeded. This preserves the drama of probabilistic outcomes while keeping tests and walkthroughs reproducible.
- The winner is based on claimed resources first, then living survivors as a tie-breaker, then draw.

## Beyond The Spec

I went beyond the minimum spec by making several ambiguous rules configurable:

- orthogonal vs diagonal movement
- activation order
- per-type movement speed
- interaction timing
- dropped vs permanent resource ownership
- survivor-vs-walker combat chance
- optional Lab-vs-Precinct combat
- seeded randomness

I did this because these choices materially change outcomes. Making them scenario configuration keeps the default behaviour simple while allowing the simulation to demonstrate different interpretations of the brief.

I also added TypeScript, focused modules, sample scenarios with varied outcomes, and a test suite. That makes the solution easier to review, evolve, and defend in a walkthrough.

## One Improvement With More Time

I would add a richer reporting layer: a compact final board state, per-turn board snapshots, or an optional JSON output mode.

The current event log is useful for debugging, but a visual or structured output would make longer simulations easier to inspect and compare.

## AI Usage

I used AI as a design and implementation assistant, mainly for:

- surfacing ambiguous parts of the brief
- proposing rule variations
- generating boilerplate and tests
- refactoring toward smaller modules
- checking edge cases and sample outcomes

To be honest, I have found good outcomes with using AI and treating it like a pair programmer, by first properly planning and going through assumptions I have reached an end-result I am happy with in record time. I am constantly experimenting and iterating with my use of AI, but currently I will write my thoughts down seperately, have AI create a plan, and then my goal is to come to an accords; and then get an MVP built. from there I iterate until I am happy with the code, tests, and function.

I kept the final decisions mine. For example, AI initially suggested random walker movement as a way to make outcomes more varied. I rejected that because it would make tests brittle and make the simulation harder to explain. Instead, I kept movement deterministic and put randomness only in combat, where uncertainty is easier to justify and control with a seed.

Another example: AI helped identify that `2147483647` was unclear in the seeded random generator. I changed the implementation to name the Park-Miller constants and expose them through a documented function, so the number is treated as an algorithm constant rather than unexplained magic. This follows best principles like avoiding `magic numbers.`
