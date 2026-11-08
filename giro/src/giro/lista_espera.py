"""Lista de espera única (D23): quem é elegível e em que ordem recebe a oferta.

Tipo A: paciente que já tem consulta marcada mais tarde na mesma unidade (dado real).
Tipo B: paciente na fila da regulação, sem horário (sintético).
Ordem geral (D34, SUS): quem espera há mais tempo recebe a oferta primeiro.
Hospital particular (D35): primeiro quem tem consulta 7 dias depois da vaga, no mesmo horário;
sem essa pessoa ou sem aceite, segue a ordem geral.
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


def semana_primeiro(ordem, mesmo_horario):
    """D35: põe na frente, sem mudar a ordem relativa, quem tem consulta 7 dias depois no mesmo horário.

    ordem: índices já na ordem geral; mesmo_horario: máscara booleana indexada pelos mesmos índices.
    """
    ordem = np.asarray(ordem, dtype=int)
    m = np.asarray(mesmo_horario, dtype=bool)[ordem] if len(ordem) else np.array([], bool)
    return np.concatenate([ordem[m], ordem[~m]]).astype(int)
