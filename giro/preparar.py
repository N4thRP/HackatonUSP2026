"""Comando 1: limpa os dados, cria variáveis, perfis e dados sintéticos."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))
from giro import DADOS, RAIZ, carregar_config  # noqa: E402
from giro.preparar import preparar  # noqa: E402
from giro.sinteticos import gerar_fila_b, gerar_sinteticos  # noqa: E402


def main():
    fontes, regras = carregar_config()
    consultas = preparar(DADOS / "brutos" / "vitoria.csv", regras["corte_treino"])
    consultas.to_parquet(DADOS / "consultas.parquet", index=False)
    sint = gerar_sinteticos(consultas, fontes, RAIZ)
    sint.to_parquet(DADOS / "sinteticos.parquet", index=False)
    fila_b = gerar_fila_b(consultas["unidade"].unique(), fontes)
    fila_b.to_parquet(DADOS / "fila_b.parquet", index=False)
    teste = consultas[consultas.conjunto == "teste"]
    print(f"consultas: {len(consultas):,} ({consultas.id_paciente.nunique():,} pacientes, "
          f"{consultas.unidade.nunique()} unidades) · teste: {len(teste):,} · faltas no teste: {teste.falta.sum():,}")
    print("perfis:", consultas.perfil.value_counts(normalize=True).sort_index().round(3).to_dict())
    print(f"sintéticos: {len(sint):,} linhas · fila B: {len(fila_b):,} pacientes")


if __name__ == "__main__":
    main()
