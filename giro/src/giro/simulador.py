"""Simulação do ciclo completo no período de teste (D21): contato, vagas liberadas e cascata.

Relógio: cada dia útil tem `T` tentativas de 30 min. Instante t = dia_util * T + tentativa.
Ofertas sempre sequenciais (D11): um paciente por vez, 30 min cada.
Gera um log de eventos (eventos.jsonl) e um resumo com M6–M10.
"""
import heapq
import json
import time

import numpy as np
import pandas as pd

from .contato import mensagem, sortear_resposta
from .lista_espera import ORDEM_COR, elegiveis_a, elegiveis_b, ordenar


class Calendario:
    def __init__(self, inicio, fim):
        self.datas = pd.bdate_range(inicio.normalize(), fim.normalize())
        self.idx = {d: i for i, d in enumerate(self.datas)}

    def dia(self, ts):
        d = pd.Timestamp(ts).normalize()
        while d not in self.idx:
            d += pd.Timedelta(days=1)
        return self.idx[d]

    def data(self, i):
        return self.datas[min(i, len(self.datas) - 1)]


def simular(prev, sint, fila_b, fontes, regras, cenario="produto", semente=None):
    rng = np.random.default_rng(fontes["semente"] if semente is None else semente)
    T = regras["tentativas_por_dia"]
    p_aceite = fontes["aceite"]["chance_por_oferta"]
    guarda, carencia, volta = regras["guarda_dias_uteis"], regras["carencia_dias"], regras["volta_agenda_dias_uteis"]
    corte = int(round(regras["corte_horas_antes"] * 60 / regras["minutos_por_oferta"]))

    df = prev.merge(sint.drop(columns=["id_paciente"]), on="id_consulta", how="left")
    df["data_agendamento"] = pd.to_datetime(df["data_agendamento"])
    df["data_consulta"] = pd.to_datetime(df["data_consulta"])
    cal = Calendario(df["data_agendamento"].min(), df["data_consulta"].max())
    df["dia"] = df["data_consulta"].map(cal.dia)
    df["dia_ag"] = df["data_agendamento"].map(cal.dia)
    inicio_teste = df["dia"].min()

    if cenario == "aleatorio":  # controle: mesmas quantidades por faixa, sorteadas sem o modelo
        df["faixa"] = df.groupby(["unidade", "data_consulta"])["faixa"].transform(
            lambda s: s.sample(frac=1, random_state=int(rng.integers(1e9))).values)

    # ---- estado por unidade -------------------------------------------------
    agendas, pos = {}, {}
    for u, g in df.groupby("unidade"):
        agendas[u] = {
            "id": g["id_consulta"].to_numpy(), "pac": g["id_paciente"].astype(str).to_numpy(),
            "dia": g["dia"].to_numpy().astype(float), "dia_ag": g["dia_ag"].to_numpy(),
            "data_ag": g["data_agendamento"].to_numpy(),
            "cor": g["cor_risco"].map(ORDEM_COR).to_numpy(), "cor_txt": g["cor_risco"].to_numpy(),
            "dist": g["distancia_km"].to_numpy(),
            "aceita": g["aceita_ofertas"].to_numpy().astype(bool),
            "ativa": np.ones(len(g), bool), "ultimo_aceite": np.full(len(g), -99.0),
            "valor": g["valor_convenio"].to_numpy(),
        }
        for i, cid in enumerate(g["id_consulta"]):
            pos[cid] = (u, i)
    filas = {}
    for u, g in fila_b.groupby("unidade"):
        filas[u] = {"id": g["id_b"].to_numpy(), "cor": g["cor_risco"].map(ORDEM_COR).to_numpy(),
                    "cor_txt": g["cor_risco"].to_numpy(), "espera0": g["espera_dias_inicial"].to_numpy(),
                    "dist": g["distancia_km"].to_numpy(),
                    "aceita": g["aceita_ofertas"].to_numpy().astype(bool), "servido": np.zeros(len(g), bool)}

    eventos, heap, seq = [], [], 0

    def log(t, tipo, **kw):
        eventos.append({"t": int(t), "dia": cal.data(int(t) // T).strftime("%Y-%m-%d"), "tipo": tipo, **kw})

    # ---- 1-3: contato e respostas -------------------------------------------
    aviso = regras.get("aviso_idosos", {})
    df["contato"] = df["faixa"]
    if aviso.get("ativo"):  # D31: idosos fora das faixas ALTO/MÉDIO recebem aviso na D-2
        df.loc[(df["faixa"] == "BAIXO") & (df["idade"] >= aviso["idade_min"]), "contato"] = "AVISO"
    alvo = df[df["contato"] != "BAIXO"].sort_values("prob_falta", ascending=False)
    for r in alvo.itertuples():
        antes = aviso.get("dias_antes", 2) if r.contato == "AVISO" else regras["contato_dias_antes"]
        dia_contato = max(r.dia - antes, r.dia_ag)
        t_cont = dia_contato * T
        log(t_cont, "contato", id_consulta=int(r.id_consulta), unidade=r.unidade, faixa=r.faixa, tipo_contato=r.contato,
            perfil=r.perfil, mensagem=mensagem(r.unidade, r.data_consulta, r.horario, r.faixa, r.perfil))
        resp = sortear_resposta(rng, r.faixa, r.falta == 1, fontes["resposta"])
        t_resp = t_cont + int(rng.integers(0, T))
        if t_resp // T >= r.dia:
            resp = "nada"
        if resp == "nada":
            log(t_cont + T // 2, "reenvio", id_consulta=int(r.id_consulta), unidade=r.unidade)
            continue
        log(t_resp, "resposta", id_consulta=int(r.id_consulta), unidade=r.unidade, resposta=resp)
        if resp in ("nao_vou", "remarcar"):
            u, i = pos[r.id_consulta]
            agendas[u]["ativa"][i] = False
            log(t_resp, "vaga_liberada", id_consulta=int(r.id_consulta), unidade=u, nivel=0,
                valor=float(r.valor_convenio))
            heapq.heappush(heap, (t_resp, seq, {"unidade": u, "dia": int(r.dia), "nivel": 0, "raiz": int(r.id_consulta),
                                                "origem": int(r.id_consulta), "valor": float(r.valor_convenio)}))
            seq += 1

    # ---- 4-5: ofertas e cascata ---------------------------------------------
    stats = {"liberadas": 0, "preenchidas_n0": 0, "fim_b": 0, "fim_volta": 0, "fim_perdido": 0,
             "nao_preenchidas_n0": 0, "movimentos": 0, "dias_antecipados": 0.0, "valor_recuperado": 0.0,
             "beneficiados": [], "tempos_selecao": []}
    raiz_valor = {}

    while heap:
        t_rel, _, v = heapq.heappop(heap)
        u, dia_vaga, nivel = v["unidade"], v["dia"], v["nivel"]
        if nivel == 0:
            stats["liberadas"] += 1
            raiz_valor[v["raiz"]] = v["valor"]
        agora = t_rel // T
        tentativas = max(0, dia_vaga * T - corte + 4 - t_rel)  # até 2 h antes (manhã do dia)

        t0 = time.perf_counter()
        ag, fb = agendas[u], filas.get(u)
        ma = elegiveis_a(ag, dia_vaga, agora, guarda, carencia)
        ia = np.flatnonzero(ma)
        data_agora = cal.data(agora)
        esp_a = (data_agora - pd.to_datetime(ag["data_ag"][ia]).normalize()).days.to_numpy() if len(ia) else np.array([])
        cand_cor, cand_esp, cand_ref = list(ag["cor"][ia]), list(esp_a), [("A", i) for i in ia]
        if fb is not None:
            ib = np.flatnonzero(elegiveis_b(fb))
            esp_b = fb["espera0"][ib] + (data_agora - cal.data(inicio_teste)).days
            cand_cor += list(fb["cor"][ib]); cand_esp += list(esp_b); cand_ref += [("B", i) for i in ib]
        ordem = ordenar(cand_cor, cand_esp) if cand_ref else []
        vistos, unicos = set(), []          # uma oferta por paciente, mesmo com várias consultas futuras
        for k in ordem:
            tipo_k, i_k = cand_ref[k]
            chave = ag["pac"][i_k] if tipo_k == "A" else fb["id"][i_k]
            if chave not in vistos:
                vistos.add(chave)
                unicos.append(k)
        ordem = np.array(unicos, dtype=int)
        stats["tempos_selecao"].append(time.perf_counter() - t0)

        def info(k):
            tipo, i = cand_ref[k]
            src = ag if tipo == "A" else fb
            return {"tipo_fila": tipo, "quem": str(src["pac"][i]) if tipo == "A" else str(src["id"][i]),
                    "cor": str(src["cor_txt"][i]), "espera_dias": float(cand_esp[k]),
                    "distancia_km": float(src["dist"][i])}

        vencedor, t_ac = None, None
        for n, k in enumerate(ordem[:tentativas]):  # sequencial (D11): um por vez, na ordem da fila
            aceitou = rng.random() < p_aceite
            log(t_rel + n, "oferta", raiz=v["raiz"], nivel=nivel, unidade=u, vaga_dia=int(dia_vaga),
                ordem=n + 1, resultado="aceite" if aceitou else "expirou", **info(k))
            if aceitou:
                vencedor, t_ac = k, t_rel + n + 1
                break

        if vencedor is None:
            if nivel == 0:
                stats["nao_preenchidas_n0"] += 1
                fim = "nao_preenchida"
            elif dia_vaga - agora >= volta:
                stats["fim_volta"] += 1
                stats["valor_recuperado"] += raiz_valor[v["raiz"]]
                fim = "volta_agenda"
            else:
                stats["fim_perdido"] += 1
                fim = "perdida"
            log(t_rel + max(tentativas, 1), "fim_cadeia", raiz=v["raiz"], nivel=nivel, unidade=u, resultado=fim)
            continue

        if nivel == 0:
            stats["preenchidas_n0"] += 1
        stats["movimentos"] += 1
        quem = info(vencedor)
        stats["beneficiados"].append(quem)
        tipo, i = cand_ref[vencedor]
        if tipo == "B":
            fb["servido"][i] = True
            stats["fim_b"] += 1
            stats["valor_recuperado"] += raiz_valor[v["raiz"]]
            log(t_ac, "aceite", raiz=v["raiz"], nivel=nivel, unidade=u, vaga_dia=int(dia_vaga), **quem)
            log(t_ac, "fim_cadeia", raiz=v["raiz"], nivel=nivel + 1, unidade=u, resultado="fila_sem_horario")
        else:
            dia_antigo = int(ag["dia"][i])
            ag["ativa"][i] = False
            ag["ultimo_aceite"][ag["pac"] == ag["pac"][i]] = t_ac // T  # carência vale para o paciente todo
            stats["dias_antecipados"] += (cal.data(dia_antigo) - cal.data(dia_vaga)).days
            log(t_ac, "aceite", raiz=v["raiz"], nivel=nivel, unidade=u, vaga_dia=int(dia_vaga),
                dia_antigo=cal.data(dia_antigo).strftime("%Y-%m-%d"), **quem)
            # paciente passa a ocupar a vaga (nova linha na agenda, inativa para novas ofertas)
            for chave in ag:
                extra = {"ativa": False, "dia": float(dia_vaga), "ultimo_aceite": float(t_ac // T)}
                ag[chave] = np.append(ag[chave], extra.get(chave, ag[chave][i]))
            log(t_ac, "vaga_liberada", id_consulta=int(ag["id"][i]), unidade=u, nivel=nivel + 1,
                valor=float(ag["valor"][i]))
            heapq.heappush(heap, (t_ac, seq, {"unidade": u, "dia": dia_antigo, "nivel": nivel + 1, "raiz": v["raiz"],
                                              "origem": int(ag["id"][i]), "valor": float(ag["valor"][i])}))
            seq += 1

    perda = float(df.loc[df["falta"] == 1, "valor_convenio"].sum())
    n_faltas = int(df["falta"].sum())
    recuperadas = stats["fim_b"] + stats["fim_volta"]
    benef = pd.DataFrame(stats["beneficiados"])
    tempos = np.array(stats["tempos_selecao"])
    # M5 operacional (D32): chance de um paciente que faltaria receber contato com botão "não vou", por grupo
    falt = df[df["falta"] == 1]
    contatado = falt["contato"] != "BAIXO"
    grupos = {"faixa_etaria": pd.cut(falt["idade"], [-1, 17, 39, 59, 200], labels=["0-17", "18-39", "40-59", "60+"]),
              "sexo": falt["sexo"], "bolsa_familia": falt["bolsa_familia"]}
    cobertura = {k: contatado.groupby(np.asarray(g)).mean().round(3).to_dict() for k, g in grupos.items()}
    todas = [v for d in cobertura.values() for v in d.values()]
    resumo = {
        "cenario": cenario,
        "cobertura_faltosos": cobertura, "M5_cobertura_min": float(min(todas)),
        "M5_cobertura_gap_pp": float(max((max(d.values()) - min(d.values())) * 100 for d in cobertura.values())),
        "consultas": len(df), "faltas": n_faltas, "unidades": int(df["unidade"].nunique()),
        "dias_uteis": int(df["dia"].nunique()),
        "contatos": int((df["contato"] != "BAIXO").sum()),
        "vagas_liberadas": stats["liberadas"],
        "primeira_vaga_preenchida": stats["preenchidas_n0"],
        "movimentos": stats["movimentos"],
        "fim_fila_sem_horario": stats["fim_b"], "fim_volta_agenda": stats["fim_volta"],
        "fim_perdido": stats["fim_perdido"], "nao_preenchidas": stats["nao_preenchidas_n0"],
        "vagas_recuperadas": recuperadas,
        "valor_recuperado_convenio": stats["valor_recuperado"], "perda_convenio": perda,
        "valor_recuperado_sus": recuperadas * fontes["valor"]["sus"]["valor"],
        "perda_sus": n_faltas * fontes["valor"]["sus"]["valor"],
        "dias_antecipados_tipo_a": stats["dias_antecipados"],
        "pacientes_b_atendidos": stats["fim_b"],
        "espera_media_beneficiados": float(benef["espera_dias"].mean()) if len(benef) else 0.0,
        "urgentes_beneficiados": float(benef["cor"].isin(["vermelho", "amarelo"]).mean()) if len(benef) else 0.0,
        "M8": stats["preenchidas_n0"] / max(stats["liberadas"], 1),
        "M9": stats["valor_recuperado"] / perda,
        "M10_seg_medio": float(tempos.mean()) if len(tempos) else 0.0,
        "M10_seg_max": float(tempos.max()) if len(tempos) else 0.0,
    }
    meses = resumo["dias_uteis"] / 22
    resumo["por_unidade_mes_convenio"] = resumo["valor_recuperado_convenio"] / resumo["unidades"] / meses
    return eventos, resumo


def salvar_eventos(eventos, caminho):
    with open(caminho, "w", encoding="utf-8") as f:
        for e in eventos:
            f.write(json.dumps(e, ensure_ascii=False, default=float) + "\n")


def checar_confirmacao(eventos):
    """M6: toda vaga de nível 0 precisa de uma resposta ativa antes. Devolve violações."""
    respostas = {e["id_consulta"]: e for e in eventos if e["tipo"] == "resposta"}
    erros = 0
    for e in eventos:
        if e["tipo"] == "vaga_liberada" and e["nivel"] == 0:
            r = respostas.get(e["id_consulta"])
            if r is None or r["resposta"] not in ("nao_vou", "remarcar") or r["t"] > e["t"]:
                erros += 1
    return erros
