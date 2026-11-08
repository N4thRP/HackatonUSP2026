"""Lista de espera única (D23): quem é elegível e em que ordem recebe a oferta.

Tipo A: paciente que já tem consulta marcada mais tarde na mesma unidade (dado real).
Tipo B: paciente na fila da regulação, sem horário (sintético).
Ordem: cor de risco (D13) e, dentro da cor, quem espera há mais tempo.
"""
import numpy as np

ORDEM_COR = {"vermelho": 0, "amarelo": 1, "verde": 2, "azul": 3}


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


def ordenar(cor_ordem, espera):
    """Índices em ordem de oferta: cor primeiro, depois maior espera."""
    return np.lexsort((-np.asarray(espera, dtype=float), np.asarray(cor_ordem)))
