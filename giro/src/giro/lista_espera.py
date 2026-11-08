"""Lista de espera única (D23): quem é elegível e em que ordem recebe a oferta.

Tipo A: paciente que já tem consulta marcada mais tarde na mesma unidade (dado real).
Tipo B: paciente na fila da regulação, sem horário (sintético).
Ordem: quem espera há mais tempo recebe a oferta primeiro (a cor de risco não entra na prioridade).
"""
import numpy as np

def elegiveis_a(ag, dia_vaga, agora, guarda, carencia):
    """Máscara dos pacientes tipo A que podem receber a oferta.

    ag: dict de arrays da unidade (ativa, aceita, dia, dia_ag, ultimo_aceite).
    Guarda (D24): a consulta atual precisa estar a `guarda`+ dias úteis de hoje,
    para que o horário deixado para trás ainda possa ser marcado normalmente.
    """
    return (
        ag["ativa"]
        & ag["aceita"]
        & (ag["dia"] > dia_vaga)                    # só quem seria atendido depois
        & (ag["dia_ag"] <= agora)                   # já tinha marcado
        & (ag["dia"] - agora >= guarda)             # regra de guarda
        & (ag["ultimo_aceite"] < agora - carencia)  # carência após aceitar
    )


def elegiveis_b(fb):
    return fb["aceita"] & ~fb["servido"]


def ordenar(espera):
    """Índices em ordem de oferta: maior espera primeiro (empate mantém a ordem original)."""
    return np.argsort(-np.asarray(espera, dtype=float), kind="stable")
