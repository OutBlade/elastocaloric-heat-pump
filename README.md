# Elastocaloric Heat Pump

Low-cost elastocaloric cooling research using polymer films as the active material.

## Why This Topic

Cooling and refrigeration already consume a large share of the world's electricity, and demand is only growing. New technologies are needed that are more efficient, cost-effective, and environmentally friendly.

Elastocaloric cooling is a promising alternative: it uses solid materials that heat up and cool down under mechanical stress instead of harmful refrigerants. Polymer films combine low cost with excellent heat transfer properties, making them a strong candidate for the next generation of green cooling technologies.

## Project Goals

1. Explore the thermal and mechanical behavior of novel polymer films
2. Design and build a small-scale cooling demonstrator using these materials
3. Evaluate and optimize system performance through experiments

## Repository Structure

```
elastocaloric-heat-pump/
├── docs/               # Literature, theory, references
├── materials/          # Material characterization data and test results
├── design/             # Mechanical and thermal design files (CAD, schematics)
├── firmware/           # Microcontroller code for actuation and sensing
├── experiments/        # Raw data, measurement scripts, analysis notebooks
├── results/            # Processed results, plots, performance metrics
└── .github/workflows/  # CI for data validation and report generation
```

## Working Principle

Elastocaloric materials exhibit the elastocaloric effect: applying mechanical stress causes them to release heat (warming), and removing stress causes them to absorb heat (cooling). By cycling stress on a polymer film while controlling heat transfer to a load and a heat sink, a continuous cooling effect can be achieved.

Advantages over vapor-compression systems:
- No refrigerants (zero GWP)
- Solid-state — fewer moving parts
- Polymer films are inexpensive and scalable
- High surface-area-to-volume ratio enables efficient heat transfer

## Getting Started

See `docs/setup.md` for hardware requirements and initial assembly instructions.

## License

MIT
