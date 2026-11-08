"""Limpeza do dataset de Vitória, variáveis do modelo e perfis P1–P6 (Fase 1)."""
import numpy as np
import pandas as pd

# Variáveis que o modelo pode ler. Nada sintético aqui (D14, R12).
VARIAVEIS_MODELO = [
    "idade", "bolsa_familia", "hipertensao", "diabetes", "alcoolismo", "deficiencia",
    "antecedencia_dias", "consultas_anteriores", "faltas_anteriores", "taxa_faltas_anterior",
    "dia_semana_consulta", "hora_do_agendamento", "sexo_masculino", "unidade_cod",
    "dias_desde_ultima_consulta", "consultas_mesmo_dia", "consultas_mesma_semana", "taxa_faltas_unidade",
]
CATEGORICAS = ["unidade_cod"]

PERFIS = {
    "P1": "Mesmo dia",
    "P2": "Faltoso recorrente",
    "P3": "Primeira vez, marcou longe",
    "P4": "Crônico ou idoso",
    "P5": "Jovem",
    "P6": "Adulto em acompanhamento",
}


def ler_vitoria(caminho):
    df = pd.read_csv(caminho)
    df = df.rename(columns={
        "PatientId": "id_paciente", "AppointmentID": "id_consulta", "Gender": "sexo",
        "ScheduledDay": "data_agendamento", "AppointmentDay": "data_consulta", "Age": "idade",
        "Neighbourhood": "unidade", "Scholarship": "bolsa_familia", "Hipertension": "hipertensao",
        "Diabetes": "diabetes", "Alcoholism": "alcoolismo", "Handcap": "deficiencia",
        "SMS_received": "sms_recebido", "No-show": "no_show",
    })
    df["id_paciente"] = df["id_paciente"].map(lambda x: f"{x:.5f}".rstrip("0").rstrip("."))
    df["falta"] = (df["no_show"] == "Yes").astype(int)
    df["data_agendamento"] = pd.to_datetime(df["data_agendamento"]).dt.tz_localize(None)
    df["data_consulta"] = pd.to_datetime(df["data_consulta"]).dt.tz_localize(None).dt.normalize()
    return df


def limpar(df):
    df = df.copy()
    df["antecedencia_dias"] = (df["data_consulta"] - df["data_agendamento"].dt.normalize()).dt.days
    df = df[(df["antecedencia_dias"] >= 0) & (df["idade"] >= 0)]
    df = df.drop(columns=["sms_recebido", "no_show"])  # D7: SMS fora
    return df.sort_values(["id_paciente", "data_agendamento", "id_consulta"]).reset_index(drop=True)


def criar_variaveis(df, corte):
    df = df.copy()
    g = df.groupby("id_paciente")
    # Histórico só olhando para trás (R2)
    df["consultas_anteriores"] = g.cumcount()
    df["faltas_anteriores"] = g["falta"].cumsum() - df["falta"]
    df["taxa_faltas_anterior"] = np.where(
        df["consultas_anteriores"] > 0, df["faltas_anteriores"] / df["consultas_anteriores"].clip(lower=1), np.nan)
    df["dias_desde_ultima_consulta"] = (df["data_agendamento"].dt.normalize() - g["data_consulta"].shift()).dt.days
    df["consultas_mesmo_dia"] = df.groupby(["id_paciente", "data_consulta"])["id_consulta"].transform("count")
    semana = df["data_consulta"].dt.isocalendar().week
    df["consultas_mesma_semana"] = df.groupby(["id_paciente", semana])["id_consulta"].transform("count")
    df["dia_semana_consulta"] = df["data_consulta"].dt.dayofweek
    df["hora_do_agendamento"] = df["data_agendamento"].dt.hour
    df["sexo_masculino"] = (df["sexo"] == "M").astype(int)
    df["unidade_cod"] = df["unidade"].astype("category").cat.codes
    # Taxa de faltas da unidade: só com o treino, suavizada
    treino = df[df["data_consulta"] < corte]
    base = treino["falta"].mean()
    agg = treino.groupby("unidade")["falta"].agg(["sum", "count"])
    taxa = (agg["sum"] + 20 * base) / (agg["count"] + 20)
    df["taxa_faltas_unidade"] = df["unidade"].map(taxa).fillna(base)
    df["conjunto"] = np.where(df["data_consulta"] < corte, "treino", "teste")
    return df


def atribuir_perfil(df):
    cond = [
        df["antecedencia_dias"] == 0,
        (df["faltas_anteriores"] >= 2) | ((df["consultas_anteriores"] >= 3) & (df["taxa_faltas_anterior"] >= 0.5)),
        (df["consultas_anteriores"] == 0) & (df["antecedencia_dias"] > 14),
        (df["hipertensao"] == 1) | (df["diabetes"] == 1) | (df["idade"] >= 60),
        df["idade"] < 30,
    ]
    df = df.copy()
    df["perfil"] = np.select(cond, ["P1", "P2", "P3", "P4", "P5"], default="P6")
    return df


def preparar(caminho, corte):
    df = ler_vitoria(caminho)
    df = limpar(df)
    df = criar_variaveis(df, pd.Timestamp(corte))
    return atribuir_perfil(df)
