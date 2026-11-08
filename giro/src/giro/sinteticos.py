"""Campos sintéticos (D4). Ficam em tabelas separadas e nunca entram no modelo (D14, R12)."""
import numpy as np
import pandas as pd

CORES = ["vermelho", "amarelo", "verde", "azul"]


def distribuicao_horas(caminho_itajai):
    hora = pd.read_csv(caminho_itajai, usecols=["appointment_time"])["appointment_time"].str.slice(0, 2).astype(int)
    return hora.value_counts(normalize=True).sort_index()


def gerar_sinteticos(consultas, fontes, raiz):
    rng = np.random.default_rng(fontes["semente"])
    n = len(consultas)

    # Horário: hora pela distribuição real de Itajaí, minuto 00 ou 30
    dist = distribuicao_horas(raiz / fontes["horario"]["arquivo"])
    horas = rng.choice(dist.index.values, size=n, p=dist.values)
    minutos = rng.choice([0, 30], size=n)
    horario = [f"{h:02d}:{m:02d}" for h, m in zip(horas, minutos)]

    # Valor: triangular (convênio) e fixo (SUS)
    v = fontes["valor"]["convenio"]
    valor_convenio = rng.triangular(v["minimo"], v["moda"], v["maximo"], size=n).round(2)

    # Atributos por paciente: cor de risco, distância, adesão às ofertas
    pacientes = consultas["id_paciente"].unique()
    prop = fontes["cor_risco"]["proporcoes"]
    cor = rng.choice(CORES, size=len(pacientes), p=[prop[c] for c in CORES])
    d = fontes["distancia_km"]
    dist_km = rng.lognormal(np.log(d["mediana"]), d["sigma_log"], size=len(pacientes)).round(1)
    adesao = rng.random(len(pacientes)) < fontes["aceite"]["adesao"]
    por_paciente = pd.DataFrame({"id_paciente": pacientes, "cor_risco": cor, "distancia_km": dist_km,
                                 "aceita_ofertas": adesao})

    sint = pd.DataFrame({"id_consulta": consultas["id_consulta"].values, "id_paciente": consultas["id_paciente"].values,
                         "horario": horario, "valor_convenio": valor_convenio,
                         "valor_sus": fontes["valor"]["sus"]["valor"]})
    return sint.merge(por_paciente, on="id_paciente", how="left")


def gerar_fila_b(unidades, fontes):
    """Pacientes na fila da regulação sem horário (tipo B, D23)."""
    rng = np.random.default_rng(fontes["semente"] + 1)
    fb = fontes["fila_b"]
    prop = fontes["cor_risco"]["proporcoes"]
    linhas = []
    for iu, u in enumerate(sorted(unidades)):
        for k in range(fb["por_unidade"]):
            linhas.append({
                "id_b": f"B-{iu:02d}-{k:02d}",
                "unidade": u,
                "cor_risco": rng.choice(CORES, p=[prop[c] for c in CORES]),
                "espera_dias_inicial": float(rng.lognormal(np.log(fb["espera_mediana_dias"]), fb["sigma_log"])).__round__(1),
                "distancia_km": float(rng.lognormal(np.log(fontes["distancia_km"]["mediana"]),
                                                    fontes["distancia_km"]["sigma_log"])).__round__(1),
                "aceita_ofertas": bool(rng.random() < fontes["aceite"]["adesao"]),
            })
    return pd.DataFrame(linhas)
