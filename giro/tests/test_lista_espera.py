"""M7: as ofertas seguem as regras da lista de espera."""
import numpy as np

from giro.lista_espera import elegiveis_a, ordenar


def agenda(**kw):
    base = {"ativa": [True] * 4, "aceita": [True] * 4, "dia": [20.0] * 4, "dia_ag": [0] * 4,
            "ultimo_aceite": [-99.0] * 4}
    base.update(kw)
    return {k: np.array(v) for k, v in base.items()}


def test_quem_espera_mais_recebe_primeiro():
    assert list(ordenar([3, 40, 12, 100])) == [3, 1, 2, 0]


def test_empate_mantem_ordem_original():
    assert list(ordenar([10, 30, 10, 30])) == [1, 3, 0, 2]


def test_so_quem_seria_atendido_depois():
    ag = agenda(dia=[5.0, 9.0, 20.0, 30.0])
    assert list(elegiveis_a(ag, dia_vaga=9, agora=0, guarda=5, carencia=7)) == [False, False, True, True]


def test_regra_de_guarda_5_dias_uteis():
    ag = agenda(dia=[12.0, 14.0, 15.0, 30.0])
    m = elegiveis_a(ag, dia_vaga=11, agora=10, guarda=5, carencia=7)
    assert list(m) == [False, False, True, True]


def test_carencia_de_7_dias_apos_aceitar():
    ag = agenda(ultimo_aceite=[-99.0, 5.0, 2.0, 10.0])
    m = elegiveis_a(ag, dia_vaga=11, agora=10, guarda=5, carencia=7)
    assert list(m) == [True, False, True, False]


def test_inativos_sem_adesao_e_quem_ainda_nao_marcou_ficam_fora():
    ag = agenda(ativa=[True, False, True, True], aceita=[True, True, False, True], dia_ag=[0, 0, 0, 15])
    m = elegiveis_a(ag, dia_vaga=11, agora=10, guarda=5, carencia=7)
    assert list(m) == [True, False, False, False]
