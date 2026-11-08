"""M11: dados sintéticos batem com as fontes e são reprodutíveis."""
import pandas as pd
import pytest

from giro import DADOS, RAIZ, carregar_config
from giro.sinteticos import gerar_sinteticos


@pytest.fixture(scope="module")
def dados():
    fontes, _ = carregar_config()
    consultas = pd.read_parquet(DADOS / "consultas.parquet")
    return fontes, consultas, pd.read_parquet(DADOS / "sinteticos.parquet")


def test_turno_manha_43_8_mais_ou_menos_2pp(dados):
    _, _, s = dados
    manha = (s["horario"].str.slice(0, 2).astype(int) < 12).mean()
    assert abs(manha - 0.438) <= 0.02


def test_valor_medio_convenio_entre_145_e_165(dados):
    _, _, s = dados
    assert 145 <= s["valor_convenio"].mean() <= 165
    assert s["valor_convenio"].between(128, 195).all()


def test_proporcao_das_cores(dados):
    fontes, _, s = dados
    por_paciente = s.drop_duplicates("id_paciente")["cor_risco"].value_counts(normalize=True)
    for cor, alvo in fontes["cor_risco"]["proporcoes"].items():
        assert abs(por_paciente[cor] - alvo) <= 0.02


def test_mesma_semente_mesmos_dados(dados):
    fontes, consultas, s = dados
    amostra = consultas.head(2000)
    a = gerar_sinteticos(amostra, fontes, RAIZ)
    b = gerar_sinteticos(amostra, fontes, RAIZ)
    pd.testing.assert_frame_equal(a, b)
