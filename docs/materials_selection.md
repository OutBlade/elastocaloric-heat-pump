# Polymer Film Selection for Elastocaloric Cooling

## Selection Criteria

A polymer film suitable for elastocaloric cooling must satisfy several competing requirements:

| Criterion | Target | Rationale |
|-----------|--------|-----------|
| ΔT_ad | ≥ 2 K | Minimum useful temperature lift per cycle |
| Max strain ε_max | ≥ 100 % | Large strain enables large entropy change |
| Fatigue life | ≥ 10⁵ cycles | Operational lifetime of at least a few years |
| Thermal conductivity | ≥ 0.2 W m⁻¹ K⁻¹ | Fast heat exchange with the solid-contact exchanger |
| Material cost | ≤ 5 € m⁻² | Cost-competitive with vapor-compression at scale |
| Hysteresis ΔW | minimized | Low hysteresis → high COP (less dissipated work) |

## Candidate Materials

### Natural Rubber (NR)

Natural rubber is the benchmark elastocaloric polymer. The thermoelastic inversion around 10 % strain is well-documented: above the inversion point, NR heats under extension (positive eC effect), consistent with rubber elasticity theory where entropy decreases on stretching.

Measured ΔT_ad values of 2–4 K at ε = 200–600 % have been reported in literature. Fatigue life is moderate; carbon-black filled grades improve cycling durability significantly.

Characterization methods: DSC for c_p, IR thermography during cyclic stretching, DIC for strain field homogeneity.

### PVDF Film

Polyvinylidene fluoride exhibits a smaller elastocaloric effect (~1–2 K) but superior fatigue resistance and thermal conductivity (~0.17 W m⁻¹ K⁻¹). Its piezoelectric coupling may enable combined electrocaloric and elastocaloric actuation in hybrid devices.

### Silicone Elastomer (PDMS / RTV)

High elasticity, chemical inertness, and biocompatibility. ΔT_ad ~ 1–3 K at large strains. Excellent for rapid prototyping due to ease of casting and bonding to metal heat exchangers.

## Comparison with SMA Films

The ZET group at KIT IMT has demonstrated TiNiCuCo SMA films achieving ΔT_ad > 20 K and specific cooling power up to 19 W g⁻¹ (Xu et al., 2024). Polymer films cannot match this volumetric performance, but they offer:

- 100–500× lower material cost
- Much larger achievable surface area (roll-to-roll manufacturing)
- Flexible integration with low-cost heat exchangers
- No critical raw materials (no Ni, Ti, Cu)

The practical trade-off is that polymer-based devices require higher strain amplitudes and larger film areas to achieve comparable cooling power, which shifts the engineering challenge toward mechanical durability and actuator efficiency.

## Recommended First Experiments

1. DSC scan of each candidate from −40 °C to +100 °C to identify any phase transitions and measure c_p.
2. Uniaxial tensile test to 200 %, 5 cycles, recording stress–strain and surface temperature via IR camera simultaneously.
3. Cyclic fatigue test to 10⁵ cycles at target operating strain; inspect for crack initiation via optical microscopy.
4. Thermal conductivity measurement via transient hot-wire method or laser flash analysis.
