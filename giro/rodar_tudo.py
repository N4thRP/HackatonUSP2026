"""Roda o pipeline inteiro e grava uma linha consolidada no placar (M1–M12)."""
import argparse
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).parent
sys.path.insert(0, str(RAIZ / "src"))
from giro import SAIDAS  # noqa: E402
from giro.metricas import registrar_placar  # noqa: E402


def rodar(*args):
    print("\n$", " ".join(args))
    r = subprocess.run([sys.executable, *args], cwd=RAIZ, capture_output=True, text=True)
    print(r.stdout.strip()[-1500:])
    if r.returncode not in (0, 1):
        print(r.stderr[-2000:])
        sys.exit(r.returncode)
    return r


def passou(arquivo):
    return rodar("-m", "pytest", "-q", f"tests/{arquivo}").returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--versao", default="mvp-v1")
    ap.add_argument("--nota", default="")
    a = ap.parse_args()
    rodar("preparar.py")
    rodar("treinar.py")
    rodar("avaliar.py", "--sem-placar")
    # M8 e M9: média de 5 sementes (o ruído de uma semente é maior que a folga das metas)
    extras = []
    for semente in [1, 2, 3, 4]:
        rodar("simular.py", "--modo", "sequencial", "--sem-placar", "--seed", str(semente))
        extras.append(json.load(open(SAIDAS / "resumo_simulacao.json"))["sequencial_produto"])
    rodar("simular.py", "--modo", "todos", "--sem-placar")
    bench = rodar("simular.py", "--benchmark")
    m = json.load(open(SAIDAS / "metricas_modelo.json"))
    s = json.load(open(SAIDAS / "resumo_simulacao.json"))["sequencial_produto"]
    seg = float(bench.stdout.split("M10: ")[1].split(" ms")[0]) / 1000
    todas = [s] + extras
    m8 = [r["M8"] for r in todas]
    m9 = [r["M9"] for r in todas]
    valores = {k: m[k] for k in ["M1", "M2", "M3", "M4", "M5a"]}
    valores.update({
        "M5": s["M5_cobertura_gap_pp"],
        "M6": s["M6_violacoes"],
        "M7": "100%" if passou("test_lista_espera.py") and passou("test_confirmacao.py") else "falhou",
        "M8": sum(m8) / len(m8), "M9": sum(m9) / len(m9), "M10": seg,
        "M11": "100%" if passou("test_sinteticos.py") else "falhou",
        "M12": "100%" if passou("test_sem_vazamento.py") else "falhou",
    })
    nota = (f"{a.nota} · M8 {min(m8):.1%}–{max(m8):.1%}, M9 {min(m9):.1%}–{max(m9):.1%} em 5 sementes").strip(" ·")
    registrar_placar(valores, a.versao, nota)
    print("\nPlacar:", {k: (round(v, 4) if isinstance(v, float) else v) for k, v in valores.items()})


if __name__ == "__main__":
    main()
