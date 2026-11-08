"""Comando 2: treina o modelo e gera as previsões do período de teste."""
import sys
from pathlib import Path

import joblib
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent / "src"))
from giro import DADOS, SAIDAS, carregar_config  # noqa: E402
from giro.modelo import fatores, faixa_por_unidade_dia, tabela_fatores, treinar  # noqa: E402
from giro.preparar import PERFIS, VARIAVEIS_MODELO  # noqa: E402


def main():
    _, regras = carregar_config()
    consultas = pd.read_parquet(DADOS / "consultas.parquet")
    treino = consultas[consultas.conjunto == "treino"]
    teste = consultas[consultas.conjunto == "teste"].copy()

    modelo = treinar(treino)
    joblib.dump(modelo, SAIDAS / "modelo.joblib")

    teste["prob_falta"] = modelo.predict_proba(teste[VARIAVEIS_MODELO])[:, 1]
    teste["faixa"] = faixa_por_unidade_dia(teste, regras["faixas"]["alto"], regras["faixas"]["medio"],
                                           regras.get("faixa_por_idade", False))
    f = fatores(teste, tabela_fatores(treino))
    teste["fator_1"], teste["fator_2"], teste["fator_3"] = zip(*f)
    teste["perfil_nome"] = teste["perfil"].map(PERFIS)

    cols = ["id_consulta", "id_paciente", "unidade", "data_agendamento", "data_consulta", "antecedencia_dias",
            "idade", "sexo", "bolsa_familia", "consultas_anteriores", "faltas_anteriores",
            "perfil", "perfil_nome", "prob_falta", "faixa", "fator_1", "fator_2", "fator_3", "falta"]
    teste[cols].to_csv(SAIDAS / "previsoes.csv", index=False)
    print(f"treino: {len(treino):,} · teste: {len(teste):,} · faixas:", teste.faixa.value_counts().to_dict())


if __name__ == "__main__":
    main()
