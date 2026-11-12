# CREOVA

**Create. Connect. Evolve.**

CREOVA is a full-scale social platform combining familiar social networking and photo-sharing experiences, short-form video and creator tools, and CREOVA's original execution ecosystem.

## Product pillars

1. **Social:** profiles, follows, feeds, posts, stories, comments, likes, sharing, and messaging.
2. **Entertainment:** vertical video, creator tools, sounds, effects, discovery, and LIVE capabilities.
3. **Evolution:** Anchors, Iterations, execution trees, proof of execution, collaboration, and skill discovery.

## Clean rebuild

This branch is the clean application rebuild, starting from the documentation-only `main` branch. Previous application implementations remain on their original branches for reference and rollback; they are not part of this new application baseline.

See:
- [Product specification](docs/PRODUCT_SPECIFICATION.md)
- [Rebuild plan](docs/REBUILD_PLAN.md)

## Engineering principles

- Real, tested functionality; no fake success states or demo-only controls.
- Android and Web share one product identity and backend contracts.
- Security and authorization are enforced server-side.
- Preserve previous branches and production data until explicit migration/retirement approval.
- No paid provider, live payment, advertising spend, or external messaging without explicit approval.
- Build in verified increments and document what has and has not been tested.
