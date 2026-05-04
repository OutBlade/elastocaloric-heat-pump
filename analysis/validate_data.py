"""
Local data validation script — mirrors the CI check in .github/workflows/validate.yml.
Run before committing new experiment data.
"""

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
REQUIRED_COLUMNS = {
    "dsc": {"temperature_C", "heat_flow_mW_mg"},
    "tensile": {"strain_pct", "stress_MPa"},
    "demonstrator": {
        "timestamp_s",
        "T_cold_C",
        "T_hot_C",
        "force_N",
        "displacement_mm",
        "power_W",
    },
}


def check_csv(path: Path) -> list[str]:
    errors = []
    try:
        with open(path, newline="") as fh:
            reader = csv.DictReader(fh)
            headers = set(reader.fieldnames or [])
            rows = list(reader)
    except Exception as e:
        return [f"{path}: cannot read — {e}"]

    if not rows:
        errors.append(f"{path}: empty file")
        return errors

    for folder_key, required in REQUIRED_COLUMNS.items():
        if folder_key in str(path):
            missing = required - headers
            if missing:
                errors.append(f"{path}: missing columns {missing}")

    for i, row in enumerate(rows, start=2):
        for col, val in row.items():
            try:
                float(val)
            except (ValueError, TypeError):
                if val not in ("", "nan", "NaN", "NA"):
                    errors.append(
                        f"{path}:{i}: non-numeric value in column '{col}': {val!r}"
                    )

    return errors


def main() -> int:
    all_errors = []
    csv_files = list(ROOT.rglob("experiments/**/*.csv"))

    if not csv_files:
        print("No CSV files found in experiments/.")
        return 0

    for path in csv_files:
        all_errors.extend(check_csv(path))

    if all_errors:
        print(f"Validation FAILED — {len(all_errors)} error(s):")
        for e in all_errors:
            print(f"  {e}")
        return 1

    print(f"Validation passed — {len(csv_files)} file(s) checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
