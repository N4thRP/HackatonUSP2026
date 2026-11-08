"""Comando 4: simula contato, liberação de vagas e cascata no período de teste (D21)."""
import argparse
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent / "src"))
from giro import DADOS, SAIDAS, carregar_config  # noqa: E402
from giro.lista_espera import elegiveis_a, ordenar  # noqa: E402
from giro.metricas import registrar_placar, salvar_json  # noqa: E402
from giro.simulador import checar_confirmacao, salvar_eventos, simular  # noqa: E402


def carregar():
    prev = pd.read_csv(SAIDAS / "previsoes.csv", dtype={"id_paciente": str})
    sint = pd.read_parquet(DADOS / "sinteticos.parquet")
    fila_b = pd.read_parquet(DADOS / "fila_b.parquet")
    return prev, sint, fila_b


def benchmark(n=10_000, repeticoes=200):
    """M10: tempo para escolher candidatos numa agenda de 10 mil consultas futuras."""
    rng = np.random.default_rng(0)
    ag = {"ativa": np.ones(n, bool), "aceita": rng.random(n) < .6, "dia": rng.integers(0, 60, n).astype(float),
          "dia_ag": rng.integers(-30, 0, n), "ultimo_aceite": np.full(n, -99.0)}
    cor, esp = rng.integers(0, 4, n), rng.integers(0, 90, n)
    t0 = time.perf_counter()
    for _ in range(repeticoes):
        m = elegiveis_a(ag, 3, 0, 5, 7)
        ordenar(cor[m], esp[m])
    return (time.perf_counter() - t0) / repeticoes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--periodo", default="teste")
    ap.add_argument("--modo", default=None, help="sequencial | simultanea | todos")
    ap.add_argument("--relatorio", default=None)
    ap.add_argument("--benchmark", action="store_true")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--versao", default="mvp-v1")
    ap.add_argument("--sem-placar", action="store_true")
    a = ap.parse_args()

    if a.benchmark:
        s = benchmark()
        print(f"M10: {s*1000:.2f} ms por realocação numa agenda de 10 mil consultas (meta < 2 s)")
        return

    fontes, regras = carregar_config()
    prev, sint, fila_b = carregar()
    rodadas = [("sequencial", "produto"), ("simultanea", "produto"), ("sequencial", "aleatorio")]
    if a.modo and a.modo != "todos":
        rodadas = [(a.modo, "produto")]
    resumos = {}
    for modo, cenario in rodadas:
        t0 = time.perf_counter()
        eventos, r = simular(prev, sint, fila_b, fontes, regras, modo=modo, cenario=cenario, semente=a.seed)
        r["M6_violacoes"] = checar_confirmacao(eventos)
        nome = f"{modo}_{cenario}"
        if cenario == "produto":
            salvar_eventos(eventos, SAIDAS / f"eventos_{modo}.jsonl")
        resumos[nome] = r
        print(f"{nome:22s} {time.perf_counter()-t0:5.1f}s | liberadas {r['vagas_liberadas']:,} | "
              f"M8 {r['M8']:.1%} | recuperadas {r['vagas_recuperadas']:,} | M9 {r['M9']:.1%} | "
              f"R$ {r['valor_recuperado_convenio']:,.0f} | M6 violações {r['M6_violacoes']}")
    salvar_json(resumos, "resumo_simulacao.json")

    base = resumos.get(f"{regras['modo_padrao']}_produto")
    if base:
        if a.relatorio == "receita" or a.relatorio is None:
            print(f"\nReceita (convênio): R$ {base['valor_recuperado_convenio']:,.0f} recuperados de "
                  f"R$ {base['perda_convenio']:,.0f} perdidos ({base['M9']:.1%}) · "
                  f"R$ {base['por_unidade_mes_convenio']:,.0f} por unidade/mês")
            print(f"SUS: R$ {base['valor_recuperado_sus']:,.0f} + {base['pacientes_b_atendidos']} pacientes da fila "
                  f"atendidos + {base['dias_antecipados_tipo_a']:,.0f} dias de consulta antecipados")
        if not a.sem_placar:
            registrar_placar({"M6": base["M6_violacoes"], "M8": base["M8"], "M9": base["M9"],
                              "M10": base["M10_seg_max"]}, a.versao, f"simulação {regras['modo_padrao']}")


if __name__ == "__main__":
    main()
