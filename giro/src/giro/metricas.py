"""Métricas M1–M12 e escrita no placar."""
import datetime as dt
import json

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

from . import SAIDAS


def top_k(y, p, k=0.20):
    n = int(len(p) * k)
    idx = np.argsort(-np.asarray(p))[:n]
    y = np.asarray(y)
    return y[idx].mean(), y[idx].sum() / y.sum()


def ece(y, p, bins=10):
    y, p = np.asarray(y), np.asarray(p)
    q = np.quantile(p, np.linspace(0, 1, bins + 1))
    idx = np.clip(np.searchsorted(q, p, side="right") - 1, 0, bins - 1)
    erro = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            erro += m.mean() * abs(p[m].mean() - y[m].mean())
    return erro


def equidade(prev, k=0.20):
    """Maior diferença de recall no top 20% entre grupos (p.p.)."""
    corte = np.quantile(prev["prob_falta"], 1 - k)
    prev = prev.assign(top=prev["prob_falta"] >= corte)
    grupos = {
        "faixa_etaria": pd.cut(prev["idade"], [-1, 17, 39, 59, 200], labels=["0-17", "18-39", "40-59", "60+"]),
        "sexo": prev["sexo"],
        "bolsa_familia": prev["bolsa_familia"],
    }
    detalhe, pior = {}, 0.0
    for nome, g in grupos.items():
        rec = prev[prev.falta == 1].groupby(np.asarray(g)[prev.falta.values == 1])["top"].mean()
        detalhe[nome] = rec.round(3).to_dict()
        pior = max(pior, (rec.max() - rec.min()) * 100)
    return pior, detalhe


def metricas_modelo(prev):
    y, p = prev["falta"], prev["prob_falta"]
    prec, rec = top_k(y, p)
    eq, detalhe = equidade(prev)
    return {"M1": roc_auc_score(y, p), "M2": rec, "M3": prec, "M4": ece(y, p), "M5a": eq,
            "pr_auc": average_precision_score(y, p), "equidade_detalhe": detalhe}


def registrar_placar(valores, versao, nota=""):
    arq = SAIDAS / "placar.csv"
    linha = {"data": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "versao": versao}
    linha.update({k: valores.get(k) for k in ["M1", "M2", "M3", "M4", "M5", "M5a"] + [f"M{i}" for i in range(6, 13)]})
    linha["nota"] = nota
    df = pd.read_csv(arq) if arq.exists() else pd.DataFrame(columns=list(linha))
    df = pd.concat([df, pd.DataFrame([linha])], ignore_index=True)
    df.to_csv(arq, index=False)


def salvar_json(obj, nome):
    with open(SAIDAS / nome, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2, default=float)
