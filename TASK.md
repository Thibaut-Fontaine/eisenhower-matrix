# eisenhower-matrix

**Slug:** `eisenhower-matrix`  
**Compute:** light  
**Needs VPS:** false  
**Estimated disk:** 512 MB  
**Difficulty:** high  
**Estimated time:** 1h50m  
**Estimated tokens:** ~220k (deepseek-v4.1-flash)  
**Private repository:** yes  

## Idea

Adopted existing workspace at /home/thibaut/mox-projects/eisenhower-matrix

## Summary

(none)

## Milestones

Track them with `mox milestone` when mox is available. For manual continuation, see `MANUAL.md`; direct `MILESTONES.json` edits are allowed then.

| id | milestone | complexity | estimate | algorithm |
|---|---|---|---|---|
| m1 | Foundation and failing tests | medium | 30m | - |
|  | - [ ] Write failing unit tests for the core behaviour |  |  |  |
|  | - [ ] Set up the project structure and dependencies |  |  |  |
| m2 | Implement the core | high | 1h | - |
|  | - [ ] Implement the core behaviour |  |  |  |
|  | - [ ] Handle errors and edge cases |  |  |  |
|  | - [ ] Write/adjust unit tests for the behaviour |  |  |  |
| m3 | Validate, document and ship | low | 20m | - |
|  | - [ ] Run the full test suite, formatter and linter |  |  |  |
|  | - [ ] Write README usage notes |  |  |  |
|  | - [ ] Commit everything and push |  |  |  |

## Definition of done

- The project builds and its tests pass.

## Environment

- Global rules: `~/AGENTS-GLOBAL.md`
- Cargo target dir: `~/mox-projects/.mox/cache/cargo-target/eisenhower-matrix`
- Temp dir: `~/mox-projects/.mox/tmp/eisenhower-matrix`
- Keep caches out of the repository.
