"""
DSC (Differential Scanning Calorimetry) analysis for elastocaloric polymer films.

Loads a standard DSC export (heat flow vs. temperature), locates endothermic and
exothermic peaks associated with stress-induced transitions, and computes the
latent heat ΔH and entropy change ΔS at the transition temperature T*.

Expected CSV format (TA Instruments / Mettler-Toledo export):
  Temperature [°C], Heat Flow [mW/mg]
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from scipy.signal import savgol_filter
from scipy.integrate import trapezoid


def load_dsc(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path, comment="#")
    df.columns = ["temperature_C", "heat_flow_mW_mg"]
    df = df.dropna().sort_values("temperature_C").reset_index(drop=True)
    return df


def smooth(signal: np.ndarray, window: int = 11, poly: int = 3) -> np.ndarray:
    return savgol_filter(signal, window_length=window, polyorder=poly)


def find_peak_region(
    temp: np.ndarray,
    heat_flow: np.ndarray,
    direction: str = "exo",
    baseline_pct: float = 0.05,
) -> tuple[float, float]:
    """Return (T_onset, T_offset) of the dominant peak in the chosen direction."""
    hf = -heat_flow if direction == "exo" else heat_flow
    baseline = np.percentile(hf, baseline_pct * 100)
    above = hf > baseline + np.std(hf) * 0.5
    if not above.any():
        raise ValueError(f"No {direction}thermic peak detected.")
    indices = np.where(above)[0]
    return float(temp[indices[0]]), float(temp[indices[-1]])


def integrate_peak(
    temp: np.ndarray,
    heat_flow: np.ndarray,
    t_onset: float,
    t_offset: float,
) -> float:
    """Integrate heat flow over the peak region → latent heat ΔH [J/g]."""
    mask = (temp >= t_onset) & (temp <= t_offset)
    # linear baseline subtraction
    baseline = np.linspace(heat_flow[mask][0], heat_flow[mask][-1], mask.sum())
    delta_h = trapezoid(heat_flow[mask] - baseline, temp[mask])
    return float(abs(delta_h))


def analyze(path: str | Path, plot: bool = True) -> dict:
    df = load_dsc(path)
    T = df["temperature_C"].values
    HF = smooth(df["heat_flow_mW_mg"].values)

    t_on, t_off = find_peak_region(T, HF, direction="endo")
    delta_h = integrate_peak(T, HF, t_on, t_off)  # J/g
    T_star_K = (t_on + t_off) / 2 + 273.15
    delta_s = delta_h / T_star_K * 1000  # mJ g⁻¹ K⁻¹

    results = {
        "T_onset_C": round(t_on, 2),
        "T_offset_C": round(t_off, 2),
        "T_transition_K": round(T_star_K, 2),
        "delta_H_J_per_g": round(delta_h, 3),
        "delta_S_mJ_per_gK": round(delta_s, 3),
    }

    if plot:
        fig, ax = plt.subplots(figsize=(8, 4))
        ax.plot(T, HF, lw=1.2, color="steelblue", label="DSC signal")
        ax.axvspan(
            t_on,
            t_off,
            alpha=0.15,
            color="orange",
            label=f"Peak region ΔH = {delta_h:.2f} J/g",
        )
        ax.axvline(t_on, color="orange", lw=0.8, ls="--")
        ax.axvline(t_off, color="orange", lw=0.8, ls="--")
        ax.set_xlabel("Temperature (°C)")
        ax.set_ylabel("Heat Flow (mW mg⁻¹)")
        ax.set_title(f"DSC Analysis — {Path(path).stem}")
        ax.legend()
        fig.tight_layout()
        out = Path(path).with_suffix(".png")
        fig.savefig(out, dpi=150)
        print(f"Saved plot: {out}")

    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python dsc_analysis.py <dsc_data.csv>")
        sys.exit(1)
    r = analyze(sys.argv[1])
    for k, v in r.items():
        print(f"  {k}: {v}")
