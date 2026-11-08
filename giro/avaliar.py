"""Comando 3: mede M1–M5 no período de teste e registra no placar."""
import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent / "src"))
from giro import SAIDAS  # noqa: E402
from giro.metricas import metricas_modelo, registrar_placar, salvar_json  # noqa: E402

METAS = {"M1": (">=", 0.75), "M2": (">=", 0.40), "M3": (">=", 0.36), "M4": ("<=", 0.03)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--metrica", default="todas")
    ap.add_argument("--versao", default="mvp-v1")
    ap.add_argument("--sem-placar", action="store_true")
    a = ap.parse_args()
    prev = pd.read_csv(SAIDAS / "previsoes.csv", dtype={"id_paciente": str})
    m = metricas_modelo(prev)
    for k, (op, meta) in METAS.items():
        if a.metrica not in ("todas", k):
            continue
        ok = m[k] >= meta if op == ">=" else m[k] <= meta
        print(f"{k}: {m[k]:.4f}  (meta {op} {meta})  {'OK' if ok else 'abaixo'}")
    print(f"M5a (ordenação do modelo entre grupos, informativa): {m['M5a']:.1f} p.p.")
    salvar_json(m, "metricas_modelo.json")
    if a.metrica == "todas" and not a.sem_placar:
        registrar_placar(m, a.versao, "modelo")


if __name__ == "__main__":
    main()
