"""M12: nenhum campo sintético (nem o SMS, D7) entra no treino; histórico só olha para trás."""
import pandas as pd

from giro import DADOS
from giro.preparar import VARIAVEIS_MODELO

SINTETICOS = {"horario", "valor_convenio", "valor_sus", "cor_risco", "distancia_km", "aceita_ofertas"}


def test_variaveis_do_modelo_nao_tem_sinteticos():
    assert not SINTETICOS & set(VARIAVEIS_MODELO)


def test_sem_sms_e_sem_perfil_no_modelo():
    assert "sms_recebido" not in VARIAVEIS_MODELO
    assert "perfil" not in VARIAVEIS_MODELO  # D18


def test_tabela_de_consultas_nao_tem_colunas_sinteticas():
    cols = set(pd.read_parquet(DADOS / "consultas.parquet").columns)
    assert not SINTETICOS & cols


def test_historico_nao_usa_a_propria_consulta():
    df = pd.read_parquet(DADOS / "consultas.parquet")
    primeira = df.sort_values(["data_agendamento", "id_consulta"]).groupby("id_paciente").head(1)
    assert (primeira["faltas_anteriores"] == 0).all()
    assert (primeira["consultas_anteriores"] == 0).all()
