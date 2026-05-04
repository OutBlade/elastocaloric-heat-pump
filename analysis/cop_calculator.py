"""
COP calculator for the elastocaloric demonstrator.

Reads a time-series log from the demonstrator (temperature sensors + actuator
power) and computes:
  - Q_cold: heat absorbed from the cold side [J per cycle]
  - W_mech: mechanical work input per cycle [J]
  - COP_device = Q_cold / W_mech
  - COP_Carnot = T_cold / (T_hot - T_cold)
  - Second-law efficiency eta = COP_device / COP_Carnot

Log CSV format (one row per sample at ~10 Hz):
  timestamp_s, T_cold_C, T_hot_C, force_N, displacement_mm, power_W
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from scipy.integrate import trapezoid


def load_log(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {
        "timestamp_s",
        "T_cold_C",
        "T_hot_C",
        "force_N",
        "displacement_mm",
        "power_W",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Log file missing columns: {missing}")
    return df.sort_values("timestamp_s").reset_index(drop=True)


def detect_cycles(df: pd.DataFrame, min_cycle_s: float = 0.5) -> list[tuple[int, int]]:
    """
    Detect loading cycles from force signal using zero-crossings of the
    force derivative. Returns list of (start_idx, end_idx) pairs.
    """
    force = df["force_N"].values
    d_force = np.diff(force, prepend=force[0])
    sign_changes = np.where(np.diff(np.sign(d_force)))[0]

    cycles = []
    i = 0
    while i + 1 < len(sign_changes):
        t_start = df["timestamp_s"].iloc[sign_changes[i]]
        t_end = df["timestamp_s"].iloc[sign_changes[i + 1]]
        if (t_end - t_start) >= min_cycle_s:
            cycles.append((sign_changes[i], sign_changes[i + 1]))
            i += 2
        else:
            i += 1
    return cycles


def compute_cycle_cop(
    df: pd.DataFrame, start: int, end: int, film_mass_g: float = 1.0
) -> dict:
    seg = df.iloc[start:end].copy()
    t = seg["timestamp_s"].values

    # mechanical work: W = ∫ F · dδ
    force = seg["force_N"].values
    disp = seg["displacement_mm"].values * 1e-3  # m
    w_mech = abs(trapezoid(force, disp))  # J

    # electrical input (actuator + control)
    w_elec = trapezoid(seg["power_W"].values, t)  # J
    w_total = max(w_mech, w_elec)  # conservative: use whichever is larger

    # cold-side heat: estimated via lumped thermal model Q_cold = m·c_p·ΔT_cold
    # c_p ~ 1.5 J g⁻¹ K⁻¹ for elastomers
    c_p = 1.5  # J g⁻¹ K⁻¹
    delta_t_cold = seg["T_cold_C"].max() - seg["T_cold_C"].min()
    q_cold = film_mass_g * c_p * delta_t_cold  # J

    t_cold_K = seg["T_cold_C"].mean() + 273.15
    t_hot_K = seg["T_hot_C"].mean() + 273.15
    cop_carnot = t_cold_K / max(t_hot_K - t_cold_K, 0.01)

    cop_device = q_cold / max(w_total, 1e-6)
    eta_2nd_law = cop_device / cop_carnot if cop_carnot > 0 else float("nan")

    return {
        "W_mech_J": round(w_mech, 4),
        "Q_cold_J": round(q_cold, 4),
        "COP_device": round(cop_device, 3),
        "COP_Carnot": round(cop_carnot, 3),
        "eta_2nd_law": round(eta_2nd_law, 3),
        "T_cold_mean_C": round(seg["T_cold_C"].mean(), 2),
        "T_hot_mean_C": round(seg["T_hot_C"].mean(), 2),
        "delta_T_span_K": round(t_hot_K - t_cold_K, 2),
    }


def analyze(
    path: str | Path, film_mass_g: float = 1.0, plot: bool = True
) -> pd.DataFrame:
    df = load_log(path)
    cycles = detect_cycles(df)

    if not cycles:
        raise RuntimeError("No complete cycles detected in log file.")

    records = [compute_cycle_cop(df, s, e, film_mass_g) for s, e in cycles]
    results = pd.DataFrame(records)
    results.index.name = "cycle"

    print(f"\nAnalyzed {len(results)} cycles from {Path(path).name}")
    print(results.describe().loc[["mean", "std"]].T.to_string())

    if plot:
        fig, axes = plt.subplots(1, 3, figsize=(13, 4))

        axes[0].plot(
            results.index, results["COP_device"], marker="o", color="firebrick"
        )
        axes[0].axhline(
            results["COP_Carnot"].mean(), ls="--", color="gray", label="COP Carnot"
        )
        axes[0].set_xlabel("Cycle #")
        axes[0].set_ylabel("COP")
        axes[0].set_title("Device COP per cycle")
        axes[0].legend()

        axes[1].plot(
            results.index, results["delta_T_span_K"], marker="s", color="steelblue"
        )
        axes[1].set_xlabel("Cycle #")
        axes[1].set_ylabel("Temperature span (K)")
        axes[1].set_title("Cold–hot temperature span")

        axes[2].plot(
            results.index, results["eta_2nd_law"] * 100, marker="^", color="seagreen"
        )
        axes[2].set_xlabel("Cycle #")
        axes[2].set_ylabel("2nd-law efficiency (%)")
        axes[2].set_title("Second-law efficiency")

        fig.suptitle(f"COP Analysis — {Path(path).stem}", fontsize=13)
        fig.tight_layout()
        out = Path(path).with_suffix("_cop.png")
        fig.savefig(out, dpi=150)
        print(f"Saved plot: {out}")

    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python cop_calculator.py <demonstrator_log.csv> [film_mass_g]")
        sys.exit(1)

    mass = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    analyze(sys.argv[1], film_mass_g=mass)
