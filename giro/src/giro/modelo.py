"""Treino, previsão, faixas de risco (D15) e os 3 fatores que explicam cada previsão."""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier

from .preparar import CATEGORICAS, VARIAVEIS_MODELO

PARAMS = dict(max_iter=400, learning_rate=0.05, random_state=0)


def treinar(treino):
    modelo = HistGradientBoostingClassifier(
        categorical_features=[VARIAVEIS_MODELO.index(c) for c in CATEGORICAS], **PARAMS)
    modelo.fit(treino[VARIAVEIS_MODELO], treino["falta"])
    return modelo


def faixa_por_unidade_dia(prev, alto=0.20, medio=0.50, por_idade=False):
    chaves = [prev["unidade"], prev["data_consulta"]]
    if por_idade:  # opção de equidade: corte dentro de cada faixa etária
        chaves.append(pd.cut(prev["idade"], [-1, 17, 39, 59, 200]))
    pos = prev.groupby(chaves, observed=True)["prob_falta"].rank(ascending=False, pct=True)
    return np.select([pos <= alto, pos <= medio], ["ALTO", "MÉDIO"], default="BAIXO")


# ---- Fatores explicativos -------------------------------------------------
# Cada fator é uma faixa de uma variável com taxa de falta conhecida no treino.
# Para cada consulta, mostramos as 3 faixas com maior taxa acima da média.
def _faixas(df):
    return {
        "antecedencia": pd.cut(df["antecedencia_dias"], [-1, 0, 7, 30, 1000],
                               labels=["marcou para o mesmo dia", "marcou 1 a 7 dias antes",
                                       "marcou 8 a 30 dias antes", "marcou mais de 30 dias antes"]),
        "historico": pd.cut(df["faltas_anteriores"], [-1, 0, 1, 2, 1000],
                            labels=["sem faltas anteriores", "1 falta anterior", "2 faltas anteriores",
                                    "3 ou mais faltas anteriores"]),
        "idade": pd.cut(df["idade"], [-1, 17, 29, 59, 200],
                        labels=["menor de 18 anos", "18 a 29 anos", "30 a 59 anos", "60 anos ou mais"]),
        "bolsa": df["bolsa_familia"].map({1: "recebe Bolsa Família", 0: "não recebe Bolsa Família"}),
        "unidade": pd.cut(df["taxa_faltas_unidade"], [0, 0.17, 0.21, 1],
                          labels=["unidade com poucas faltas", "unidade na média",
                                  "unidade com muitas faltas"]),
        "primeira": np.where(df["consultas_anteriores"] == 0, "primeira consulta no período", "já veio antes"),
    }


def tabela_fatores(treino):
    base = treino["falta"].mean()
    taxas = {}
    for nome, serie in _faixas(treino).items():
        t = treino["falta"].groupby(pd.Series(np.asarray(serie), index=treino.index)).mean()
        taxas[nome] = (t / base).to_dict()
    return taxas


def fatores(df, taxas, n=3):
    fx = _faixas(df)
    nomes = list(fx)
    rotulos = np.column_stack([np.asarray(fx[k]).astype(object) for k in nomes])
    razoes = np.column_stack([pd.Series(rotulos[:, i]).map(taxas[k]).fillna(1.0).values
                              for i, k in enumerate(nomes)])
    ordem = np.argsort(-razoes, axis=1)[:, :n]
    out = []
    for r in range(len(df)):
        out.append([rotulos[r, j] for j in ordem[r] if razoes[r, j] > 1.0] or ["sem fator de risco destacado"])
    return [(f + ["", "", ""])[:3] for f in out]
