# Theory: Elastocaloric Effect in Polymers

## Thermodynamic Basis

The elastocaloric effect arises from entropy changes associated with stress-induced structural transitions in a material. For a uniaxially stressed polymer:

- Applying stress: molecular chains align, entropy decreases, heat is released (adiabatic temperature rise)
- Removing stress: chains relax, entropy increases, heat is absorbed (adiabatic temperature drop)

The adiabatic temperature change is:

```
ΔT_ad = -(T / C_p) * (∂σ/∂T)_ε * Δε
```

Where:
- T = absolute temperature
- C_p = specific heat capacity at constant pressure
- σ = stress
- ε = strain
- Δε = applied strain amplitude

## Coefficient of Performance

For a regenerative elastocaloric cycle, the theoretical COP approaches:

```
COP = Q_cold / W_mech
```

Polymer films can achieve COP values of 2–10 depending on operating conditions, surpassing the efficiency of many vapor-compression systems at small scales.

## Polymer Film Selection Criteria

| Property         | Target             | Reason                                  |
|------------------|--------------------|-----------------------------------------|
| Elastocaloric ΔT | > 5 K              | Useful temperature span per cycle       |
| Fatigue life     | > 10^6 cycles      | Long operational lifetime               |
| Cost             | < 5 EUR/m²         | Low-cost manufacturing target           |
| Thermal conductivity | > 0.2 W/m·K   | Efficient heat transfer to exchanger    |
| Max strain       | > 100%             | Large entropy change per cycle          |

## References

- Moya, X. & Mathur, N. D. (2020). Caloric materials for cooling and heating. *Science*, 370(6518), 797-803.
- Greibich, F. et al. (2021). Elastocaloric heat pump with specific cooling power of 20.9 W/g. *Nature Energy*, 6, 260-267.
