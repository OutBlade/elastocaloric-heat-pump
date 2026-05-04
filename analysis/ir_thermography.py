"""
IR thermography analysis for elastocaloric polymer films.

Loads a sequence of IR frames (CSV or TIFF stack) captured during a
stress-cycle experiment and extracts the adiabatic temperature change
ΔT_ad as a function of applied strain.

Frame CSV format: rows = pixel rows, cols = pixel columns, values = °C.
A metadata sidecar file (same stem, _meta.csv) must list:
  frame_index, strain_pct, load_N, timestamp_s
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path


def load_frame(path: Path) -> np.ndarray:
    """Load a single IR frame from a CSV file. Returns a 2-D float array in °C."""
    return pd.read_csv(path, header=None).values.astype(float)


def load_stack(frame_dir: Path, pattern: str = "frame_*.csv") -> np.ndarray:
    """Load all frames matching pattern into a (N, H, W) array sorted by name."""
    paths = sorted(frame_dir.glob(pattern))
    if not paths:
        raise FileNotFoundError(f"No frames found in {frame_dir} matching {pattern}")
    stack = np.stack([load_frame(p) for p in paths], axis=0)
    return stack


def load_metadata(frame_dir: Path) -> pd.DataFrame:
    meta_path = frame_dir / "metadata.csv"
    if not meta_path.exists():
        raise FileNotFoundError(f"Metadata file not found: {meta_path}")
    return pd.read_csv(meta_path)


def compute_delta_t(
    stack: np.ndarray,
    ref_frame: int = 0,
    roi: tuple[int, int, int, int] | None = None,
) -> np.ndarray:
    """
    Compute ΔT = T(frame) − T(ref_frame) averaged over the ROI.

    roi: (row_start, row_end, col_start, col_end). Full frame if None.
    Returns 1-D array of mean ΔT per frame.
    """
    r0, r1, c0, c1 = roi if roi else (0, stack.shape[1], 0, stack.shape[2])
    reference = stack[ref_frame, r0:r1, c0:c1].mean()
    return stack[:, r0:r1, c0:c1].mean(axis=(1, 2)) - reference


def find_delta_t_ad(delta_t: np.ndarray, meta: pd.DataFrame) -> dict:
    """
    Identify loading and unloading peak ΔT values from the ΔT–time trace.

    Returns peak ΔT on loading (positive) and unloading (negative).
    """
    loading_peak = float(delta_t[meta["load_N"] == meta["load_N"].max()].mean())
    unloading_peak = float(delta_t[meta["load_N"] == 0].mean())
    delta_t_ad = (abs(loading_peak) + abs(unloading_peak)) / 2
    return {
        "delta_T_loading_K": round(loading_peak, 3),
        "delta_T_unloading_K": round(unloading_peak, 3),
        "delta_T_ad_K": round(delta_t_ad, 3),
    }


def plot_thermogram(
    stack: np.ndarray,
    frame_index: int,
    title: str = "",
    save_path: Path | None = None,
) -> None:
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(stack[frame_index], cmap="inferno", interpolation="bilinear")
    plt.colorbar(im, ax=ax, label="Temperature (°C)")
    ax.set_title(title or f"Frame {frame_index}")
    ax.axis("off")
    fig.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=150)
    plt.show()


def plot_delta_t_trace(
    delta_t: np.ndarray,
    meta: pd.DataFrame,
    save_path: Path | None = None,
) -> None:
    fig, ax1 = plt.subplots(figsize=(9, 4))
    ax2 = ax1.twinx()
    ax1.plot(meta["timestamp_s"], delta_t, color="firebrick", lw=1.5, label="ΔT (K)")
    ax2.plot(
        meta["timestamp_s"],
        meta["strain_pct"],
        color="steelblue",
        lw=1.0,
        ls="--",
        alpha=0.7,
        label="Strain (%)",
    )
    ax1.set_xlabel("Time (s)")
    ax1.set_ylabel("ΔT (K)", color="firebrick")
    ax2.set_ylabel("Strain (%)", color="steelblue")
    ax1.axhline(0, color="gray", lw=0.5, ls=":")
    fig.legend(loc="upper right", bbox_to_anchor=(0.88, 0.88))
    fig.tight_layout()
    if save_path:
        fig.savefig(save_path, dpi=150)
    plt.show()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ir_thermography.py <frame_directory>")
        sys.exit(1)

    frame_dir = Path(sys.argv[1])
    stack = load_stack(frame_dir)
    meta = load_metadata(frame_dir)
    delta_t = compute_delta_t(stack, ref_frame=0)
    results = find_delta_t_ad(delta_t, meta)

    print("IR Thermography Results:")
    for k, v in results.items():
        print(f"  {k}: {v}")

    plot_delta_t_trace(delta_t, meta, save_path=frame_dir / "delta_t_trace.png")
