"""M6: nenhuma vaga é liberada sem resposta ativa do paciente (D2)."""
import json

import pytest

from giro import SAIDAS
from giro.simulador import checar_confirmacao


def test_checagem_pega_vaga_sem_resposta():
    eventos = [{"t": 5, "tipo": "vaga_liberada", "id_consulta": 1, "nivel": 0}]
    assert checar_confirmacao(eventos) == 1


def test_checagem_pega_resposta_vou():
    eventos = [{"t": 3, "tipo": "resposta", "id_consulta": 1, "resposta": "vou"},
               {"t": 5, "tipo": "vaga_liberada", "id_consulta": 1, "nivel": 0}]
    assert checar_confirmacao(eventos) == 1


def test_checagem_aceita_nao_vou_antes():
    eventos = [{"t": 3, "tipo": "resposta", "id_consulta": 1, "resposta": "nao_vou"},
               {"t": 3, "tipo": "vaga_liberada", "id_consulta": 1, "nivel": 0}]
    assert checar_confirmacao(eventos) == 0


def test_log_da_simulacao_sem_violacoes():
    arq = SAIDAS / "eventos.jsonl"
    if not arq.exists():
        pytest.skip("rode simular.py antes")
    with open(arq, encoding="utf-8") as f:
        eventos = [json.loads(linha) for linha in f]
    assert checar_confirmacao(eventos) == 0


def test_ninguem_aceita_duas_vagas_em_7_dias():
    """M7 (carência por paciente): nenhum paciente tem dois aceites a menos de 7 dias úteis."""
    import pandas as pd
    arq = SAIDAS / "eventos.jsonl"
    if not arq.exists():
        pytest.skip("rode simular.py antes")
    ev = pd.read_json(arq, lines=True)
    ac = ev[ev.tipo == "aceite"].sort_values("t")
    ac["dia_util"] = ac["t"] // 20
    gap = ac.groupby("quem")["dia_util"].diff().dropna()
    assert (gap > 7).all()
